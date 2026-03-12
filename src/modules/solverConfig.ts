import * as vscode from 'vscode';
import { getWebviewHtml } from '../utils/webview';

import type { AfvContext } from '../extension';

class SolverConfigProvider implements vscode.WebviewViewProvider {
  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = getWebviewHtml(webviewView.webview, this.extensionUri, 'solverConfig');
  }
}

export default class SolverConfig {
  constructor() {}
  
  public activate(context: AfvContext) {
    const provider = new SolverConfigProvider(context.extension.extensionUri);
    const disposable = vscode.window.registerWebviewViewProvider('solver-config', provider);
    context.extension.subscriptions.push(disposable);
  }
}