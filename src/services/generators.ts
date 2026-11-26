import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { detectLanguages } from './generators/project';
import { LIST_GENERATORS_SCRIPT, makeHaskellTestId, parseGenerators, toHaskellTest } from './generators/discover';
import { generateBundle, getAssuranceProperties } from './generators/bundle';
import { BlasterContext } from '../extension';

import type { ListedGenerator } from './generators/discover';
import type { AssuranceProperty, Bundle } from './generators/bundle';

type GeneratorEntry = { workspaceId: string; generator: ListedGenerator & { properties: NonNullable<ListedGenerator['properties']> } };

export type HaskellDetailsUpdate = (workspaceId: string, testId: string, details: { title?: string; content?: string }) => Promise<void>;

/**
 * Builds the map key of one generator in one workspace root.
 */
function getGeneratorKey(workspaceId: string, target: string): string {
  return `${workspaceId}\0${target}`;
}

/**
 * Returns the id of an assurance property.
 */
function getAssuranceId(property: AssuranceProperty): string {
  return property.id;
}

/**
 * Returns the id of a discovered property.
 */
function getPropertyId(property: { id: string }): string {
  return property.id;
}

/**
 * Keys an assurance property by its id.
 */
function toAssuranceEntry(property: AssuranceProperty): [string, AssuranceProperty] {
  return [property.id, property];
}

/**
 * Lists the ids that are in `ids` but not in `other`.
 */
function getMissingIds(ids: Array<string>, other: Set<string>): Array<string> {
  const missing: Array<string> = [];
  for (const id of ids) {
    if (!other.has(id)) missing.push(id);
  }
  return missing;
}

/**
 * Haskell (Plinth) support. Discovery runs the project's own list-generators.js and turns its generators
 * into tree nodes (workspace → generator → property); it builds nothing. Generation then runs each
 * generator's `cabal run … --ndjson` in the background and keeps its bundle in memory for checking (#101).
 */
export default class Generators {
  private context: BlasterContext = {} as BlasterContext;
  private targets: Map<string, Set<string>> = new Map();
  private entries: Array<GeneratorEntry> = [];
  private states: Map<string, GeneratorState> = new Map();
  private bundles: Map<string, Bundle> = new Map();
  private controller?: AbortController;
  private pass: Promise<void> = Promise.resolve();
  private listeners: Set<() => void> = new Set();

  /**
   * Keeps the extension context for the output channel.
   */
  public initialize(context: BlasterContext): void {
    this.context = context;
  }

  /**
   * Adds the generators of every Haskell root to the given tree. A root whose script is missing or fails
   * gets an error row instead, without affecting other roots. Returns those errors.
   */
  public async discover(testTree: TestTree, signal: AbortSignal): Promise<Array<DiscoveryFileError>> {
    const fileErrors: Array<DiscoveryFileError> = [];
    const targets = new Map<string, Set<string>>();
    const entries: Array<GeneratorEntry> = [];
    const states = new Map<string, GeneratorState>();

    for (const workspace of Object.values(testTree.workspaces)) {
      if (!detectLanguages(workspace.path).haskell) continue;
      const workspaceTargets = new Set<string>();
      targets.set(workspace.id, workspaceTargets);

      let generators;
      try {
        generators = parseGenerators(await this.listGenerators(workspace.path, signal));
      } catch (error) {
        signal.throwIfAborted();
        const message = error instanceof Error ? error.message : String(error);
        this.context.outputChannel.appendLine(`> ERROR ${message}`);
        fileErrors.push({ workspaceId: workspace.id, group: [LIST_GENERATORS_SCRIPT], message });
        continue;
      }

      for (const generator of generators) {
        workspaceTargets.add(generator.target);
        if (generator.properties === null) {
          const message = generator.propertyDiscoveryError ?? 'Unable to list properties.';
          fileErrors.push({ workspaceId: workspace.id, group: [generator.target], message, type: 'generator' });
          continue;
        }
        entries.push({ workspaceId: workspace.id, generator: { ...generator, properties: generator.properties } });
        states.set(getGeneratorKey(workspace.id, generator.target), { kind: 'pending' });
        const tests: GenericMap<Test> = {};
        for (const [index, property] of generator.properties.entries()) {
          const test = toHaskellTest(workspace.id, generator, property, index);
          tests[test.id] = test;
        }
        workspace.nodes[generator.target] = {
          type: 'generator', name: generator.target, isOpen: false, tests
        } as TestTreeGeneratorNode;
      }
    }

    this.targets = targets;
    this.entries = entries;
    this.states = states;
    return fileErrors;
  }

  /**
   * Starts generating the bundles of the last discovered generators, one at a time, in the background.
   * Cancels a pass already running. Template properties get their title and content through `onDetails`.
   */
  public generate(onDetails: HaskellDetailsUpdate): void {
    this.stop();
    const controller = new AbortController();
    this.controller = controller;
    this.pass = this.runPass(this.entries, onDetails, controller.signal);
  }

  /**
   * Cancels the running generation pass and kills its generator. Unfinished generators go back to pending.
   */
  public stop(): void {
    this.controller?.abort();
    this.controller = undefined;
  }

  /**
   * Resolves once the current generation pass has finished or been cancelled.
   */
  public whenGenerated(): Promise<void> {
    return this.pass;
  }

