import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { createInterface } from 'node:readline';

export type BundleRecord = {
  path: string;
  encoding: 'utf8' | 'base16';
  content: string;
};

export type Bundle = {
  records: Array<BundleRecord>;
  generatedAt: number;
};

export type AssuranceProperty = {
  id: string;
  title?: string;
  content?: string;
  checkingContext?: string;
  scope?: string;
};

type BundleLog = {
  appendLine: (line: string) => void;
  append: (text: string) => void;
};

/**
 * Tells whether a value is a plain object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses one stdout line of `--ndjson` bundle output. Returns undefined for anything that isn't a
 * well-formed artifact record (e.g. a Nix shell hook message printed on stdout).
 */
export function parseBundleLine(line: string): BundleRecord | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!isRecord(value) || typeof value.path !== 'string' || value.path === '' || typeof value.content !== 'string') return undefined;
  if (value.encoding !== 'utf8' && value.encoding !== 'base16') return undefined;
  return { path: value.path, encoding: value.encoding, content: value.content };
}

/**
 * Returns the exact bytes of a bundle record, as the generator wrote them (hash references depend on it).
 */
export function getRecordBytes(record: BundleRecord): Buffer {
  return record.encoding === 'utf8' ? Buffer.from(record.content, 'utf8') : Buffer.from(record.content, 'hex');
}

/**
 * Reads the properties of the bundle's generated assurance.json: id, `statement.text` (title) and
 * `statement.formal.source` (content). Throws when the document is missing or malformed.
 */
export function getAssuranceProperties(records: Array<BundleRecord>): Array<AssuranceProperty> {
  const record = records.find(isAssuranceRecord);
  if (!record) throw new Error('The generated bundle has no assurance.json.');
  let document: unknown;
  try {
    document = JSON.parse(record.content);
  } catch (error) {
    throw new Error(`Unable to read the generated assurance.json: ${String(error)}`);
  }
  if (!isRecord(document) || !Array.isArray(document.properties)) {
    throw new Error('The generated assurance.json has no properties array.');
  }
  return document.properties.map(toAssuranceProperty);
}

/**
 * Tells whether a record is the bundle's assurance document.
 */
function isAssuranceRecord(record: BundleRecord): boolean {
  return record.path === 'assurance.json' && record.encoding === 'utf8';
}

/**
 * Turns one assurance `properties[]` entry into its id, title and content.
 */
function toAssuranceProperty(value: unknown, index: number): AssuranceProperty {
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new Error(`The generated assurance.json has an invalid property at index ${index}.`);
  }
  const statement = isRecord(value.statement) ? value.statement : {};
  const formal = isRecord(statement.formal) ? statement.formal : {};
  return {
    id: value.id,
    title: typeof statement.text === 'string' ? statement.text : undefined,
    content: typeof formal.source === 'string' ? formal.source : undefined,
    checkingContext: typeof value.checkingContext === 'string' ? value.checkingContext : undefined,
    scope: getScopeNames(value.scope),
  };
}

/**
 * Returns the names in an assurance `scope` (`validators`, else `functions`), comma-separated.
 */
function getScopeNames(scope: unknown): string | undefined {
  if (!isRecord(scope)) return undefined;
  const names = Array.isArray(scope.validators) ? scope.validators : scope.functions;
  if (!Array.isArray(names)) return undefined;
  const strings: Array<string> = [];
  for (const name of names) {
    if (typeof name === 'string') strings.push(name);
  }
  return strings.length > 0 ? strings.join(', ') : undefined;
}

/**
 * Returns the path of a property's checking context record (`checking-<checkingContext>.json`), as named
 * by the generated assurance.json. Throws when the property or its context isn't in the bundle.
 */
export function getCheckingContextPath(records: Array<BundleRecord>, propertyId: string): string {
  let checkingContext: string | undefined;
  for (const property of getAssuranceProperties(records)) {
    if (property.id === propertyId) checkingContext = property.checkingContext;
  }
  if (checkingContext === undefined) {
    throw new Error(`The generated assurance.json has no checking context for ${propertyId}.`);
  }
  const path = `checking-${checkingContext}.json`;
  if (findRecord(records, path) === undefined) {
    throw new Error(`The generated bundle has no ${path}.`);
  }
  return path;
}

