import * as vscode from 'vscode';
import * as fs from 'fs';

export class SolverConfigProvider implements vscode.WebviewViewProvider {
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

    webviewView.webview.html = getWebviewHtml(webviewView.webview, this.extensionUri, 'build/solverOptions');
  }
}

export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri, uiUri: string): string {
    const uiFolderPath = vscode.Uri.joinPath( extensionUri, uiUri);
    const indexHtmlPath = vscode.Uri.joinPath(uiFolderPath, 'index.html');

    let html = fs.readFileSync(indexHtmlPath.fsPath, 'utf-8');

    // Rewrite links (src/href) to use webview.asWebviewUri
    html = html.replace(/(src|href)="(.+?)"/g, (_, attr, file) => {
      const assetPath = vscode.Uri.joinPath(uiFolderPath, file);
      const uri = webview.asWebviewUri(assetPath);
      return `${attr}="${uri}"`;
    }).replace(/crossorigin/g, '');

    return html;
  }