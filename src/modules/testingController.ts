import * as vscode from 'vscode';

import { AfvContext } from '../extension';

export const ROOT_TAG = new vscode.TestTag('root');
export const FOLDER_TAG = new vscode.TestTag('folder');
export const FILE_TAG = new vscode.TestTag('file');
export const PROPERTY_TAG = new vscode.TestTag('property');

export default class TestingController {
  private testCtrl: vscode.TestController;
  private diagnostics: vscode.DiagnosticCollection;
  private testRun: vscode.TestRun | null = null;
  private testResults: Map<string, TheoremResult> = new Map();

  constructor() {
    this.testCtrl = vscode.tests.createTestController('propertyPanel', 'Property Panel');
    this.diagnostics = vscode.languages.createDiagnosticCollection('afvDiagnostics');
  }

  public activate(context: AfvContext) {
    context.extension.subscriptions.push(this.testCtrl, this.diagnostics);

    context.rpcClient.onTestResult((result: TheoremResult) => {
      const testResult = this.testResults.get(result.theorem.id);
      if (testResult) {
        testResult.status = result.status;
        testResult.time = result.time;

        if (this.testRun !== null) {
          this.updateTestItem(result);
        }
      }
    });

    context.rpcClient.onWorkspaceUpdate((workspaces: Workspace[]) => {
      this.registerWorkspaces(workspaces);
    });

    this.testCtrl.createRunProfile('Run Proofs', vscode.TestRunProfileKind.Run, async (request, token) => {
      this.startTestRun(context, request, token);
    }, true);

    context.rpcClient.fetchWorkspaces().then((workspaces: Workspace[]) => {
      this.registerWorkspaces(workspaces);
    });
  }

  private registerWorkspaces(workspaces: Workspace[]) {
    this.testResults.clear();
    for (const workspace of workspaces) {
      this.registerWorkspace(workspace);
    }
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

          this.testResults.set(theorem.id, {
            theorem: theorem,
            status: 'undetermined',
          });
        }
        parentItem.children.add(childItem);
      }
    }
  }

  private startTestRun(context: AfvContext, request: vscode.TestRunRequest, token: vscode.CancellationToken) {
    const runTheoremIds = new Set<string>();

    const startTestRunRecursively = (items: vscode.TestItem[]) => {
      for (const item of items) {
        if (item.tags.includes(PROPERTY_TAG)) {
          this.testRun?.started(item);
          const theoremId = item.id.replace('property:', '');
          const testResult = this.testResults.get(theoremId);
          if (testResult) {
            testResult.status = 'running';
            testResult.time = 0;
            runTheoremIds.add(theoremId);
          }
        }
        startTestRunRecursively(Array.from(item.children).map(([_, child]) => child));
      }
    };

    if (this.testRun === null) {
      this.testRun = this.testCtrl.createTestRun(request);
    }

    startTestRunRecursively(
      request.include?.map(t => t) ?? Array.from(this.testCtrl.items).map(([_, item]) => item)
    );

    context.rpcClient.runTheorem(Array.from(runTheoremIds));
  }

  private updateTestItem(result: TheoremResult) {
    const updateTestItemRecursively = (items: vscode.TestItem[]) => {
      for (const item of items) {
        if (item.id === `property:${result.theorem.id}`) {
          if (result.status === 'valid') {
            this.testRun!.passed(item, result.time);
          } else if (result.status === 'invalid') {
            const message = new vscode.TestMessage(`Failed`);
            this.testRun!.failed(item, message, result.time);
          }
          return;
        }
        updateTestItemRecursively(Array.from(item.children).map(([_, child]) => child));
      }
    };

    updateTestItemRecursively(Array.from(this.testCtrl.items).map(([_, item]) => item));

    if (Array.from(this.testResults.values()).every(result => result.status !== 'running')) {
      this.testRun?.end();
      this.testRun = null;
    }
  }
}
