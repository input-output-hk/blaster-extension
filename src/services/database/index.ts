import { addRxPlugin, createRxDatabase, RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';

import { databaseCollections, type DatabaseCollections } from './collections';

import {
  getTest,
  getTestResult,
  fetchTestTree,
  storeTestTree,
  clearTestResults,
  onTestUpdate,
  onTestTreeUpdate,
  handleTestRun,
  handleTestRunAll,
  handleTestRunFailedEvent,
  handleTestUpdateEvent,
  handleTestResultEvent,
  handleTestErrorEvent
} from './methods';

addRxPlugin(RxDBUpdatePlugin);

export default class Database {
  private database: RxDatabase<DatabaseCollections> | null = null;

  public async initialize(): Promise<void> {
    this.database = await createRxDatabase<DatabaseCollections>({
      name: 'blaster',
      storage: getRxStorageMemory()
    });

    await this.database.addCollections(databaseCollections);
  }

  public async handleTestUpdateEvent(event: TestUpdateEvent): Promise<void> {
    return await handleTestUpdateEvent(this.database!, event);
  }

  public async handleTestResultEvent(event: TestResultEvent): Promise<void> {
    return await handleTestResultEvent(this.database!, event);
  }

  public async handleTestErrorEvent(event: TestErrorEvent): Promise<void> {
    return await handleTestErrorEvent(this.database!, event);
  }

  public async handleTestRunFailedEvent(event: TestRunFailedEvent): Promise<void> {
    return await handleTestRunFailedEvent(this.database!, event);
  }

  public async fetchTestTree(openState: Record<string, boolean>): Promise<TestTree> {
    return await fetchTestTree(this.database!, openState);
  }

  public async storeTestTree(testTree: TestTree, openState: Record<string, boolean>): Promise<TestTree> {
    return await storeTestTree(this.database!, testTree, openState);
  }

  public async clearTestResults(): Promise<void> {
    return await clearTestResults(this.database!);
  }

  public async handleTestRun(testRuns: Array<TestRun>): Promise<void> {
    return await handleTestRun(this.database!, testRuns);
  }

  public async handleTestRunAll(): Promise<void> {
    return await handleTestRunAll(this.database!);
  }

  public async getTest(workspaceId: string, testId: string): Promise<Test> {
    return await getTest(this.database!, workspaceId, testId);
  }

  public async getTestResult(workspaceId: string, testId: string): Promise<TestResult> {
    return await getTestResult(this.database!, workspaceId, testId);
  }

  public onTestUpdate(callback: (payload: TestTreeUpdate) => void): void {
    return onTestUpdate(this.database!, callback);
  }

  public onTestTreeUpdate(openState: Record<string, boolean>, callback: (payload: TestTreeUpdate) => void): void {
    return onTestTreeUpdate(this.database!, openState, callback);
  }
}