  /**
   * Returns the generation state of a generator, if it was discovered with properties.
   */
  public getState(workspaceId: string, target: string): GeneratorState | undefined {
    return this.states.get(getGeneratorKey(workspaceId, target));
  }

  /**
   * Returns the last generated bundle of a generator (kept for checking, #101).
   */
  public getBundle(workspaceId: string, target: string): Bundle | undefined {
    return this.bundles.get(getGeneratorKey(workspaceId, target));
  }

  /**
   * Calls `callback` whenever a generator's state changes.
   */
  public onStateChange(callback: () => void): void {
    this.listeners.add(callback);
  }

  /**
   * Sets a generator's state and notifies the listeners.
   */
  private setState(workspaceId: string, target: string, state: GeneratorState): void {
    this.states.set(getGeneratorKey(workspaceId, target), state);
    for (const listener of this.listeners) listener();
  }

  /**
   * Generates every pending generator in order. A failure only affects its own generator.
   */
  private async runPass(entries: Array<GeneratorEntry>, onDetails: HaskellDetailsUpdate, signal: AbortSignal): Promise<void> {
    for (const { workspaceId, generator } of entries) {
      if (signal.aborted) return;
      if (this.getState(workspaceId, generator.target)?.kind !== 'pending') continue;
      this.setState(workspaceId, generator.target, { kind: 'generating' });
      try {
        const bundle = await generateBundle(generator.argv, generator.cwd, this.context.outputChannel, signal);
        const properties = getAssuranceProperties(bundle.records);
        this.checkPropertyIds(generator, properties);
        this.bundles.set(getGeneratorKey(workspaceId, generator.target), bundle);
        await this.updateTemplates(workspaceId, generator, properties, onDetails);
        this.setState(workspaceId, generator.target, { kind: 'ready' });
      } catch (error) {
        if (signal.aborted) {
          this.setState(workspaceId, generator.target, { kind: 'pending' });
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        this.context.outputChannel.appendLine(`> ERROR ${generator.target}: ${message}`);
        this.setState(workspaceId, generator.target, { kind: 'error', message });
      }
    }
  }

  /**
   * Throws when the generated assurance.json doesn't list the same properties as discovery found in the source.
   */
  private checkPropertyIds(generator: GeneratorEntry['generator'], properties: Array<AssuranceProperty>): void {
    const discovered = generator.properties.map(getPropertyId);
    const generated = properties.map(getAssuranceId);
    const missing = getMissingIds(discovered, new Set(generated));
    const extra = getMissingIds(generated, new Set(discovered));
    if (missing.length === 0 && extra.length === 0) return;
    const parts: Array<string> = [];
    if (missing.length > 0) parts.push(`not generated: ${missing.join(', ')}`);
    if (extra.length > 0) parts.push(`not found in the source: ${extra.join(', ')}`);
    throw new Error(`The generated assurance.json doesn't match the source annotations (${parts.join('; ')}).`);
  }

  /**
   * Fills in the title and content of template properties from the generated assurance.json.
   */
  private async updateTemplates(
    workspaceId: string,
    generator: GeneratorEntry['generator'],
    properties: Array<AssuranceProperty>,
    onDetails: HaskellDetailsUpdate
  ): Promise<void> {
    const generated = new Map(properties.map(toAssuranceEntry));
    for (const property of generator.properties) {
      if (property.kind !== 'template') continue;
      const details = generated.get(property.id);
      if (details === undefined) continue;
      await onDetails(workspaceId, makeHaskellTestId(generator.target, property.id), { title: details.title, content: details.content });
    }
  }

  /**
   * Tells whether a run selects any Haskell generator. Running Haskell properties isn't available yet (#101).
   */
  public isHaskellRun(testRuns: Array<TestRun>): boolean {
    for (const { workspaceId, tests } of testRuns) {
      const targets = this.targets.get(workspaceId);
      for (const { uri } of tests ?? []) {
        if (targets?.has(uri)) return true;
      }
    }
    return false;
  }

  /**
   * Runs `node scripts/blueprints/list-generators.js <root>` from the root and resolves its stdout.
   * Uses VS Code's own Node (ELECTRON_RUN_AS_NODE), so no Node install is needed.
   */
  private listGenerators(root: string, signal: AbortSignal): Promise<string> {
    signal.throwIfAborted();
    const script = join(root, LIST_GENERATORS_SCRIPT);
    if (!existsSync(script)) {
      return Promise.reject(new Error(`${LIST_GENERATORS_SCRIPT} not found in ${root}. Haskell properties are listed by the project's generator script.`));
    }
    this.context.outputChannel.appendLine(`> node ${LIST_GENERATORS_SCRIPT} ${root}`);

    return new Promise((resolve, reject) => {
      /** Settles with stdout, or with the script's error message (stderr also goes to the output channel). */
      const handleExit = (error: Error | null, stdout: string, stderr: string): void => {
        if (stderr) this.context.outputChannel.append(stderr);
        if (signal.aborted) reject(signal.reason);
        else if (error) reject(new Error(`${LIST_GENERATORS_SCRIPT} failed: ${stderr.trim() || error.message}`));
        else resolve(stdout);
      };
      execFile(process.execPath, [script, root], {
        cwd: root,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        maxBuffer: 64 * 1024 * 1024,
        signal,
      }, handleExit);
    });
  }
}
