import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';

import { getBinaryPath } from '../utils/binary';

type TestTreeParams = {
	testTreePaths: string[];
}

type RunTestParams = {
	testIds: string[];
}

type FetchTestResultParams = {
	testId: string;
}
  
export default class RpcClient {
  private childProcess: cp.ChildProcess;
  private connection: rpc.MessageConnection;

  constructor(context: vscode.ExtensionContext) {
    this.childProcess = cp.spawn(context.asAbsolutePath(getBinaryPath()));

    this.childProcess.stdout?.on('data', (data) => {
      console.log(`\nRPC STDOUT>\n${data}`);
      return data;
    });
    
    this.childProcess.stderr?.on('data', (data) => {
      console.log(`\nRPC STDERR>\n${data}`);
      return data;
    });
    
    this.connection = rpc.createMessageConnection(
      new rpc.StreamMessageReader(this.childProcess.stdout!),
      new rpc.StreamMessageWriter(this.childProcess.stdin!)
    );

    this.connection.listen();

    this.connection.trace(rpc.Trace.Verbose, {
      log: (message: string, data?: string) => {
        console.log(`\nRPC TRACE>\n${message}\n${data}`);
      }
    });
  }

  public async initialize(): Promise<void> {
    // TODO: Implement handling of workspace changes
    // context.extension.subscriptions.push(
    //   vscode.workspace.onDidChangeWorkspaceFolders(async () => {
    //     await this.updateWorkspace(vscode.workspace.workspaceFolders || []);
    //   })
    // );

    return await new Promise<void>((resolve) =>
      this.connection.onNotification('serverReady', resolve)
    );
  }

  public onTestResult(callback: (result: TestResult) => void): void {
    this.connection.onNotification('testResult', (result: TestResult) => {
      callback(result);
    });
  }

  // TODO: Implement handling of workspace changes
  // public onWorkspaceUpdate(callback: (workspaces: Workspace[]) => void): void {
  //   this.connection.onNotification('workspaceUpdated', (workspaces: Workspace[]) => {
  //     callback(workspaces);
  //   });
  // }

  public async buildTestTree(): Promise<TestTree[]> {
    const request = new rpc.RequestType<TestTreeParams, TestTree[], void>('buildTestTree');
    const testTreePaths = vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) || [];
    return await this.connection.sendRequest(request, { testTreePaths });
  }
	
  // TODO: Implement handling of workspace changes
  // private async updateWorkspace(workspaces: readonly vscode.WorkspaceFolder[]): Promise<void> {
  //   const notification = new rpc.NotificationType<WorkspaceParams>('updateWorkspace');
  //   const testTreePaths = workspaces?.map(folder => folder.uri.fsPath) || [];
  //   return this.connection.sendNotification(notification, { testTreePaths });
  // }
	
  // public async fetchTestTree(): Promise<TestTree[]> {
  //   const request = new rpc.RequestType<void, TestTree[], void>('getTestTree');
  //   return await this.connection.sendRequest(request, null);
  // }

  public runTest(testIds: string[]): void {
    const notification = new rpc.NotificationType<RunTestParams>('runTest');
    this.connection.sendNotification(notification, { testIds });
  }

  public async fetchTestResult(testId: string): Promise<TestResult> {
    const request = new rpc.RequestType<FetchTestResultParams, TestResult, void>('getTestResult');
    return await this.connection.sendRequest(request, { testId });
  }
}