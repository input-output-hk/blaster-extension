import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export type CliLocation = { file: string; line: number; column: number };
export type CliRange = { start: CliLocation; stop: CliLocation };
export type DiscoveryItem = {
  kind: 'command' | 'tactic';
  name: string | null;
  body: string;
  invocationRange: CliRange;
  bodyRange: CliRange;
};
export type CheckResult = {
  property: string;
  invocation: 'command' | 'tactic' | 'declaration';
  status: 'valid' | 'falsified' | 'undetermined' | 'error' | 'skipped';
  location: CliLocation;
  elapsedMs: number;
  expectedStatus?: string | null;
  origin: string;
  solverTimeoutSeconds: number | null;
  goal: string | null;
  counterexample: string[];
  reason: string | null;
};
type CliEvent = Record<string, unknown> & { schemaVersion: 1; event: string };
export type CliCompletion = { exitCode: number; interrupted: boolean };

export class CliError extends Error {
  constructor(message: string, public readonly fatal = false) {
    super(message);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNatural = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isLocation = (value: unknown): value is CliLocation =>
  isRecord(value) && typeof value.file === 'string' && value.file.length > 0 &&
  isNatural(value.line) && value.line > 0 && isNatural(value.column) && value.column > 0;
const isRange = (value: unknown): value is CliRange =>
  isRecord(value) && isLocation(value.start) && isLocation(value.stop) &&
  value.start.file === value.stop.file &&
  (value.stop.line > value.start.line ||
    value.stop.line === value.start.line && value.stop.column >= value.start.column);
const isOptionalText = (value: unknown): boolean => value == null || typeof value === 'string';

export default class BlasterCLI {
  constructor(private readonly log: (text: string) => void, private readonly trace: () => boolean) {}

  public async discover(root: string, signal: AbortSignal): Promise<{ items: DiscoveryItem[]; completion: CliCompletion }> {
    const items: DiscoveryItem[] = [];
    const completion = await this.execute('discover', root, root, signal, event => {
      if (event.event !== 'discovery') return;
      const item = event.item;
      if (!isRecord(item) || !['command', 'tactic'].includes(String(item.kind)) ||
          !isOptionalText(item.name) || typeof item.body !== 'string' ||
          !isRange(item.invocationRange) || !isRange(item.bodyRange)) {
        throw new CliError('Invalid discovery item from lean-blaster.', true);
      }
      items.push(item as DiscoveryItem);
    });
    return { items, completion };
  }

  public check(file: string, root: string, signal: AbortSignal, onResult: (result: CheckResult) => void): Promise<CliCompletion> {
    return this.execute('check', file, root, signal, event => {
      if (event.event !== 'result') return;
      const result = event.result;
      if (!isRecord(result) || typeof result.property !== 'string' ||
          !['command', 'tactic', 'declaration'].includes(String(result.invocation)) ||
          !['valid', 'falsified', 'undetermined', 'error', 'skipped'].includes(String(result.status)) ||
          !isLocation(result.location) || !isNatural(result.elapsedMs) ||
          typeof result.origin !== 'string' || !isOptionalText(result.expectedStatus) ||
          !isOptionalText(result.goal) || !isOptionalText(result.reason) ||
          !(result.solverTimeoutSeconds === null || isNatural(result.solverTimeoutSeconds)) ||
          !Array.isArray(result.counterexample) || !result.counterexample.every(value => typeof value === 'string')) {
        throw new CliError('Invalid check result from lean-blaster.', true);
      }
      this.log(`${JSON.stringify(result)}\n`);
      onResult(result as CheckResult);
    });
  }

  private async execute(
    command: 'discover' | 'check', target: string, cwd: string, signal: AbortSignal,
    onEvent: (event: CliEvent) => void
  ): Promise<CliCompletion> {
    if (signal.aborted) return { exitCode: 143, interrupted: true };
    const args = [command, target, ...(command === 'check' ? ['--solver-timeout', '1s'] : []), '--json'];
    this.log(`> lean-blaster ${args.map(arg => JSON.stringify(arg)).join(' ')}\n`);
    const child = spawn('lean-blaster', args, {
      cwd, shell: false, detached: process.platform !== 'win32', windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let failure: Error | undefined;
    let completion: CliCompletion | undefined;
    let termination: Promise<void> | undefined;
    let finishTermination: (() => void) | undefined;
    let killTimer: NodeJS.Timeout | undefined;
    const killGroup = (killSignal: NodeJS.Signals): void => {
      if (!child.pid) return;
      try {
        process.kill(-child.pid, killSignal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
          failure ??= new CliError(`Unable to stop lean-blaster: ${String(error)}`, true);
        }
      }
    };
    const stop = (): void => {
      if (termination || !child.pid) return;
      termination = new Promise<void>(resolve => { finishTermination = resolve; });
      if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.once('error', error => {
          failure ??= new CliError(`Unable to stop lean-blaster: ${error.message}`, true);
          finishTermination?.();
        });
        killer.once('close', () => finishTermination?.());
      } else {
        killGroup('SIGTERM');
        killTimer = setTimeout(() => {
          killGroup('SIGKILL');
          finishTermination?.();
        }, 2000);
      }
    };
    const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => {
      child.once('error', error => {
        const code = (error as NodeJS.ErrnoException).code;
        failure = new CliError(code === 'ENOENT'
          ? 'lean-blaster was not found. Install it on the PATH inherited by VS Code, then retry.'
          : `Unable to start lean-blaster: ${error.message}`, true);
      });
      child.once('close', (code, exitSignal) => {
        if (killTimer && child.pid) {
          try {
            process.kill(-child.pid, 0);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
              clearTimeout(killTimer);
              finishTermination?.();
            }
          }
        }
        resolve({ code, signal: exitSignal });
      });
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (text: string) => this.log(text));
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    lines.on('line', line => {
      if (!line.trim() || failure || signal.aborted) return;
      try {
        const value: unknown = JSON.parse(line);
        if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.event !== 'string') {
          throw new CliError('Unsupported lean-blaster JSON protocol. Install a compatible CLI (schema version 1).', true);
        }
        if (completion) throw new CliError('lean-blaster emitted data after completion.', true);
        const event = value as CliEvent;
        if (this.trace()) this.log(`> ${line}\n`);
        if (command === 'discover' && event.event === 'moduleStart') {
          if (typeof event.module !== 'string') {
            throw new CliError('Invalid discovery progress event from lean-blaster.', true);
          }
          this.log(`> Discovering ${event.module}\n`);
        } else if (event.event === 'complete') {
          if (!isNatural(event.exitCode) || (event.interrupted !== undefined && typeof event.interrupted !== 'boolean')) {
            throw new CliError('Invalid completion event from lean-blaster.', true);
          }
          completion = { exitCode: event.exitCode, interrupted: event.interrupted === true };
        } else if (event.event === 'diagnostic') {
          if (!isRecord(event.diagnostic) || typeof event.diagnostic.message !== 'string' ||
              typeof event.diagnostic.severity !== 'string') {
            throw new CliError('Invalid diagnostic from lean-blaster.', true);
          }
          this.log(`${JSON.stringify(event.diagnostic)}\n`);
        }
        onEvent(event);
      } catch (error) {
        failure = error instanceof CliError ? error : new CliError(`Invalid lean-blaster output: ${String(error)}`, true);
        stop();
      }
    });
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
    try {
      const exit = await closed;
      await termination;
      this.log(`> lean-blaster exited: ${exit.code}${exit.signal ? ` (${exit.signal})` : ''}\n`);
      if (failure) throw failure;
      if (signal.aborted && (!completion || exit.signal || completion.exitCode !== exit.code)) {
        return { exitCode: exit.code ?? 143, interrupted: true };
      }
      if (!completion || exit.signal || completion.exitCode !== exit.code) {
        throw new CliError(`lean-blaster ended without a consistent completion event (exit ${exit.code}, signal ${exit.signal}).`);
      }
      if (completion.exitCode === 2) {
        throw new CliError('lean-blaster rejected the command. See Blaster Output and install a compatible CLI.', true);
      }
      return completion;
    } finally {
      signal.removeEventListener('abort', stop);
      lines.close();
      if (killTimer) clearTimeout(killTimer);
    }
  }
}