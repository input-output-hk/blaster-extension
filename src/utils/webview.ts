import * as vscode from 'vscode';
import * as fs from 'fs';

export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri, webviewName: string): string {
  const webviewFolderPath = vscode.Uri.joinPath(extensionUri, 'build');
  const indexHtmlPath = vscode.Uri.joinPath(webviewFolderPath, `${webviewName}.html`);

  let html = fs.readFileSync(indexHtmlPath.fsPath, 'utf-8');

  // Rewrite links (src/href) to use webview.asWebviewUri
  html = html.replace(/(src|href)="(.+?)"/g, (_, attr, file) => {
    const assetPath = vscode.Uri.joinPath(webviewFolderPath, file);
    const uri = webview.asWebviewUri(assetPath);
    return `${attr}="${uri}"`;
  }).replace(/crossorigin/g, '');

  return html;
}