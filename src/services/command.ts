import * as vscode from 'vscode';
import { createHash } from 'node:crypto';
import { relative, resolve as resolvePath, sep } from 'node:path';
import { queue } from 'async';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

import sampleResult from '../utils/sampleResult';
import { getTestRunLocation } from '../utils/testRun';
import { BlasterContext } from '../extension';

import type { ChildProcess } from 'node:child_process';
import type { QueueObject } from 'async';

type CommandLocation = { file: string; line: number; column: number };

type CommandResult = {
  property: string;
  location: CommandLocation;
  status: 'valid' | 'falsified' | 'undetermined' | 'error' | 'skipped';
  expectedStatus: 'falsified' | 'undetermined' | null;
  elapsedMs: number;
  reason: string | null;
};

type CommandEvent =
  | { event: 'discovery'; item: { kind: 'command' | 'tactic'; name: string | null; invocationRange: { start: CommandLocation; stop: CommandLocation } } }
  | { event: 'result'; result: CommandResult }
  | { event: 'diagnostic'; diagnostic: { severity: string; message: string; location: CommandLocation | null } }
  | { event: 'complete'; exitCode: number; interrupted?: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isLocation = (value: unknown): value is CommandLocation =>
  isRecord(value) && typeof value.file === 'string'
  && typeof value.line === 'number' && Number.isInteger(value.line) && value.line > 0
  && typeof value.column === 'number' && Number.isInteger(value.column) && value.column > 0;

const parseEvent = (line: string): CommandEvent | undefined => {
  const value: unknown = JSON.parse(line);
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.event !== 'string') {
    throw new Error('Unsupported lean-blaster JSON event (expected schemaVersion 1).');
  }
  switch (value.event) {
    case 'discovery': {
      const item = value.item;
      if (isRecord(item) && (item.kind === 'command' || item.kind === 'tactic')
        && (item.name === null || typeof item.name === 'string') && isRecord(item.invocationRange)
        && isLocation(item.invocationRange.start) && isLocation(item.invocationRange.stop)) {
        return { event: 'discovery', item: {
          kind: item.kind, name: item.name,
          invocationRange: { start: item.invocationRange.start, stop: item.invocationRange.stop }
        } };
      }
      break;
    }
    case 'result': {
      const result = value.result;
      if (isRecord(result) && typeof result.property === 'string' && isLocation(result.location)
        && (result.status === 'valid' || result.status === 'falsified' || result.status === 'undetermined'
          || result.status === 'error' || result.status === 'skipped')
        && (result.expectedStatus == null || result.expectedStatus === 'falsified' || result.expectedStatus === 'undetermined')
        && typeof result.elapsedMs === 'number' && Number.isFinite(result.elapsedMs) && result.elapsedMs >= 0
        && (result.reason == null || typeof result.reason === 'string')) {
        return { event: 'result', result: {
          property: result.property, location: result.location, status: result.status,
          expectedStatus: result.expectedStatus ?? null, elapsedMs: result.elapsedMs, reason: result.reason ?? null
        } };
      }
      break;
    }
    case 'diagnostic': {
      const diagnostic = value.diagnostic;
      if (isRecord(diagnostic) && typeof diagnostic.severity === 'string' && typeof diagnostic.message === 'string'
        && (diagnostic.location === null || isLocation(diagnostic.location))) {
        return { event: 'diagnostic', diagnostic: {
          severity: diagnostic.severity, message: diagnostic.message, location: diagnostic.location
        } };
      }
      break;
    }
    case 'complete':
      if (typeof value.exitCode === 'number' && Number.isInteger(value.exitCode)
        && (value.interrupted === undefined || typeof value.interrupted === 'boolean')) {
        return { event: 'complete', exitCode: value.exitCode, interrupted: value.interrupted };
      }
      break;
    default:
      return;
  }
  throw new Error(`Invalid lean-blaster ${value.event} event.`);
};

