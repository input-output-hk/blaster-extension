import * as vscode from 'vscode';
import { GenericWebviewViewProvider } from '../utils/webview';

import type { BlasterContext } from '../extension';

export default class TestTreeView {
  private context: BlasterContext;
  private webview: vscode.Webview | null = null;

  constructor() {
    this.context = {} as BlasterContext;
  }

  public activate(context: BlasterContext) {
    this.context = context;

    context.extension.subscriptions.push(
      vscode.window.registerWebviewViewProvider('blaster-test-tree',
        new GenericWebviewViewProvider(context.extension.extensionUri, 'testTree', this.onWebviewResolved.bind(this))
      ),

      vscode.commands.registerCommand('blaster-extension.refreshTestTree', this.refreshTestTree.bind(this)),
      vscode.commands.registerCommand('blaster-extension.runAllTests', this.runAllTests.bind(this)),
      vscode.commands.registerCommand('blaster-extension.clearAllTests', this.clearAllTests.bind(this)),
      vscode.commands.registerCommand('blaster-extension.collapseAllTests', this.collapseAllTests.bind(this)),
      vscode.commands.registerCommand('blaster-extension.stopTests', this.stopTests.bind(this)),

      context.testStore.onTestTreeUpdate(this.onTestTreeUpdate.bind(this)),
      context.testStore.onOperationState(this.onOperationState.bind(this)),
    );

    this.onOperationState(context.testStore.operationState);
  }

  private onWebviewResolved(webview: vscode.Webview, view: vscode.WebviewView): void {
    this.webview = webview;
    view.onDidDispose(() => {
      if (this.webview === webview) this.webview = null;
    }, undefined, this.context.extension.subscriptions);

    this.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        switch (message.type) {
          case 'webview-ready':
            this.sendOperationState(this.context.testStore.operationState);
            this.getTestTree();
            break;
          case 'test-tree-fetch':
            this.fetchTestTree();
            break;
          case 'test-tree-run':
            this.runTests(message.payload);
            break;
          case 'test-tree-open-result':
            this.openTestResult(message.payload);
            break;
          case 'test-tree-show-location':
            void this.showTestLocation(message.payload).catch(error => this.reportError(error));
            break;
          case 'test-tree-update-open-state': {
            const { isOpen, workspaceId, group } = message.payload;
            this.context.testStore.updateOpenTestTreeNode(isOpen, workspaceId, group);
            break;
          }
          case 'test-tree-open-folder':
            void vscode.commands.executeCommand('vscode.openFolder').then(undefined, error => this.reportError(error));
            break;
        }
      },
      undefined,
      this.context.extension.subscriptions
    );
  }

  private getTestTree(): void {
    this.context.testStore.getTestTree().then(tree => this.sendTestTreeToWebview(tree))
      .catch(error => this.reportError(error, true));
  }

  private fetchTestTree(): void {
    this.context.testStore.fetchTestTree().then((testTree: TestTree) => {
      this.sendTestTreeToWebview(testTree);
    }).catch(error => this.reportError(error, true));
  }

  private refreshTestTree(): void {
    this.fetchTestTree();
  }

  private runTests(payload: TestRunPayload): void {
    this.context.testStore.runTests(payload.testRuns).catch(error => this.reportError(error));
  }

  private runAllTests(): void {
    this.context.testStore.runAllTests().catch(error => this.reportError(error));
  }

  private clearAllTests(): void {
    this.context.testStore.clearTestResults()
      .then(this.getTestTree)
      .catch(error => this.reportError(error));
  }

  private collapseAllTests(): void {
    this.context.testStore.collapseAllTests()
      .then(tree => this.sendTestTreeToWebview(tree))
      .catch(error => this.reportError(error));
  }

  private stopTests(): void {
    this.context.testStore.stopTests()
      .catch(error => this.reportError(error));
  }

  private reportError(error: unknown, treeError = false): void {
    const message = error instanceof Error ? error.message : String(error);
    this.context.outputChannel.appendLine(`> ERROR: ${message}`);
    void vscode.window.showErrorMessage(message, 'Show Output').then(action => {
      if (action) this.context.outputChannel.show(true);
    });
    if (treeError) {
      void this.webview?.postMessage({ type: 'test-tree-error', payload: { message } } satisfies ExtensionToWebviewMessage);
    }
  }

  private openTestResult(payload: OpenResultPayload): void {
    this.context.testResultView.open(payload.workspaceId, payload.testId);
  }

  private async showTestLocation(payload: OpenResultPayload): Promise<void> {
    const location = await this.context.testStore.getTestLocation(payload.workspaceId, payload.testId);
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(location.path));
    const editor = await vscode.window.showTextDocument(document);
    const { start, end } = location.range;
    const range = new vscode.Range(start.line, start.character, end.line, end.character);
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }

  private onOperationState(state: TestOperationState): void {
    void Promise.all([
      vscode.commands.executeCommand('setContext', 'blaster.activeTestRun', state === 'running' || state === 'stopping'),
      vscode.commands.executeCommand('setContext', 'blaster.stoppingTests', state === 'stopping'),
      vscode.commands.executeCommand('setContext', 'blaster.busy', state !== 'idle')
    ]).catch(error => this.context.outputChannel.appendLine(`> Unable to update command state: ${String(error)}`));
    this.sendOperationState(state);
  }

  private sendOperationState(state: TestOperationState): void {
    void this.webview?.postMessage({ type: 'test-operation', payload: { state } } satisfies ExtensionToWebviewMessage);
  }

  private sendTestTreeToWebview(testTree: TestTree): void {
    if (this.webview !== null) {
      this.webview.postMessage({ type: 'test-tree', payload: {
        testTree, hasWorkspaceFolders: !!vscode.workspace.workspaceFolders?.length
      } } satisfies ExtensionToWebviewMessage);
    }
  }

  private onTestTreeUpdate(payload: TestTreeUpdate): void {
    if (this.webview !== null) {
      this.webview.postMessage({ type: 'test-tree-update', payload } as ExtensionToWebviewMessage);
    }
  }
}