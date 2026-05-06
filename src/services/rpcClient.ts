import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';

import { getBinaryPath } from '../utils/binary';
  
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

    await new Promise<void>((resolve) =>
      this.connection.onNotification('serverReady', resolve)
    );

    const promise = new Promise<void>((resolve) =>
      this.connection.onNotification('workspaceInitialized', resolve)
    );

    await this.initializeWorkspace(vscode.workspace.workspaceFolders || []);

    // TODO: Implement handling of workspace changes
    // context.extension.subscriptions.push(
    //   vscode.workspace.onDidChangeWorkspaceFolders(async () => {
    //     await this.updateWorkspace(vscode.workspace.workspaceFolders || []);
    //   })
    // );

    return promise;
  }

  public onTestResult(callback: (result: TheoremResult) => void): void {
    this.connection.onNotification('testResult', (result: TheoremResult) => {
      callback(result);
    });
  }

  // TODO: Implement handling of workspace changes
  // public onWorkspaceUpdate(callback: (workspaces: Workspace[]) => void): void {
  //   this.connection.onNotification('workspaceUpdated', (workspaces: Workspace[]) => {
  //     callback(workspaces);
  //   });
  // }

  private async initializeWorkspace(workspaces: readonly vscode.WorkspaceFolder[]): Promise<void> {
    const notification = new rpc.NotificationType<WorkspaceParams>('initializeWorkspace');
    const workspacePaths = workspaces?.map(folder => folder.uri.fsPath) || [];
    return this.connection.sendNotification(notification, { workspacePaths });
  }
	
  // TODO: Implement handling of workspace changes
  // private async updateWorkspace(workspaces: readonly vscode.WorkspaceFolder[]): Promise<void> {
  //   const notification = new rpc.NotificationType<WorkspaceParams>('updateWorkspace');
  //   const workspacePaths = workspaces?.map(folder => folder.uri.fsPath) || [];
  //   return this.connection.sendNotification(notification, { workspacePaths });
  // }
	
  public async fetchWorkspaces(): Promise<Workspace[]> {
    const request = new rpc.RequestType<void, Workspace[], void>('getWorkspace');
    return await this.connection.sendRequest(request, null);
  }

  public runTheorem(theoremIds: string[]): void {
    const notification = new rpc.NotificationType<RunTheoremParams>('runTheorem');
    this.connection.sendNotification(notification, { theoremIds });
  }

  public async fetchTheoremResult(theoremId: string): Promise<TheoremResult> {
    const request = new rpc.RequestType<FetchTheoremResultParams, TheoremResult, void>('getTheoremResult');
    return await this.connection.sendRequest(request, { theoremId });
  }
}