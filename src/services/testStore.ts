import * as vscode from 'vscode';
import { createHash } from 'node:crypto';
import { access, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { queue } from 'async';

import BlasterCLI, { CliError, type CheckResult, type CliLocation, type DiscoveryError, type DiscoveryItem } from './blasterCLI';
import Database from './database';
import { createTestTree } from './database/methods';
import sampleResult from './sampleResult';
import type { BlasterContext } from '../extension';

import type { QueueObject } from 'async';

type Site = { test: Test; item: DiscoveryItem };
type FileRun = { workspace: Workspace; sites: Site[] };

export default class TestStore {
  private context: BlasterContext = {} as BlasterContext;
  private database: Database;
  private blasterCLI!: BlasterCLI;
  private eventQueue: QueueObject<() => Promise<void>>;
  private subscriptions: Array<vscode.Disposable> = [];
  private disposePromise: Promise<void> | null = null;
  private operationEmitter = new vscode.EventEmitter<TestOperationState>();
  public readonly onOperationState = this.operationEmitter.event;
  public operationState: TestOperationState = 'idle';
  private controller?: AbortController;
  private discovery?: Promise<TestTree>;
  private runPromise?: Promise<void>;
  private disposed = false;
  private sites = new Map<string, Site>();
  private workspaces = new Map<string, Workspace>();
  private isTestTreeFetched: boolean = false;
  private testTreeOpenState: Record<string, boolean> = {};
  private discoveryError: string | undefined;
  private discoveryFileErrors: Array<DiscoveryFileError> = [];

  constructor() {
    this.database = new Database();
    this.eventQueue = queue<() => Promise<void>>(async operation => { await operation(); }, 1);
  }

  private makeWorkspaceId(workspacePath: string): string {
    return createHash('sha256').update(workspacePath).digest('hex').slice(0, 8);
  }

  public async initialize(context: BlasterContext): Promise<void> {
    this.context = context;
    await this.database.initialize();
    this.blasterCLI = new BlasterCLI(
      text => context.outputChannel.append(text),
      () => vscode.workspace.getConfiguration('blaster-extension').get<boolean>('trace', false)
    );
  }

  private setOperation(state: TestOperationState): void {
    this.operationState = state;
    this.operationEmitter.fire(state);
  }

  private requireIdle(): void {
    if (this.disposed) throw new Error('Blaster is shutting down.');
    if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace before running Blaster.');
    if (this.operationState !== 'idle') throw new Error('Wait for the current Blaster operation to finish.');
  }

  private reportProblem(message: string, level: 'warning' | 'error' = 'warning'): void {
    this.context.outputChannel.appendLine(`> ${message}`);
    if (this.disposed) return;
    const show = level === 'error' ? vscode.window.showErrorMessage : vscode.window.showWarningMessage;
    void show(message, 'Show Output').then(action => {
      if (action) this.context.outputChannel.show(true);
    });
  }

  public async fetchTestTree(): Promise<TestTree> {
    if (this.discovery) return this.discovery;
    this.requireIdle();
    this.controller = new AbortController();
    this.setOperation('discovering');
    this.discovery = this.discover(this.controller.signal).then(tree => {
      this.discoveryError = undefined;
      return this.applyFileErrors(tree);
    }, error => {
      this.discoveryError = error instanceof Error ? error.message : String(error);
      throw error;
    }).finally(() => {
      this.discovery = undefined;
      this.controller = undefined;
      this.setOperation('idle');
    });
    return this.discovery;
  }

  private async discover(signal: AbortSignal): Promise<TestTree> {
    const previous = await this.database.fetchTestTree(this.testTreeOpenState);
    const tree: TestTree = { workspaces: {} };
    const nextWorkspaces = new Map<string, Workspace>();
    const nextSites = new Map<string, Site>();
    const refreshed = new Set<string>();
    const problems: string[] = [];
    const fileErrors: Array<DiscoveryFileError> = [];
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      if (folder.uri.scheme !== 'file') continue;
      const root = folder.uri.fsPath;
      const lakefiles = await Promise.all(['lakefile.lean', 'lakefile.toml'].map(name =>
        access(resolve(root, name)).then(() => true, () => false)));
      if (!lakefiles.some(Boolean)) continue;
      const workspace = { id: this.makeWorkspaceId(root), path: root };
      nextWorkspaces.set(workspace.id, workspace);
      try {
        const { items, errors, completion } = await this.blasterCLI.discover(root, signal);
        if (completion.interrupted || signal.aborted) throw new Error('Discovery was cancelled.');
        const workspaceFileErrors = await this.toFileErrors(workspace, errors);
        if (completion.exitCode !== 0 && items.length === 0 && workspaceFileErrors.length === 0) {
          throw new Error(errors.map(error => error.message).join('\n') || `lean-blaster exited with code ${completion.exitCode}.`);
        }
        fileErrors.push(...workspaceFileErrors);
        const workspaceSites = await this.createSites(workspace, items);
        for (const site of workspaceSites) nextSites.set(`${workspace.id}:${site.test.id}`, site);
        tree.workspaces[workspace.id] = {
          ...workspace, status: 'undetermined', isWaiting: false, isRunning: false,
          isOpen: this.testTreeOpenState[workspace.id] ?? true,
          nodes: createTestTree(workspace.id, this.testTreeOpenState, workspaceSites.map(site => site.test))
        };
        this.testTreeOpenState[workspace.id] ??= true;
        refreshed.add(workspace.id);
        if (workspaceFileErrors.length > 0) {
          const files = Array.from(new Set(workspaceFileErrors.map(error => error.group.at(-1)))).join(', ');
          problems.push(`Property Discovery Error: An error occurred in ${files}. View output for more details.`);
        } else if (completion.exitCode !== 0) {
          problems.push(`Discovery of ${root} is incomplete. See Blaster Output for diagnostics.`);
        }
      } catch (error) {
        if (signal.aborted) throw error;
        problems.push(`${root}: ${error instanceof Error ? error.message : String(error)}`);
        fileErrors.push(...this.discoveryFileErrors.filter(error => error.workspaceId === workspace.id));
        if (previous.workspaces[workspace.id]) {
          tree.workspaces[workspace.id] = previous.workspaces[workspace.id];
          for (const [key, site] of this.sites) {
            if (site.test.workspaceId === workspace.id) nextSites.set(key, site);
          }
        }
      }
    }
    if (signal.aborted) throw new Error('Discovery was cancelled.');
    if (nextWorkspaces.size > 0 && refreshed.size === 0 && problems.length) throw new Error(problems.join('\n'));
    let storedTree = tree;
    await this.eventQueue.pushAsync(async () => {
      storedTree = await this.database.storeTestTree(tree, this.testTreeOpenState, refreshed);
    });
    this.workspaces = nextWorkspaces;
    this.sites = nextSites;
    this.discoveryFileErrors = fileErrors;
    this.isTestTreeFetched = true;
    if (problems.length) this.reportProblem(problems.join('\n'), 'error');
    return storedTree;
  }

  private async toFileErrors(workspace: Workspace, errors: Array<DiscoveryError>): Promise<Array<DiscoveryFileError>> {
    const root = await realpath(workspace.path).catch(() => workspace.path);
    return errors.flatMap(error => {
      if (!error.file) return [];
      const path = relative(root, resolve(root, error.file));
      if (!path || isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`)) return [];
      return [{ workspaceId: workspace.id, group: path.split(sep), message: error.message }];
    });
  }

  public getDiscoveryError(): string | undefined {
    return this.discoveryError;
  }

  private applyFileErrors(testTree: TestTree): TestTree {
    for (const workspace of Object.values(testTree.workspaces)) {
      this.applyWorkspaceFileErrors(workspace.id, workspace.nodes);
    }
    return testTree;
  }

  private applyWorkspaceFileErrors(workspaceId: string, nodes: GenericMap<TestTreeGroupNode>): void {
    for (const error of this.discoveryFileErrors) {
      if (error.workspaceId !== workspaceId || error.group.length === 0) continue;
      let currentNodes = nodes;
      for (let index = 0; index < error.group.length; index++) {
        const name = error.group[index];
        const isLast = index === error.group.length - 1;
        const isOpen = this.testTreeOpenState[[workspaceId, ...error.group.slice(0, index + 1)].join(':')] ?? false;
        currentNodes[name] ??= isLast
          ? { type: 'file', name, isOpen, tests: {} } as TestTreeFileNode
          : { type: 'folder', name, isOpen, nodes: {} } as TestTreeFolderNode;
        const node = currentNodes[name];
        if (isLast) {
          if (node.type === 'file') (node as TestTreeFileNode).error = error.message;
        } else {
          if (node.type !== 'folder') break;
          currentNodes = (node as TestTreeFolderNode).nodes;
        }
      }
    }
  }

  private async createSites(workspace: Workspace, items: DiscoveryItem[]): Promise<Site[]> {
    const sources = new Map<string, { file: string; lines: string[] }>();
    const sites = new Map<string, Site>();
    const root = await realpath(workspace.path);
    for (const item of items) {
      const sourcePath = resolve(root, item.invocationRange.start.file);
      let source = sources.get(sourcePath);
      if (!source) {
        const file = await realpath(sourcePath);
        source = { file, lines: (await readFile(file, 'utf8')).split(/\r?\n/) };
        sources.set(sourcePath, source);
      }
      const path = relative(root, source.file);
      if (isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`) || !path.endsWith('.lean')) {
        throw new Error(`Discovery returned a source outside the project: ${source.file}`);
      }
      const position = (location: CliLocation): TestRangePosition => {
        const line = source!.lines[location.line - 1];
        if (line === undefined || location.column > Array.from(line).length + 1) {
          throw new Error(`Source location is no longer valid in ${source!.file}. Refresh the test tree.`);
        }
        return { line: location.line - 1, character: Array.from(line).slice(0, location.column - 1).join('').length };
      };
      const { start, stop } = item.invocationRange;
      const id = createHash('sha256').update(JSON.stringify([path, item.kind, start.line, start.column, stop.line, stop.column])).digest('hex').slice(0, 32);
      sites.set(id, {
        item,
        test: {
          id, workspaceId: workspace.id,
          name: item.name || `${item.body.replace(/\s+/g, ' ').slice(0, 140)} (line ${start.line})`,
          group: path.split(sep), location: { path: source.file, range: { start: position(start), end: position(stop) } },
          status: 'undetermined', isWaiting: false, isRunning: false
        }
      });
    }
    return Array.from(sites.values());
  }

  public async getTestTree(): Promise<TestTree> {
    return this.isTestTreeFetched
      ? this.applyFileErrors(await this.database.fetchTestTree(this.testTreeOpenState))
      : this.fetchTestTree();
  }

  public updateOpenTestTreeNode(isOpen: boolean, workspaceId: string, group?: Array<string>): void {
    const id = [workspaceId];
    if (group) id.push(...group);
    this.testTreeOpenState[id.join(':')] = isOpen;
  }

  public collapseTestTree(): void {
    for (const key of Object.keys(this.testTreeOpenState)) {
      this.testTreeOpenState[key] = false;
    }
  }

  public async runTests(testRuns: Array<TestRun>): Promise<void> {
    this.requireIdle();
    if (!this.isTestTreeFetched) throw new Error('Discover tests before running them.');
    const paths = new Set<string>();
    for (const run of testRuns) {
      if (!this.workspaces.has(run.workspaceId)) throw new Error('Unknown workspace. Refresh the test tree.');
      if (run.testIds !== undefined) {
        for (const id of run.testIds) {
          const site = this.sites.get(`${run.workspaceId}:${id}`);
          if (!site) throw new Error('A selected invocation no longer exists. Refresh the test tree.');
          paths.add(site.test.location.path);
        }
      } else {
        for (const site of this.sites.values()) {
          if (site.test.workspaceId === run.workspaceId) paths.add(site.test.location.path);
        }
      }
    }
    const files = new Map<string, FileRun>();
    for (const site of this.sites.values()) {
      const path = site.test.location.path;
      if (!paths.has(path)) continue;
      if (!files.has(path)) files.set(path, { workspace: this.workspaces.get(site.test.workspaceId)!, sites: [] });
      files.get(path)!.sites.push(site);
    }
    if (files.size === 0) return;
    this.controller = new AbortController();
    this.setOperation('running');
    this.runPromise = this.runFiles(files, this.controller.signal).finally(() => {
      this.controller = undefined;
      this.runPromise = undefined;
      this.setOperation('idle');
    });
    return this.runPromise;
  }

  private async runFiles(files: Map<string, FileRun>, signal: AbortSignal): Promise<void> {
    const pending = new Set(Array.from(files.values()).flatMap(file => file.sites));
    const selection = Array.from(pending, site => ({ workspaceId: site.test.workspaceId, testIds: [site.test.id] }));
    const failedFiles: string[] = [];
    try {
      await this.eventQueue.pushAsync(() => this.database.handleTestRun(selection));
      for (const [file, run] of files) {
        if (signal.aborted) break;
        const results = new Map<Site, CheckResult[]>();
        await this.eventQueue.pushAsync(async () => {
          for (const site of run.sites) {
            await this.database.handleTestUpdateEvent({ type: 'test-update', payload: {
              workspaceId: site.test.workspaceId, testId: site.test.id, isRunning: true
            } });
          }
        });
        let failure: unknown;
        let complete = false;
        let failed = false;
        try {
          this.context.outputChannel.appendLine(`> Checking ${file}`);
          const completion = await this.blasterCLI.check(file, run.workspace.path, signal, result => {
            if (signal.aborted) return;
            const matches = run.sites.filter(site => {
              if (resolve(run.workspace.path, result.location.file) !== file || result.invocation !== site.item.kind) return false;
              const { start, stop } = site.item.invocationRange;
              const position = result.location;
              return (position.line > start.line || position.line === start.line && position.column >= start.column) &&
                (position.line < stop.line || position.line === stop.line && position.column < stop.column);
            });
            if (matches.length === 0) this.context.outputChannel.appendLine(`> No discovered site matches ${result.property} at ${JSON.stringify(result.location)}.`);
            const owners = new Map<string, Site>();
            for (const site of matches) {
              const previous = owners.get(site.test.workspaceId);
              const range = site.item.invocationRange;
              const previousRange = previous?.item.invocationRange;
              if (!previousRange || range.start.line > previousRange.start.line ||
                  range.start.line === previousRange.start.line && range.start.column > previousRange.start.column ||
                  range.start.line === previousRange.start.line && range.start.column === previousRange.start.column &&
                  (range.stop.line < previousRange.stop.line || range.stop.line === previousRange.stop.line && range.stop.column < previousRange.stop.column)) {
                owners.set(site.test.workspaceId, site);
              }
            }
            for (const site of owners.values()) {
              const values = results.get(site) ?? [];
              values.push(result);
              results.set(site, values);
            }
          });
          complete = !completion.interrupted;
          failed = !complete || completion.exitCode >= 4;
          if (completion.interrupted) this.controller?.abort();
          if (failed && !signal.aborted) failedFiles.push(file);
        } catch (error) {
          failure = error;
          failed = true;
          this.context.outputChannel.appendLine(`> ${file}: ${error instanceof Error ? error.message : String(error)}`);
          if (!signal.aborted) failedFiles.push(file);
        }
        for (const site of run.sites) {
          const values = results.get(site) ?? [];
          const invalid = values.some(result => result.status === 'falsified' || result.status === 'error');
          let status: RunStatus = 'undetermined';
          if (invalid || failed && (complete || !signal.aborted) && values.length === 0) status = 'invalid';
          else if (complete && values.length > 0 && values.every(result => result.status === 'valid')) status = 'valid';
          await this.finishSite(site, status, values);
          pending.delete(site);
        }
        if (failure instanceof CliError && failure.fatal) throw failure;
      }
    } finally {
      for (const site of pending) await this.finishSite(site, 'undetermined', []);
    }
    if (failedFiles.length && !signal.aborted) {
      this.reportProblem(`Blaster could not complete ${failedFiles.length} file(s). See Blaster Output for diagnostics.`);
    }
  }

  private async finishSite(site: Site, status: RunStatus, results: CheckResult[]): Promise<void> {
    const { workspaceId, id: testId } = site.test;
    await this.eventQueue.pushAsync(async () => {
      if (status === 'invalid') {
        await this.database.handleTestResultEvent({ type: 'test-result', payload: { workspaceId, testId, result: sampleResult } });
      }
      await this.database.handleTestUpdateEvent({ type: 'test-update', payload: {
        workspaceId, testId, status, isRunning: false,
        time: results.reduce((sum, result) => sum + result.elapsedMs, 0)
      } });
    });
  }

  public async stopTests(): Promise<void> {
    if (!this.runPromise) return;
    this.setOperation('stopping');
    this.controller?.abort();
    await this.runPromise;
  }

  public async runAllTests(): Promise<void> {
    const testRuns = Array.from(this.workspaces.values()).map(v => ({ workspaceId: v.id }));
    await this.runTests(testRuns);
  }

  public async clearTestResults(): Promise<void> {
    this.requireIdle();
    await this.eventQueue.pushAsync(() => this.database.clearTestResults());
  }

  public async collapseAllTests(): Promise<TestTree> {
    this.collapseTestTree();
    return this.applyFileErrors(await this.database.fetchTestTree(this.testTreeOpenState));
  }

  public async getTestLocation(workspaceId: string, testId: string): Promise<TestLocation> {
    return (await this.database.getTest(workspaceId, testId)).location;
  }

  public async getTestResult(workspaceId: string, testId: string): Promise<{ test: Test, result: TestResult }> {
    const test = await this.database.getTest(workspaceId, testId);
    const result = await this.database.getTestResult(workspaceId, testId);
    return { test, result };
  }

  public onTestTreeUpdate(callback: (payload: TestTreeUpdate) => void): vscode.Disposable {
    const unsubscribeTests = this.database.onTestUpdate(callback);
    const unsubscribeTree = this.database.onTestTreeUpdate(this.testTreeOpenState, payload => {
      if (payload.type === 'workspace' && payload.workspace.nodes) {
        this.applyWorkspaceFileErrors(payload.workspace.id, payload.workspace.nodes);
      }
      callback(payload);
    });
    const subscription = new vscode.Disposable(() => {
      unsubscribeTests();
      unsubscribeTree();
    });
    this.subscriptions.push(subscription);
    return subscription;
  }

  public dispose(): Promise<void> {
    if (!this.disposePromise) {
      this.disposed = true;
      this.controller?.abort();
      this.disposePromise = (async () => {
        for (const subscription of this.subscriptions) subscription.dispose();
        await Promise.allSettled([this.discovery, this.runPromise]);
        if (!this.eventQueue.idle()) await this.eventQueue.drain();
        this.operationEmitter.dispose();
        await this.database.dispose();
      })();
    }
    return this.disposePromise;
  }
}
