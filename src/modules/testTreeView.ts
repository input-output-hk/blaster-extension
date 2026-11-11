import * as vscode from 'vscode';
import { GenericWebviewViewProvider } from '../utils/webview';

import type { BlasterContext } from '../extension';

export default class TestTreeView {
  private context: BlasterContext;
  private webview: vscode.Webview | null = null;
  private pendingFetch: Promise<void> | null = null;

  constructor() {
    this.context = {} as BlasterContext;
  }

  public activate(context: BlasterContext) {
    this.context = context;
    context.extension.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        'blaster-test-tree',
        new GenericWebviewViewProvider(context.extension.extensionUri, 'testTree', this.onWebviewResolved.bind(this))
      ),

      vscode.commands.registerCommand('blaster-extension.refreshTestTree', this.refreshTestTree.bind(this)),
      vscode.commands.registerCommand('blaster-extension.runAllTests', this.runAllTests.bind(this)),
      vscode.commands.registerCommand('blaster-extension.clearAllTests', this.clearAllTests.bind(this)),
      vscode.commands.registerCommand('blaster-extension.collapseAllTests', this.collapseAllTests.bind(this)),
      vscode.commands.registerCommand('blaster-extension.showOutput', this.showOutput.bind(this))
    );

    this.context.testStore.onTestTreeUpdate(this.onTestTreeUpdate.bind(this));
  }

  public refreshTestTree(): void {
    if (this.webview) {
      this.fetchTestTree();
    }
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
            this.loadTestTree();
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
    if (this.context.testStore.getDiscoveryError() !== undefined) {
      this.sendTestTreeErrorToWebview();
      return;
    }
    this.context.testStore.getTestTree().then((testTree?: TestTree) => {
      if (testTree !== undefined) {
        this.sendTestTreeToWebview(testTree);
      }
    }).catch(error => this.reportError(error, true));
  }

  private loadTestTree(): void {
    if (this.context.testStore.getDiscoveryError() !== undefined) {
      this.sendTestTreeErrorToWebview();
      return;
    }
    this.context.testStore.getTestTree().then((testTree?: TestTree) => {
      if (testTree !== undefined) {
        this.sendTestTreeToWebview(testTree);
      } else {
        this.fetchTestTree();
      }
    }).catch(error => this.reportError(error, true));
  }

  private fetchTestTree(): void {
    if (this.pendingFetch) {
      return
    };
    this.pendingFetch = this.context.testStore.fetchTestTree().then((testTree: TestTree) => {
      this.sendTestTreeToWebview(testTree);
      this.reportDiscoveryFileErrors();
    }).catch(error => this.reportDiscoveryError(error)).finally(() => {
      this.pendingFetch = null;
    });
  }

  private runTests(payload: TestRunPayload): void {
    this.context.testStore.runTests(payload.testRuns).catch(error => this.reportError(error));
  }

  private runAllTests(): void {
    this.context.testStore.runAllTests().catch(error => this.reportError(error));
  }

  private showOutput(): void {
    this.context.outputChannel.show(true);
  }

  private collapseAllTests(): void {
    this.context.testStore.collapseTestTree();
    this.getTestTree();
  }

  private clearAllTests(): void {
    this.context.testStore.clearTestResults().then(() => {
      this.getTestTree();
    }).catch(error => this.reportError(error));
  }

  private reportError(error: unknown, treeError = false): void {
    const message = error instanceof Error ? error.message : String(error);
    this.context.outputChannel.appendLine(`> ERROR: ${message}`);
    void vscode.window.showErrorMessage(message);
    if (treeError) this.sendTestTreeErrorToWebview();
  }

  private reportDiscoveryError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.context.outputChannel.appendLine(`> ERROR: Property discovery failed: ${message}`);
    this.sendTestTreeErrorToWebview();
  }

  private reportDiscoveryFileErrors(): void {
    const fileErrors = this.context.testStore.getDiscoveryFileErrors();
    if (fileErrors.length === 0) return;
    const files = Array.from(new Set(fileErrors.map(error => error.group.at(-1)))).join(', ');
    void vscode.window.showErrorMessage(
      `Property Discovery Error: An error occurred in ${files}. View output for more details.`, 'Show Output'
    ).then(action => {
      if (action) this.showOutput();
    });
  }

  private sendTestTreeErrorToWebview(): void {
    void this.webview?.postMessage({ type: 'test-tree-error' } satisfies ExtensionToWebviewMessage);
  }

  private openTestResult(payload: OpenResultPayload): void {
    this.context.testResultView.open(payload.workspaceId, payload.testId);
  }

  private sendTestTreeToWebview(testTree: TestTree): void {
    if (this.webview !== null) {
      this.webview.postMessage({ type: 'test-tree', payload: { testTree } } as ExtensionToWebviewMessage);
    }
  }

  private onTestTreeUpdate(payload: TestTreeUpdate): void {
    if (this.webview !== null) {
      this.webview.postMessage({ type: 'test-tree-update', payload } as ExtensionToWebviewMessage);
    }
  }
}