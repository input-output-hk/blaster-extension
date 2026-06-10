import * as vscode from "vscode";

import { AfvContext } from "../extension";
import { getWebviewHtml } from "../utils/webview";

export default class TestResultDetailPanel {
  private panel: vscode.WebviewPanel | null = null;

  constructor() {}

  public activate(_context: AfvContext) {}

  public open(context: AfvContext, detail: TestResultDetail): void {
    if (this.panel !== null) {
      this.panel.reveal(vscode.ViewColumn.Four);
      if (detail) {
        this.panel.webview.postMessage({
          type: "test-result-detail",
          payload: detail,
        });
      }
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "testResultDetail",
      "Result Detail",
      vscode.ViewColumn.Four,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extension.extensionUri],
      },
    );

    this.panel.iconPath = vscode.Uri.joinPath(
      context.extension.extensionUri,
      "images",
      "blaster-logo.svg",
    );
    this.panel.webview.html = getWebviewHtml(
      this.panel.webview,
      context.extension.extensionUri,
      "testResultDetail",
    );

    this.panel.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        if (message.type === "webview-ready") {
          this.panel?.webview.postMessage({
            type: "test-result-detail",
            payload: detail,
          });
        }
      },
      undefined,
      context.extension.subscriptions,
    );

    this.panel.onDidDispose(
      () => (this.panel = null),
      null,
      context.extension.subscriptions,
    );
  }
}
