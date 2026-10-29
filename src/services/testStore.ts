import * as vscode from 'vscode';
import { createHash } from 'node:crypto';
import { queue } from 'async';

import RpcClient from './rpcClient';
import Database from './database';
import { BlasterContext } from '../extension';

import type { QueueObject } from 'async';

export default class TestStore {
  private context: BlasterContext = {} as BlasterContext;
  private database: Database;
  private rpcClient: RpcClient;
  private eventQueue: QueueObject<() => Promise<void>>;
  private subscriptions: Array<vscode.Disposable> = [];
  private disposePromise: Promise<void> | null = null;

  private workspaces: Map<string, Workspace>;
  private isTestTreeFetched: boolean = false;
  private testTreeOpenState: Record<string, boolean> = {};

  constructor(context: vscode.ExtensionContext) {
    this.rpcClient = new RpcClient(context);
    this.database = new Database();
    this.eventQueue = queue<() => Promise<void>>(async operation => { await operation(); }, 1);

    this.workspaces = new Map(
      vscode.workspace.workspaceFolders?.map(folder => [
        this.makeWorkspaceId(folder.uri.fsPath),
        {
          id: this.makeWorkspaceId(folder.uri.fsPath),
          path: folder.uri.fsPath
        }
      ]) || []
    );
  }

  private makeWorkspaceId(workspacePath: string): string {
    return createHash('sha256').update(workspacePath).digest('hex').slice(0, 8);
  }

  public async initialize(context: BlasterContext): Promise<void> {
    this.context = context;

    await this.database.initialize();
    await this.rpcClient.initialize(context);

    this.rpcClient.onTestEvent(event => {
      void this.eventQueue.pushAsync(() => this.handleTestEvent(event)).catch(error => {
        context.outputChannel.appendLine(`> ERROR processing test event: ${String(error)}`);
      });
    });
    this.rpcClient.onDisconnect(() => {
      void this.eventQueue.pushAsync(() => this.database.failPendingTests()).catch(error => {
        context.outputChannel.appendLine(`> ERROR clearing pending tests: ${String(error)}`);
      });
    });
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

  public async fetchTestTree(): Promise<TestTree> {
    this.workspaces = new Map(
      vscode.workspace.workspaceFolders?.map(folder => [
        this.makeWorkspaceId(folder.uri.fsPath),
        {
          id: this.makeWorkspaceId(folder.uri.fsPath),
          path: folder.uri.fsPath
        }
      ]) || []
    );

    const { testTree } = await this.rpcClient.fetchTestTree({
      workspaces: Array.from(this.workspaces.values())
    });

    let storedTree = testTree;
    await this.eventQueue.pushAsync(async () => {
      storedTree = await this.database.storeTestTree(testTree, this.testTreeOpenState);
    });
    this.isTestTreeFetched = true;
    return storedTree;
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

  public async runTests(testRuns: Array<TestRun>): Promise<void> {
    if (!this.isTestTreeFetched) throw new Error('Discover tests before running them.');
    const params: RpcRunParams = {
      testRuns: testRuns.map(testRun => {
        const workspace = this.workspaces.get(testRun.workspaceId);
        if (!workspace) throw new Error(`Unknown workspace: ${testRun.workspaceId}`);
        return { workspacePath: workspace.path, testIds: testRun.testIds };
      })
    };
    await this.eventQueue.pushAsync(async () => {
      await this.database.handleTestRun(testRuns);
      try {
        await this.rpcClient.testRun(params);
      } catch (error) {
        await this.database.failPendingTests();
        throw error;
      }
    });
  }

  public async runAllTests(): Promise<void> {
    const testRuns = Array.from(this.workspaces.values()).map(v => ({ workspaceId: v.id }));
    await this.runTests(testRuns);
  }

  public async clearTestResults(): Promise<void> {
    await this.eventQueue.pushAsync(() => this.database.clearTestResults());
  }

  public async getTestResult(workspaceId: string, testId: string): Promise<{ test: Test, result: TestResult }> {
    const test = await this.database.getTest(workspaceId, testId);
    const result = await this.database.getTestResult(workspaceId, testId);
    return { test, result };
  }

  public onTestTreeUpdate(callback: (payload: TestTreeUpdate) => void): vscode.Disposable {
    const unsubscribeTests = this.database.onTestUpdate(callback);
    const unsubscribeTree = this.database.onTestTreeUpdate(this.testTreeOpenState, callback);
    const subscription = new vscode.Disposable(() => {
      unsubscribeTests();
      unsubscribeTree();
    });
    this.subscriptions.push(subscription);
    return subscription;
  }

  public dispose(): Promise<void> {
    if (!this.disposePromise) {
      this.disposePromise = (async () => {
        for (const subscription of this.subscriptions) subscription.dispose();
        await this.rpcClient.dispose();
        if (!this.eventQueue.idle()) await this.eventQueue.drain();
        await this.database.dispose();
      })();
    }
    return this.disposePromise;
  }
}
