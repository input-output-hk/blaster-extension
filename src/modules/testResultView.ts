import * as vscode from 'vscode';
import { getWebviewHtml } from '../utils/webview';

import type { BlasterContext } from '../extension';

export default class TestResultView {
  private context: BlasterContext;
  private panel: vscode.WebviewPanel | null = null;
  private selectedTest: OpenResultPayload | null = null;
  private requestVersion = 0;

  constructor() {
    this.context = {} as BlasterContext;
  }

  public activate(context: BlasterContext) {
    this.context = context;
    context.extension.subscriptions.push(
      this.context.testStore.onTestTreeUpdate(this.onTestTreeUpdate.bind(this))
    );
  }

  public open(workspaceId: string, testId: string): void {
    this.selectedTest = { workspaceId, testId };
    this.requestVersion++;
    // If webview panel is already open
    if (this.panel !== null) {
      this.panel.reveal();
      this.fetchTestResult();
      return;
    }

    // Register the test result view
    this.panel = vscode.window.createWebviewPanel(
      "blaster-test-result",
      "Blaster Test Results",
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.context.extension.extensionUri],
      },
    );

    this.panel.iconPath = vscode.Uri.joinPath(
      this.context.extension.extensionUri,
      "images",
      "blaster-logo.svg",
    );

    // Listen for messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        switch (message.type) {
          case "webview-ready":
            this.fetchTestResult();
            break;
        }
      },
      undefined,
      this.context.extension.subscriptions,
    );

    this.panel.webview.html = getWebviewHtml(
      this.panel.webview,
      this.context.extension.extensionUri,
      "testResult",
    );

    this.panel.onDidDispose(
      () => {
        this.panel = null;
        this.selectedTest = null;
        this.requestVersion++;
      },
      null,
      this.context.extension.subscriptions,
    );
  }

  private fetchTestResult(): void {
    if (!this.selectedTest || !this.panel) return;
    const { workspaceId, testId } = this.selectedTest;
    const version = ++this.requestVersion;
    this.context.testStore
      .getTestResult(workspaceId, testId)
      .then(({ test, result }) => {
        if (version === this.requestVersion) this.sendTestResultToWebview(test, result);
      })
      .catch(error => {
        if (version !== this.requestVersion) return;
        this.context.outputChannel.appendLine(`> ERROR: ${String(error)}`);
        void vscode.window.showErrorMessage(`Unable to load test results: ${String(error)}`);
      });
  }

  private onTestTreeUpdate(payload: TestTreeUpdate): void {
    if (payload.type === 'test') {
      const test = payload.test;
      if (this.panel !== null && this.selectedTest?.workspaceId === test.workspaceId && this.selectedTest.testId === test.id) {
        this.fetchTestResult();
      }
    }
  }

  private sendTestResultToWebview(test: Test, result: TestResult): void {
    if (this.panel !== null) {
      this.panel!.webview.postMessage({ type: 'test-result', payload: { test, result } } as ExtensionToWebviewMessage);
    }
  }
}