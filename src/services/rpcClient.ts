import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';

import { AfvContext } from '../extension';

class RpcClient {
  private childProcess: cp.ChildProcess;
  private connection: rpc.MessageConnection;

  constructor(context: vscode.ExtensionContext) {
    this.childProcess = cp.spawn('node', [context.asAbsolutePath('server/out/server.js')]);
    this.connection = rpc.createMessageConnection(
      new rpc.StreamMessageReader(this.childProcess.stdout!),
      new rpc.StreamMessageWriter(this.childProcess.stdin!)
    );
    this.connection.listen();
  }

  public async initialize(context: AfvContext): Promise<void> {
    const promise = new Promise<void>((resolve) =>
      this.connection.onNotification('workspaceInitialized', resolve)
    );

    await this.initializeWorkspace(vscode.workspace.workspaceFolders || []);

    // TODO: Add listeners for workspace changes

    return promise;
  }

  public onTestResult(callback: (result: TheoremResult) => void): void {
    this.connection.onNotification('testResult', (result: TheoremResult) => {
      callback(result);
    });
  }

  private async initializeWorkspace(workspaces: readonly vscode.WorkspaceFolder[]): Promise<void> {
    const notification = new rpc.NotificationType<WorkspaceParams>('initializeWorkspace');
    const workspacePaths = workspaces?.map(folder => folder.uri.fsPath) || [];
    return this.connection.sendNotification(notification, { workspacePaths });
  }
	
  private async updateWorkspace(workspaces: readonly vscode.WorkspaceFolder[]): Promise<void> {
    const notification = new rpc.NotificationType<WorkspaceParams>('updateWorkspace');
    const workspacePaths = workspaces?.map(folder => folder.uri.fsPath) || [];
    return this.connection.sendNotification(notification, { workspacePaths });
  }
	
  public async fetchWorkspaces(): Promise<Workspace[]> {
    const request = new rpc.RequestType<void, Workspace[], void>('getWorkspace');
    return await this.connection.sendRequest(request, null);
  }

  public runTheorem(theoremsId: string[]): void {
    const notification = new rpc.NotificationType<string[]>('runTheorem');
    this.connection.sendNotification(notification, theoremsId);
  }

  public async fetchTheoremResult(theoremId: string): Promise<TheoremResult> {
    const request = new rpc.RequestType<string, TheoremResult, void>('getTheoremResult');
    return await this.connection.sendRequest(request, theoremId);
  }
}

export default RpcClient;