import * as vscode from 'vscode';
import { queue } from 'async';

import Command from './command';
import Generators from './generators';
import Database from './database';
import { BlasterContext } from '../extension';

import type { QueueObject } from 'async';

type TestAction = {
  type: TestActionType;
  controller: AbortController;
  startedAt: number;
  execute: () => Promise<void>;
  reject: (error: unknown) => void;
};

export default class TestStore {
  private context: BlasterContext = {} as BlasterContext;
  private command: Command;
  private generators: Generators;
  private database: Database;
  private eventQueue: QueueObject<TestEvent>;
  private actionQueue: QueueObject<TestAction>;
  private currentAction?: TestAction;
  private run?: TestTreeActionState['run'];
  private testEventError?: Error;
  private actionStateEmitter = new vscode.EventEmitter<TestTreeActionState>();
  public readonly onActionStateUpdate = this.actionStateEmitter.event;

  private isTestTreeFetched: boolean = false;
  private testTreeOpenState: Record<string, boolean> = {};
  private discoveryError: string | undefined;
  private discoveryFileErrors: Array<DiscoveryFileError> = [];
  private isBlasterMissing: boolean = false;

  constructor(context: vscode.ExtensionContext) {
    this.command = new Command();
    this.generators = new Generators();
    this.database = new Database();
    this.eventQueue = queue<TestEvent>(this.handleTestEvent.bind(this), 1);
    this.actionQueue = queue<TestAction>(this.handleAction.bind(this), 1);
  }

  public async initialize(context: BlasterContext): Promise<void> {
    this.context = context;

    await this.database.initialize();
    await this.command.initialize(context);
    this.generators.initialize(context);

    this.command.onTestEvent(event => {
      this.eventQueue.push(event, error => {
        if (error) this.testEventError ??= error;
      });
    });
    context.extension.subscriptions.push(this.actionStateEmitter, { dispose: () => this.stopAll() });
  }

  public getActionState(): TestTreeActionState {
    const action = this.currentAction;
    return {
      isBusy: action !== undefined || this.actionQueue.length() > 0,
      currentAction: action && {
        type: action.type,
        startedAt: action.startedAt,
        isCancelling: action.controller.signal.aborted
      },
      run: this.run && { ...this.run }
    };
  }

