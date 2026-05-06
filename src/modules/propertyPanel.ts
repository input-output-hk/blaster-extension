import * as vscode from 'vscode';

import { AfvContext } from '../extension';
import { getWebviewHtml } from '../utils/webview';
import { PROPERTY_TAG } from './testingController';

export default class PropertyPanel {
  private panel: vscode.WebviewPanel | null = null;
  private currentTheoremId: string | null = null;

  constructor() {}

  public activate(context: AfvContext) {
    const disposable = this.registerCommand(context);
    context.extension.subscriptions.push(disposable);
    context.testingStore.onTheoremUpdate((result: TheoremResult) => {
      if (this.panel !== null && this.currentTheoremId === result.theorem.id) {
        this.panel.webview.postMessage({ type: 'theorem-result', payload: result });
      }
    });
  }

  private fetchWorkspaces(context: AfvContext): void {
    context.testingStore.fetchWorkspaces().then((workspaces: Workspace[]) => {
      if (this.panel !== null) {
        this.panel.webview.postMessage({ type: 'workspaces', payload: workspaces });
      }
    });
  }

  private fetchCurrentTheoremResult(context: AfvContext): void {
    if (this.currentTheoremId !== null) {
      context.testingStore.fetchTheoremResult(this.currentTheoremId).then((result: TheoremResult) => {
        if (this.panel !== null) {
          this.panel.webview.postMessage({ type: 'theorem-result', payload: result });
        }
      });
    }
  }

  private changeCurrentTheorem(context: AfvContext, theoremId: string): void {
    this.currentTheoremId = theoremId;
    this.fetchCurrentTheoremResult(context);
  }

  private runCurrentTheorem(context: AfvContext): void {
    if (this.currentTheoremId !== null) {
      context.testingStore.runTheorem([this.currentTheoremId]);
    }
  }

  private registerCommand(context: AfvContext): vscode.Disposable {
    return vscode.commands.registerCommand('afv.openPropertyResults', (testItem?: vscode.TestItem) => {
      if (testItem && testItem.tags.includes(PROPERTY_TAG)) {
        this.currentTheoremId = testItem.id.replace('property:', '');
      } else {
        this.currentTheoremId = null;
      }
      
      // if webview panel is already open
      if (this.panel !== null) {
        const columnToShowIn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
        this.panel.reveal(columnToShowIn);
        this.fetchCurrentTheoremResult(context);
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
          localResourceRoots: [context.extension.extensionUri],
        }
      );

      this.panel.webview.html = getWebviewHtml(this.panel.webview, context.extension.extensionUri, 'propertyPanel');

      // Listen for messages from the webview
      this.panel.webview.onDidReceiveMessage(
        message => {
          switch (message.type) {
            case 'webview-ready':
              this.fetchWorkspaces(context);
              this.fetchCurrentTheoremResult(context);
              break;
            case 'change-theorem':
              this.changeCurrentTheorem(context, message.payload.theoremId);
              break;
            case 'run-theorem':
              this.runCurrentTheorem(context);
              break;
          }
        },
        undefined,
        context.extension.subscriptions
      );
      
      this.panel.onDidDispose(() => this.panel = null, null, context.extension.subscriptions);
    });
  }
}
