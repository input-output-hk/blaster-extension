import * as vscode from 'vscode';

import { AfvContext } from '../extension';
import { getWebviewHtml } from '../utils/webview';

const PROPERTY_TAG = new vscode.TestTag('property');

export default class PropertyPanel {
  private panel: vscode.WebviewPanel | null = null;

  constructor() {}

  public activate(context: AfvContext) {
    const disposable = this.registerCommand(context);
    context.extension.subscriptions.push(disposable);
  }

  private registerCommand(context: AfvContext): vscode.Disposable {
    return vscode.commands.registerCommand('afv.openPropertyResults', (testItem?: vscode.TestItem) => {
      // if webview panel is already open
      if (this.panel !== null) {
        const columnToShowIn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
        this.panel.reveal(columnToShowIn);

        if (testItem && testItem.tags.includes(PROPERTY_TAG)) {
          context.rpcClient.fetchTheoremResult(testItem.id.replace('property:', '')).then((result: TheoremResult) => {
            this.panel!.webview.postMessage({ type: 'loadPropertyResults', payload: result });
          });
        }

        return;
      }

      // register the property results view
      this.panel = vscode.window.createWebviewPanel(
        'propertyResults',
        'Property Results',
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      this.panel.webview.html = getWebviewHtml(this.panel.webview, context.extension.extensionUri, 'build');

      // Listen for messages from the webview
      this.panel.webview.onDidReceiveMessage(
        message => {
          if (message.type === 'webviewReady') {
            if (testItem && testItem.tags.includes(PROPERTY_TAG)) {
              context.rpcClient.fetchTheoremResult(testItem.id.replace('property:', '')).then((result: TheoremResult) => {
                this.panel!.webview.postMessage({ type: 'loadPropertyResults', payload: result });
              });
            }
          }
        },
        undefined,
        context.extension.subscriptions
      );
      
      this.panel.onDidDispose(() => this.panel = null, null, context.extension.subscriptions);
    });
  }
}
