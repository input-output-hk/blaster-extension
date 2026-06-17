import * as vscode from "vscode";

import { AfvContext } from "../extension";
import { getWebviewHtml } from "../utils/webview";

export default class TestResultView {
  private context: AfvContext;
  private panel: vscode.WebviewPanel | null = null;
  private currentTestId: string | null = null;

  constructor() {
    this.context = {} as AfvContext;
  }

  public activate(context: AfvContext) {
    this.context = context;
    context.testStore.onTestUpdate((result: TestResult) => {
      if (this.panel !== null && this.currentTestId === result.test.id) {
        this.panel.webview.postMessage({
          type: "test-result",
          payload: result,
        });
      }
    });
  }

  private fetchTestTree(): void {
    this.sendTestTreeToWebview(this.context.testStore.getTestTree() || []);
  }

  private sendTestTreeToWebview(testTree: TestTree[]): void {
    if (this.panel !== null) {
      this.panel.webview.postMessage({
        type: "test-tree",
        payload: { testTree },
      } as ExtensionToWebviewMessage);
    }
  }

  private fetchCurrentTestResult(): void {
    if (this.currentTestId !== null) {
      this.context.testStore
        .fetchTestResult(this.currentTestId)
        .then((result: TestResult) => {
          this.sendCurrentTestResultToWebview(result);
        });
    }
  }

  private sendCurrentTestResultToWebview(result: TestResult): void {
    if (this.panel !== null) {
      this.panel.webview.postMessage({
        type: "test-result",
        payload: result,
      } as ExtensionToWebviewMessage);
    }
  }

  private changeCurrentTest(testId: string): void {
    this.currentTestId = testId;
    this.fetchCurrentTestResult();
  }

  private runCurrentTest(): void {
    if (this.currentTestId !== null) {
      this.context.testStore.runTest([this.currentTestId]);
    }
  }

  public open(testResult: TestResult): void {
    this.currentTestId = testResult.test.id;

    // If webview panel is already open
    if (this.panel !== null) {
      this.panel.reveal();
      this.sendCurrentTestResultToWebview(testResult);
      return;
    }

    // Register the test result view
    this.panel = vscode.window.createWebviewPanel(
      "afv-test-result",
      "Test Result",
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
            this.fetchTestTree();
            this.fetchCurrentTestResult();
            break;
          case "change-test":
            this.changeCurrentTest(message.payload.testId);
            break;
          case "run-test":
            this.runCurrentTest();
            break;
          case "notify":
            vscode.window.showInformationMessage(message.payload.text);
            break;
          case "open-result-detail": {
            const detail = this.context.testStore.getTxDetail(
              message.payload.id,
            );
            if (detail !== null)
              this.context.testResultDetail.open(this.context, detail);
            break;
          }
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
      () => (this.panel = null),
      null,
      this.context.extension.subscriptions,
    );
  }
}