const severity: Record<RunStatus, number> = { empty: 0, valid: 1, undetermined: 2, error: 3, invalid: 4 };

const toRunStatus = ({ status, expectedStatus }: CommandResult): RunStatus =>
  status === 'valid' || status === expectedStatus ? 'valid'
    : status === 'undetermined' ? 'undetermined'
    : status === 'error' || status === 'skipped' ? 'error' : 'invalid';

const toPosition = ({ line, column }: CommandLocation): TestRangePosition => ({ line: line - 1, character: column - 1 });

const compare = (a: TestRangePosition, b: TestRangePosition): number => a.line - b.line || a.character - b.character;

export default class Command {
  private context: BlasterContext = {} as BlasterContext;
  private workspaces: Map<string, Workspace> = new Map();
  private tests: Map<string, Array<Test>> = new Map();
  private queuedJobs: Set<string> = new Set();
  private children: Set<ChildProcess> = new Set();
  private emit: (event: TestEvent) => void = () => {};
  private testRunQueue: QueueObject<TestRunJob>;

  constructor() {
    this.testRunQueue = queue<TestRunJob>(async job => {
      try {
        await this.handleTestJob(job);
      } finally {
        this.queuedJobs.delete(job.id);
      }
    }, 1);
  }

  private makeWorkspaceId(workspacePath: string): string {
    return createHash('sha256').update(workspacePath).digest('hex').slice(0, 8);
  }

  private makeTestRunId(testRun: TestRun): string {
    return createHash('sha256')
      .update(JSON.stringify(testRun))
      .digest('hex')
      .slice(0, 8);
  }

  public initialize(context: BlasterContext) {
    this.context = context;
  }

  public async discover(): Promise<TestTree> {
    const workspaces = new Map(
      vscode.workspace.workspaceFolders?.map(folder => [
        this.makeWorkspaceId(folder.uri.fsPath),
        {
          id: this.makeWorkspaceId(folder.uri.fsPath),
          path: folder.uri.fsPath
        }
      ]) || []
    );

    const discoveredTests = new Map<string, Array<Test>>();
    const testTree: TestTree = { workspaces: {} };

    for (const workspace of workspaces.values()) {
      const tests: Array<Test> = [];
      await this.exec(['discover', workspace.path, '--json'], workspace.path, event => {
        if (event.event === 'diagnostic') this.logDiagnostic(event.diagnostic);
        if (event.event !== 'discovery') return;

        const { kind, name, invocationRange: { start, stop } } = event.item;
        const file = resolvePath(workspace.path, start.file);
        const relativePath = relative(workspace.path, file);
        tests.push({
          id: `${relativePath}:${start.line}:${start.column}`,
          name: name?.split('.').pop() ?? `${kind === 'command' ? '#blaster' : 'example'} (line ${start.line})`,
          group: relativePath.split(sep),
          location: { path: file, range: { start: toPosition(start), end: toPosition(stop) } },
          status: 'empty',
          isWaiting: false,
          isRunning: false,
          workspaceId: workspace.id
        });
      });

      discoveredTests.set(workspace.id, tests);

      const nodes: GenericMap<TestTreeFileNode> = {};
      for (const test of tests) {
        const file = test.group.join('/');
        (nodes[file] ??= { type: 'file', name: file, isOpen: false, tests: {} }).tests[test.id] = test;
      }

      testTree.workspaces[workspace.id] = {
        ...workspace,
        status: 'empty',
        isWaiting: false,
        isRunning: false,
        isOpen: false,
        nodes
      };
    }

    this.workspaces = workspaces;
    this.tests = discoveredTests;
    return testTree;
  }

