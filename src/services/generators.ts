import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { detectLanguages } from './generators/project';
import { LIST_GENERATORS_SCRIPT, parseGenerators, toHaskellTest } from './generators/discover';
import { BlasterContext } from '../extension';

/**
 * Haskell (Plinth) discovery: runs the project's own list-generators.js and turns its generators
 * into tree nodes (workspace → generator → property). Builds nothing and runs no Haskell tooling.
 */
export default class Generators {
  private context: BlasterContext = {} as BlasterContext;
  private targets: Map<string, Set<string>> = new Map();

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
    return fileErrors;
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
