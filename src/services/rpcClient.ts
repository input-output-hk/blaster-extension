import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';

import { BlasterContext } from '../extension';
import { getBinaryPath } from '../utils/binary';
  
export default class RpcClient {
  private context: BlasterContext | null = null;
  private childProcess!: cp.ChildProcess;
  private connection!: rpc.MessageConnection;
  private disposed = false;
  private disconnectHandler: (() => void) | undefined;

  constructor(private readonly extension: vscode.ExtensionContext) {}

  public async initialize(context: BlasterContext): Promise<void> {
    this.context = context;

    this.childProcess = cp.spawn(this.extension.asAbsolutePath(getBinaryPath()));
    
    this.childProcess.on('error', (error) => {
      context.outputChannel.appendLine(`> ERROR: RPC server failed to start: ${error.message}`);
      vscode.window.showErrorMessage(
        `Blaster RPC server failed to start: ${error.message}`,
        'Show output'
      )
      .then(selection => {
        if (selection === 'Show output') {
          this.context!.outputChannel.show(true);
        }
      });
    });

    this.childProcess.on('exit', (code, signal) => {
      if (!this.disposed || vscode.workspace.getConfiguration('blaster-extension').get<boolean>('trace', false)) {
        context.outputChannel.appendLine(`> RPC server exited (code: ${code}, signal: ${signal})`);
      }
      if (!this.disposed && code !== 0) {
        vscode.window.showErrorMessage(
          'Blaster RPC server exited unexpectedly',
          'Show output'
        )
        .then(selection => {
          if (selection === 'Show output') {
            this.context!.outputChannel.show(true);
          }
        });
      }
    });

    this.childProcess.stderr?.on('data', (data) => {
      context.outputChannel.append(`> ERROR\n${data}`);
      return data;
    });

    this.connection = rpc.createMessageConnection(
      new rpc.StreamMessageReader(this.childProcess.stdout!),
      new rpc.StreamMessageWriter(this.childProcess.stdin!)
    );

    this.connection.trace(rpc.Trace.Verbose, {
      log: (message: string, data?: string) => {
        if (vscode.workspace.getConfiguration('blaster-extension').get<boolean>('trace', false)) {
          context.outputChannel.append(`> ${message}\n${data}`);
        }
      }
    });

    this.connection.onClose(() => {
      if (!this.disposed) this.disconnectHandler?.();
    });
    this.connection.listen();
    await new Promise<void>((resolve, reject) => {
      this.childProcess.once('error', reject);
      this.childProcess.once('spawn', () => {
        this.childProcess.removeListener('error', reject);
        resolve();
      });
    });
  }

  public async fetchTestTree(params: RpcFetchParams): Promise<RpcFetchResponse> {
    const request = new rpc.RequestType<RpcFetchParams, RpcFetchResponse, void>('fetch');
    return await this.connection.sendRequest(request, params);
  }

  public async testRun(params: RpcRunParams): Promise<void> {
    const notification = new rpc.NotificationType<RpcRunParams>('run');
    await this.connection.sendNotification(notification, params);
    this.clearError();
  }

  public onTestEvent(callback: (event: TestEvent) => void): void {
    this.connection.onNotification('testEvent', (event: TestEvent) => {
      if (event.type === 'test-error') {
        this.showError(event as TestErrorEvent);
      }
      callback(event);
    });
  }

  public onDisconnect(callback: () => void): void {
    this.disconnectHandler = callback;
  }

  public async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    const child = this.childProcess;
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      await new Promise<void>(resolve => {
        const timeout = setTimeout(() => child.kill('SIGKILL'), 2000);
        child.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
        void this.connection.sendNotification('exit').catch(() => child.kill());
      });
    }
    this.connection?.dispose();
  }

  private showError(event: TestErrorEvent): void {
    const { message, trace } = event.payload.error;

    this.context!.outputChannel.appendLine(`> ERROR: ${message}\n${trace}\n`);

    this.context!.statusBarItem.text = `$(error) ${message}`;
    this.context!.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    this.context!.statusBarItem.show();

    vscode.window
      .showErrorMessage(message, 'Show output')
      .then(selection => {
        if (selection === 'Show output') {
          this.context!.outputChannel.show(true);
        }
      });
  }

  private clearError(): void {
    this.context!.statusBarItem.hide();
  }
}