  public prepareTestRuns(testRuns: Array<TestRun> = Array.from(this.workspaces.keys(), workspaceId => ({ workspaceId }))): Array<TestRun> {
    const runs = new Map<string, TestRun>();
    for (const { workspaceId, tests: selections } of testRuns) {
      const workspaceTests = this.tests.get(workspaceId);
      if (!workspaceTests) throw new Error(`Unknown workspace: ${workspaceId}. Refresh the test tree.`);
      const selectedFiles: NonNullable<TestRun['tests']> = selections ?? Array.from(
        new Set(workspaceTests.map(test => getTestRunLocation(test).uri)),
        uri => ({ uri })
      );

      for (const { uri, ids } of selectedFiles) {
        if (ids?.length === 0) continue;
        const fileTests = workspaceTests.filter(test => getTestRunLocation(test).uri === uri);
        if (fileTests.length === 0 || ids?.some(id => !fileTests.some(test => getTestRunLocation(test).id === id))) {
          throw new Error(`Some selected tests in ${uri} no longer exist. Refresh the test tree.`);
        }
        // The CLI checks the whole file even when individual positions are selected.
        const testRun: TestRun = { workspaceId, tests: [{ uri }] };
        const id = this.makeTestRunId(testRun);
        if (!this.queuedJobs.has(id)) runs.set(id, testRun);
      }
    }
    return Array.from(runs.values());
  }

  public runTests(testRuns: Array<TestRun>): void {
    this.context.statusBarItem.hide();
    for (const testRun of this.prepareTestRuns(testRuns)) {
      const id = this.makeTestRunId(testRun);
      this.queuedJobs.add(id);
      this.testRunQueue.push({ id, status: 'waiting', testRun });
    }
  }

  public async handleTestJob(job: TestRunJob): Promise<void> {
    const { workspaceId, tests: selections } = job.testRun;
    const workspace = this.workspaces.get(workspaceId);
    const workspaceTests = this.tests.get(workspaceId) ?? [];
    const uri = selections?.[0]?.uri;
    const tests = workspaceTests.filter(test => getTestRunLocation(test).uri === uri);
    const file = tests[0]?.location.path;
    if (workspace === undefined || file === undefined) {
      const message = 'Queued tests no longer exist. Refresh the test tree.';
      this.reportRunError(message);
      this.emit({ type: 'test-run-failed', payload: { testRun: job.testRun, error: { message } } });
      return;
    }

    for (const test of tests) {
      this.emit({ type: 'test-update', payload: { workspaceId, testId: test.id, isRunning: true } });
    }

    const results: Map<string, { status: RunStatus; time: number }> = new Map();
    let reason: string | undefined;
    let diagnostic: string | undefined;
    let exitCode: number | undefined;
    let failure: string | undefined;

    try {
      exitCode = await this.exec(['check', file, '--solver-timeout', '1s', '--json'], workspace.path, event => {
        if (event.event === 'diagnostic') {
          this.logDiagnostic(event.diagnostic);
          if (event.diagnostic.severity === 'error') diagnostic ??= event.diagnostic.message;
        }
        if (event.event !== 'result') return;

        const { result } = event;
        const position = toPosition(result.location);
        const test = resolvePath(workspace.path, result.location.file) === file
          ? tests.find(({ location: { range } }) => compare(range.start, position) <= 0 && compare(position, range.end) < 0)
          : undefined;

        if (test === undefined) {
          this.context.outputChannel.appendLine(`> Unmatched result for ${result.property}`);
          return;
        }

        // A site can report several results (e.g. `<;> blaster`): the worst status wins
        const previous = results.get(test.id) ?? { status: 'empty', time: 0 };
        const status = toRunStatus(result);
        if (status === 'error') reason ??= result.reason ?? undefined;
        const current = {
          status: severity[status] > severity[previous.status] ? status : previous.status,
          time: previous.time + result.elapsedMs
        };
        results.set(test.id, current);

        this.emit({ type: 'test-update', payload: { workspaceId, testId: test.id, ...current, isRunning: true } });
        if (result.status === 'falsified' || result.status === 'undetermined') {
          this.emit({ type: 'test-result', payload: { workspaceId, testId: test.id, result: sampleResult } });
        }
      });
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }

    for (const [testId, result] of results) {
      this.emit({ type: 'test-update', payload: { workspaceId, testId, ...result, isRunning: false } });
    }

    // Exit 2 or 4 means the run itself failed, so tests without a result return to empty
    const isComplete = failure === undefined && exitCode !== 2 && exitCode !== 4;
    const missingTests = tests.filter(test => !results.has(test.id));
    if (isComplete) {
      for (const test of missingTests) {
        this.emit({ type: 'test-update', payload: { workspaceId, testId: test.id, status: 'error', isRunning: false } });
      }
    } else if (missingTests.length > 0) {
      this.emit({
        type: 'test-run-failed',
        payload: {
          testRun: { workspaceId, tests: [{ uri: getTestRunLocation(tests[0]).uri, ids: missingTests.map(test => getTestRunLocation(test).id) }] },
          error: { message: failure ?? `lean-blaster exited with code ${exitCode}` }
        }
      });
    }

    const hasError = missingTests.length > 0 || Array.from(results.values()).some(result => result.status === 'error');
    if (!isComplete || hasError) {
      const message = reason ?? diagnostic ?? failure
        ?? (isComplete ? 'No result reported by lean-blaster' : `lean-blaster exited with code ${exitCode}`);
      this.reportRunError(`${relative(workspace.path, file)}: ${message}`);
    }
  }

