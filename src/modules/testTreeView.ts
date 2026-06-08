import * as vscode from 'vscode';
import { getWebviewHtml } from '../utils/webview';

import type { AfvContext } from '../extension';

class TestTreeViewProvider implements vscode.WebviewViewProvider {
  private extensionUri: vscode.Uri;
  private onResolve: (webview: vscode.Webview) => void;

  constructor(extensionUri: vscode.Uri, onResolve: (webview: vscode.Webview) => void) {
    this.extensionUri = extensionUri;
    this.onResolve = onResolve;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = getWebviewHtml(webviewView.webview, this.extensionUri, 'testTree');

    this.onResolve(webviewView.webview);
  }
}

export default class TestTreeView {
  private context: AfvContext;
  private webview: vscode.Webview | null = null;

  constructor() {
    this.context = {} as AfvContext;
  }

  public activate(context: AfvContext) {
    this.context = context;
    const provider = new TestTreeViewProvider(context.extension.extensionUri, this.onWebviewResolved.bind(this));
    const disposable = vscode.window.registerWebviewViewProvider('afv-test-tree', provider);
    context.extension.subscriptions.push(disposable);
  }

  private onWebviewResolved(webview: vscode.Webview): void {
    this.webview = webview;

    this.context.testStore.onTestUpdate((result: TestResult) => {
      if (this.webview !== null) {
        this.webview.postMessage({ type: 'test-result', payload: result });
      }
    });
    
    this.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        switch (message.type) {
          case 'webview-ready':
            this.fetchTestTree();
            break;
          case 'scan-workspace':
            this.buildTestTree();
            break;
          case 'run-test':
            this.runTests(message.payload!.testIds);
            break;
          case 'open-result':
            this.openResult(message.payload!.testId);
            break;
        }
      },
      undefined,
      this.context.extension.subscriptions
    );
  }

  private openResult(testId: string): void {
    this.context.testStore.fetchTestResult(testId).then((result) =>
      this.context.testResultView.open(result)
    );
  }

  private fetchTestTree(): void {
    const testTree = this.context.testStore.getTestTree();
    const testResults = this.context.testStore.getTestResults();
    if (testTree !== null) {
      this.sendTestTreeToWebview(testTree, testResults);
    }
  }

  private buildTestTree(): void {
    this.context.testStore.buildTestTree().then((testTree: TestTree[]) => {
      const testResults = this.context.testStore.getTestResults();
      this.sendTestTreeToWebview(testTree, testResults);
    });
  }

  private sendTestTreeToWebview(testTree: TestTree[], testResults: Record<string, TestResult>): void {
    if (this.webview !== null) {
      this.webview.postMessage({ type: 'test-tree', payload: { testTree, testResults } } as ExtensionToWebviewMessage);
    }
  }

  private runTests(testIds: string[]): void {
    this.context.testStore.runTest(testIds);
  }
}