  private enqueueAction<T>(type: TestActionType, execute: (signal: AbortSignal) => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const controller = new AbortController();
      let result: T;
      this.actionQueue.push({
        type, controller, startedAt: 0, reject,
        execute: async () => {
          result = await execute(controller.signal);
          controller.signal.throwIfAborted();
        }
      }, error => {
        if (error) reject(error);
        else resolve(result);
      });
      this.actionStateEmitter.fire(this.getActionState());
    });
  }

  private async handleAction(action: TestAction): Promise<void> {
    this.currentAction = action;
    action.startedAt = Date.now();
    if (action.type === 'run') {
      this.run = { startedAt: action.startedAt };
    }
    this.actionStateEmitter.fire(this.getActionState());
    try {
      await action.execute();
    } finally {
      if (action.type === 'run' && this.run) this.run.finishedAt = Date.now();
      this.currentAction = undefined;
      this.actionStateEmitter.fire(this.getActionState());
    }
  }

  public stopAll(): void {
    const error = new vscode.CancellationError();
    this.actionQueue.remove(({ data }) => {
      data.reject(error);
      return true;
    });
    this.currentAction?.controller.abort(error);
    this.actionStateEmitter.fire(this.getActionState());
  }

  private async flushTestEvents(): Promise<void> {
    if (!this.eventQueue.idle()) await this.eventQueue.drain();
    const error = this.testEventError;
    this.testEventError = undefined;
    if (error) throw error;
  }

  private async handleTestEvent(event: TestEvent): Promise<void> {
    switch (event.type) {
      case 'test-update':
        await this.handleTestUpdateEvent(event as TestUpdateEvent);
        break;
      case 'test-result':
        await this.handleTestResultEvent(event as TestResultEvent);
        break;
      case 'test-error':
        await this.handleTestErrorEvent(event as TestErrorEvent);
        break;
      case 'test-run-failed':
        await this.handleTestRunFailedEvent(event as TestRunFailedEvent);
        break;
    }
  }

  private async handleTestUpdateEvent(event: TestUpdateEvent): Promise<void> {
    await this.database.handleTestUpdateEvent(event);
  }

  private async handleTestResultEvent(event: TestResultEvent): Promise<void> {
    await this.database.handleTestResultEvent(event);
  }

  private async handleTestErrorEvent(event: TestErrorEvent): Promise<void> {
    await this.database.handleTestErrorEvent(event);
  }

  private async handleTestRunFailedEvent(event: TestRunFailedEvent): Promise<void> {
    await this.database.handleTestRunFailedEvent(event);
  }

  public getIsBlasterMissing(): boolean {
    return this.isBlasterMissing;
  }

  // Resolves undefined when lean-blaster is not found
  public async fetchTestTree(): Promise<TestTree | undefined> {
    return this.enqueueAction('fetch', async signal => {
      try {
        this.isBlasterMissing = !(await this.command.checkDependencies(signal));
        if (this.isBlasterMissing) return undefined;
        const { testTree, fileErrors } = await this.command.discover(signal);
        signal.throwIfAborted();
        fileErrors.push(...await this.generators.discover(testTree, signal));
        signal.throwIfAborted();
        const storedTestTree = await this.database.storeTestTree(testTree, this.testTreeOpenState);
        this.discoveryError = undefined;
        this.discoveryFileErrors = fileErrors;
        this.isTestTreeFetched = true;
        this.run = undefined;
        return this.applyFileErrors(storedTestTree);
      } catch (error) {
        if (!(error instanceof vscode.CancellationError)) {
          this.isBlasterMissing = false;
          this.discoveryError = error instanceof Error ? error.message : String(error);
        }
        throw error;
      }
    });
  }

  public async getTestTree(): Promise<TestTree | undefined> {
    if (!this.isTestTreeFetched) return;
    return this.applyFileErrors(await this.database.fetchTestTree(this.testTreeOpenState));
  }

  public getDiscoveryError(): string | undefined {
    return this.discoveryError;
  }

  public getDiscoveryFileErrors(): ReadonlyArray<DiscoveryFileError> {
    return this.discoveryFileErrors;
  }

  private applyFileErrors(testTree: TestTree): TestTree {
    for (const workspace of Object.values(testTree.workspaces)) {
      this.applyWorkspaceFileErrors(workspace.id, workspace.nodes);
    }
    return testTree;
  }

  private applyWorkspaceFileErrors(workspaceId: string, nodes: GenericMap<TestTreeGroupNode>): void {
    for (const { workspaceId: errorWorkspaceId, group, message, type } of this.discoveryFileErrors) {
      if (errorWorkspaceId !== workspaceId) continue;
      let currentNodes = nodes;
      for (let index = 0; index < group.length; index++) {
        const name = group[index];
        const isFile = index === group.length - 1;
        const isOpen = this.testTreeOpenState[[workspaceId, ...group.slice(0, index + 1)].join(':')] ?? false;
        const node = currentNodes[name] ??= isFile
          ? { type: type ?? 'file', name, isOpen, tests: {} } as TestTreeFileNode
          : { type: 'folder', name, isOpen, nodes: {} } as TestTreeFolderNode;
        if (isFile) {
          if (node.type !== 'folder') {
            (node as TestTreeFileNode).error = message;
          }
        } else if (node.type === 'folder') {
          currentNodes = (node as TestTreeFolderNode).nodes;
        } else {
          break;
        }
      }
    }
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

  public async runTests(testRuns?: Array<TestRun>): Promise<void> {
    if (testRuns && this.generators.isHaskellRun(testRuns)) {
      throw new Error('Running Haskell properties is not available yet.');
    }
    return this.enqueueAction('run', async signal => {
      const runs = this.command.prepareTestRuns(testRuns);
      try {
        await this.database.handleTestRun(runs);
        signal.throwIfAborted();
        await this.command.runTests(runs, signal);
      } finally {
        // Apply already received results before releasing the next action or clearing busy flags.
        try {
          await this.flushTestEvents();
        } finally {
          await this.database.stopTests();
        }
      }
    });
  }

  public async runAllTests(): Promise<void> {
    await this.runTests();
  }

  public async clearTestResults(): Promise<void> {
    return this.enqueueAction('clear', async () => {
      await this.database.clearTestResults();
      this.run = undefined;
    });
  }

  public async getTestResult(workspaceId: string, testId: string): Promise<{ test: Test, result: TestResult }> {
    const test = await this.database.getTest(workspaceId, testId);
    const result = await this.database.getTestResult(workspaceId, testId);
    return { test, result };
  }

  public onTestTreeUpdate(callback: (payload: TestTreeUpdate) => void): void {
    this.database.onTestUpdate(callback);
    this.database.onTestTreeUpdate(this.testTreeOpenState, payload => {
      if (payload.type === 'workspace' && payload.workspace.nodes) {
        this.applyWorkspaceFileErrors(payload.workspace.id, payload.workspace.nodes);
      }
      callback(payload);
    });
  }
}