  private reportRunError(message: string): void {
    const { outputChannel, statusBarItem } = this.context;
    outputChannel.appendLine(`> ERROR ${message}`);

    statusBarItem.text = '$(error) Proof Execution Failed';
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    statusBarItem.show();

    // The notification shows the first line; the output keeps the full message
    const brief = message.split('\n')[0];
    void vscode.window.showErrorMessage(`Proof Execution Failed: ${brief}`, 'Show output').then(selection => {
      if (selection === 'Show output') outputChannel.show(true);
    });
  }

  public onTestEvent(callback: (event: TestEvent) => void): void {
    this.emit = callback;
  }

  private exec(args: Array<string>, cwd: string, onEvent: (event: CommandEvent) => void): Promise<number> {
    this.context.outputChannel.appendLine(`> lean-blaster ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
      const child = spawn('lean-blaster', args, { cwd });
      this.children.add(child);
      let failure: Error | undefined;
      let complete: Extract<CommandEvent, { event: 'complete' }> | undefined;

      child.stderr.setEncoding('utf8').on('data', data => this.context.outputChannel.append(data));

      createInterface({ input: child.stdout }).on('line', line => {
        if (failure) return;
        try {
          const event = parseEvent(line);
          if (event?.event === 'complete') complete = event;
          if (event) onEvent(event);
        } catch (error) {
          failure = new Error(`Unable to read lean-blaster output: ${String(error)}`);
          child.kill('SIGTERM');
        }
      });

      child.on('error', (error: NodeJS.ErrnoException) => {
        failure = error.code === 'ENOENT' ? new Error('lean-blaster not found on PATH') : error;
      });

      child.on('close', (code, signal) => {
        this.children.delete(child);
        if (failure) reject(failure);
        else if (!complete || complete.interrupted || code === null || code !== complete.exitCode) {
          reject(new Error(`lean-blaster run incomplete (exit ${code}, signal ${signal}).`));
        } else if (args[0] === 'discover' && code !== 0 && code !== 4) {
          reject(new Error(`lean-blaster discovery failed (exit ${code}). See Blaster output.`));
        } else resolve(code);
      });
    });
  }

  private logDiagnostic({ severity: level, message, location }: { severity: string; message: string; location: CommandLocation | null }): void {
    const where = location ? `${location.file}:${location.line}:${location.column}: ` : '';
    this.context.outputChannel.appendLine(`> ${level.toUpperCase()} ${where}${message}`);
  }
}
