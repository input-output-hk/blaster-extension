import * as vscode from 'vscode';
import { queue } from 'async';

import Command from './command';
import Database from './database';
import { BlasterContext } from '../extension';

import type { QueueObject } from 'async';

export default class TestStore {
  private context: BlasterContext = {} as BlasterContext;
  private command: Command;
  private database: Database;
  private eventQueue: QueueObject<TestEvent>;

  private isTestTreeFetched: boolean = false;
  private testTreeOpenState: Record<string, boolean> = {};
  private discoveryError: string | undefined;
  private discoveryFileErrors: Array<DiscoveryFileError> = [];

  constructor(context: vscode.ExtensionContext) {
    this.command = new Command();
    this.database = new Database();
    this.eventQueue = queue<TestEvent>(this.handleTestEvent.bind(this), 1);
  }

  public async initialize(context: BlasterContext): Promise<void> {
    this.context = context;

    await this.database.initialize();
    await this.command.initialize(context);

    this.command.onTestEvent(this.eventQueue.push);
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

  public async fetchTestTree(): Promise<TestTree> {
    try {
      const { testTree, fileErrors } = await this.command.discover();
      const storedTestTree = await this.database.storeTestTree(testTree, this.testTreeOpenState);
      this.discoveryError = undefined;
      this.discoveryFileErrors = fileErrors;
      this.isTestTreeFetched = true;
      return this.applyFileErrors(storedTestTree);
    } catch (error) {
      this.discoveryError = error instanceof Error ? error.message : String(error);
      throw error;
    }
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
    for (const { workspaceId: errorWorkspaceId, group, message } of this.discoveryFileErrors) {
      if (errorWorkspaceId !== workspaceId) continue;
      let currentNodes = nodes;
      for (let index = 0; index < group.length; index++) {
        const name = group[index];
        const isFile = index === group.length - 1;
        const isOpen = this.testTreeOpenState[[workspaceId, ...group.slice(0, index + 1)].join(':')] ?? false;
        const node = currentNodes[name] ??= isFile
          ? { type: 'file', name, isOpen, tests: {} } as TestTreeFileNode
          : { type: 'folder', name, isOpen, nodes: {} } as TestTreeFolderNode;
        if (isFile) {
          if (node.type === 'file') {
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
    const runs = this.command.prepareTestRuns(testRuns);
    await this.database.handleTestRun(runs);
    this.command.runTests(runs);
  }

  public async runAllTests(): Promise<void> {
    await this.runTests();
  }

  public async clearTestResults(): Promise<void> {
    await this.database.clearTestResults();
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
