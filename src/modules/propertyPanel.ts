import * as vscode from 'vscode';

import { AfvContext } from '../extension';
import { getWebviewHtml } from '../utils/webview';

const ROOT_TAG = new vscode.TestTag('root');
const FOLDER_TAG = new vscode.TestTag('folder');
const FILE_TAG = new vscode.TestTag('file');
const PROPERTY_TAG = new vscode.TestTag('property');

export default class PropertyPanel {
  private testCtrl: vscode.TestController;
  private diagnostics: vscode.DiagnosticCollection;
  private panel: vscode.WebviewPanel | null = null;
  private testRun: vscode.TestRun | null = null;
  private testQueue: vscode.TestItem[] = [];

  constructor() {
    this.testCtrl = vscode.tests.createTestController('propertyPanel', 'Property Panel');
    this.diagnostics = vscode.languages.createDiagnosticCollection('afvDiagnostics');
  }

  public activate(context: AfvContext) {
    const disposable = this.registerCommand(context);
    this.registerPanel(context);
    context.extension.subscriptions.push(this.testCtrl, this.diagnostics, disposable);

    context.rpcClient.onTestResult((result: TheoremResult) => {
      if (this.testRun !== null) {
        const testItem = this.testQueue.find(item => item.id === `property:${result.theorem.id}`);
        if (testItem) {
          if (result.status === 'valid') {
            this.testRun.passed(testItem, result.time);
          }
          else if (result.status === 'invalid') {
            const message = new vscode.TestMessage(`Failed`);
            this.testRun.failed(testItem, message, result.time);
          }
        }
      }
    });
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

  private async registerPanel(context: AfvContext) {
    const workspaces = await context.rpcClient.fetchWorkspaces();
    for (const workspace of workspaces) {
      this.registerWorkspace(workspace);
    }

    this.testCtrl.createRunProfile('Run Proofs', vscode.TestRunProfileKind.Run, async (request, token) => {
      this.startTestRun(context, request, token);
    }, true);
  }

  private registerWorkspace(workspace: Workspace) {
    const workspaceItem = this.testCtrl.createTestItem(workspace.path, workspace.label, vscode.Uri.file(workspace.path));
    workspaceItem.tags = [ROOT_TAG];
    workspaceItem.canResolveChildren = true;
    this.testCtrl.items.add(workspaceItem);
    this.registerChildren(workspaceItem, workspace.children);
  }

  private registerChildren(parentItem: vscode.TestItem, children: Node[]) {
    for (const child of children) {
      const childUri = vscode.Uri.file(child.path);
      const childItem = this.testCtrl.createTestItem(child.path, child.label, childUri);
      
      if (child.type === 'folder') {
        childItem.tags = [FOLDER_TAG];
        childItem.canResolveChildren = true;
        parentItem.children.add(childItem);
        this.registerChildren(childItem, (child as FolderNode).children);
      } else if (child.type === 'file') {
        childItem.tags = [FILE_TAG];
        childItem.canResolveChildren = true;
        childItem.description = `${(child as FileNode).theorems.length} ${(child as FileNode).theorems.length > 1 ? 'properties' : 'property'}`;
        for (const theorem of (child as FileNode).theorems) {
          const theoremItem = this.testCtrl.createTestItem(`property:${theorem.id}`, theorem.label, childUri);
          theoremItem.tags = [PROPERTY_TAG];
          theoremItem.range = new vscode.Range(
            theorem.range.startLine,
            theorem.range.startCharacter,
            theorem.range.endLine,
            theorem.range.endCharacter
          );
          childItem.children.add(theoremItem);
        }
        parentItem.children.add(childItem);
      }
    }
  }

  private startTestRun(context: AfvContext, request: vscode.TestRunRequest, token: vscode.CancellationToken) {
    this.testQueue = [];

    if (this.testRun === null) {
      this.testRun = this.testCtrl.createTestRun(request);
    }

    let testItems = request.include?.map(t => t) ?? Array.from(this.testCtrl.items).map(([_, item]) => item);

    for (const testItem of testItems) {
      if (testItem.tags.includes(PROPERTY_TAG)) {
        this.testQueue.push(testItem);
      }
      testItems.push(...Array.from(testItem.children).map(([_, item]) => item));
    }

    for (const test of this.testQueue) {
      this.testRun.started(test);
    }

    context.rpcClient.runTheorem(this.testQueue.map(item => item.id.replace('property:', '')));
  }
}
