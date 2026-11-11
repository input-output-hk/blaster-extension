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
    const discoveredTestTree = await this.command.discover();
    const storedTestTree = await this.database.storeTestTree(discoveredTestTree, this.testTreeOpenState);
    this.isTestTreeFetched = true;
    return storedTestTree;
  }

  public async getTestTree(): Promise<TestTree | undefined> {
    if (!this.isTestTreeFetched) return;
    return await this.database.fetchTestTree(this.testTreeOpenState);
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
    this.database.onTestTreeUpdate(this.testTreeOpenState, callback);
  }
}