/**
 * Returns the bundle record with the given path.
 */
export function findRecord(records: Array<BundleRecord>, path: string): BundleRecord | undefined {
  for (const record of records) {
    if (record.path === path) return record;
  }
  return undefined;
}

/**
 * Kills a process and its children (cabal run starts the generator as a child).
 */
function killTree(pid: number): void {
  if (process.platform === 'win32') {
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], ignoreKillError);
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // Already exited.
  }
}

/**
 * Ignores taskkill failures: the process may already have exited.
 */
function ignoreKillError(): void {}

/**
 * Tells whether a command can be started: a path that exists, or a name found in one of the PATH folders.
 */
export function isOnPath(command: string, path: string = process.env.PATH ?? ''): boolean {
  if (command.includes('/') || command.includes('\\')) return existsSync(command);
  const names = process.platform === 'win32' ? [command, `${command}.exe`] : [command];
  for (const dir of path.split(delimiter)) {
    if (dir === '') continue;
    for (const name of names) {
      if (existsSync(join(dir, name))) return true;
    }
  }
  return false;
}

/**
 * Runs the argv inside the project's Nix dev shell (`nix develop . --accept-flake-config -c …`) when its command isn't on PATH
 * but the cwd has a flake.nix and nix is installed, so VS Code doesn't have to be started from the shell.
 * Returns the argv unchanged otherwise.
 */
export function withDevShell(argv: Array<string>, cwd: string, path: string = process.env.PATH ?? ''): Array<string> {
  if (isOnPath(argv[0], path)) return argv;
  if (!existsSync(join(cwd, 'flake.nix')) || !isOnPath('nix', path)) return argv;
  return ['nix', 'develop', '.', '--accept-flake-config', '-c', ...argv];
}

/**
 * Runs a generator's argv from its cwd and collects its `--ndjson` records. stderr and any stdout line
 * that isn't a record go to the log. Rejects on a non-zero exit, a missing command or an abort, so a
 * partial bundle is never returned.
 */
export function generateBundle(argv: Array<string>, cwd: string, log: BundleLog, signal: AbortSignal): Promise<Bundle> {
  signal.throwIfAborted();
  const resolved = withDevShell(argv, cwd);
  const [command, ...args] = resolved;
  log.appendLine(`> ${resolved.join(' ')}  (in ${cwd})`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, detached: process.platform !== 'win32' });
    const records: Array<BundleRecord> = [];
    let failure: Error | undefined;

    /** Kills the generator when the pass is cancelled. */
    const handleAbort = (): void => {
      if (child.pid !== undefined) killTree(child.pid);
    };

    /** Keeps an artifact record, or logs a line that isn't one. */
    const handleLine = (line: string): void => {
      const record = parseBundleLine(line);
      if (record) records.push(record);
      else if (line.trim() !== '') log.appendLine(line);
    };

    /** Forwards the generator's stderr to the log. */
    const handleStderr = (text: string): void => {
      log.append(text);
    };

    /** Explains a generator that couldn't be started. */
    const handleError = (error: NodeJS.ErrnoException): void => {
      failure = error.code === 'ENOENT'
        ? new Error(`${command} not found on PATH, and the project has no Nix flake (flake.nix + nix) to load it from. Install the project's Haskell tools (cabal, ghc) or Nix.`)
        : error;
    };

    /** Settles once the generator exited. */
    const handleClose = (code: number | null, exitSignal: NodeJS.Signals | null): void => {
      signal.removeEventListener('abort', handleAbort);
      if (signal.aborted) reject(signal.reason);
      else if (failure) reject(failure);
      else if (code !== 0) reject(new Error(`Generator failed (exit ${code ?? exitSignal}). See Blaster output.`));
      else resolve({ records, generatedAt: Date.now() });
    };

    signal.addEventListener('abort', handleAbort, { once: true });
    child.stderr.setEncoding('utf8').on('data', handleStderr);
    createInterface({ input: child.stdout }).on('line', handleLine);
    child.on('error', handleError);
    child.on('close', handleClose);
  });
}
