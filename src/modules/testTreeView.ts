import * as vscode from 'vscode';
import { GenericWebviewViewProvider } from '../utils/webview';
import { getGeneratorLabel } from '../services/generators';

import type { BlasterContext } from '../extension';

const DEPENDENCY_STATUS = '$(error) Dependency Error';
const INSTALL_URL = 'https://github.com/input-output-hk/Lean-blaster/blob/997d25b4b3d91b39213992275ccec7a45af780ae/docs/cli.md';

export default class TestTreeView {
  private context: BlasterContext;
  private webview: vscode.Webview | null = null;
  private pendingFetch: Promise<void> | null = null;

  constructor() {
    this.context = {} as BlasterContext;
  }

  public activate(context: BlasterContext) {
    this.context = context;
    context.extension.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        'blaster-test-tree',
        new GenericWebviewViewProvider(context.extension.extensionUri, 'testTree', this.onWebviewResolved.bind(this))
      ),

      vscode.commands.registerCommand('blaster-extension.refreshTestTree', this.refreshTestTree.bind(this)),
      vscode.commands.registerCommand('blaster-extension.runAllTests', this.runAllTests.bind(this)),
      vscode.commands.registerCommand('blaster-extension.stopAllTests', this.stopAllTests.bind(this)),
      vscode.commands.registerCommand('blaster-extension.clearAllTests', this.clearAllTests.bind(this)),
      vscode.commands.registerCommand('blaster-extension.collapseAllTests', this.collapseAllTests.bind(this)),
      vscode.commands.registerCommand('blaster-extension.showOutput', this.showOutput.bind(this)),

      vscode.window.onDidChangeActiveTextEditor(this.sendEditorFilesToWebview.bind(this)),
      vscode.window.onDidChangeVisibleTextEditors(this.sendEditorFilesToWebview.bind(this)),
      vscode.window.tabGroups.onDidChangeTabs(this.sendEditorFilesToWebview.bind(this)),
      context.testStore.onActionStateUpdate(this.onActionStateUpdate.bind(this)),
      context.testStore.onGeneratorStateUpdate(this.getTestTree.bind(this)),
      context.testStore.onGenerationComplete(this.reportGenerationErrors.bind(this))
    );

    this.context.testStore.onTestTreeUpdate(this.onTestTreeUpdate.bind(this));
    this.onActionStateUpdate(this.context.testStore.getActionState());
  }

  public refreshTestTree(): void {
    if (this.webview) {
      this.fetchTestTree();
    }
  }

  /**
   * Refreshes after files changed on disk, regenerating only the Haskell generators they affect.
   * Does nothing when no generator is affected.
   */
  public refreshChangedFiles(paths: Array<string>): void {
    if (!this.webview || !this.context.testStore.markHaskellChanges(paths)) return;
    this.context.outputChannel.appendLine(`> Haskell sources changed, refreshing properties: ${paths.join(', ')}`);
    this.fetchTestTree(false);
  }

  private onWebviewResolved(webview: vscode.Webview, view: vscode.WebviewView): void {
    this.webview = webview;
    view.onDidDispose(() => {
      if (this.webview === webview) this.webview = null;
    }, undefined, this.context.extension.subscriptions);

    this.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        switch (message.type) {
          case 'webview-ready':
            this.onActionStateUpdate(this.context.testStore.getActionState());
            this.loadTestTree();
            this.sendEditorFilesToWebview();
            break;
          case 'test-tree-fetch':
            this.fetchTestTree();
            break;
          case 'test-tree-run':
            this.runTests(message.payload);
            break;
          case 'test-tree-open-result':
            this.openTestResult(message.payload);
            break;
          case 'test-tree-open-location':
            this.openTestLocation(message.payload);
            break;
          case 'test-tree-open-bundle-file':
            this.openBundleFile(message.payload);
            break;
          case 'test-tree-update-open-state': {
            const { isOpen, workspaceId, group } = message.payload;
            this.context.testStore.updateOpenTestTreeNode(isOpen, workspaceId, group);
            break;
          }
          case 'test-tree-open-folder':
            void vscode.commands.executeCommand('vscode.openFolder').then(undefined, error => this.reportError(error));
            break;
          case 'test-tree-open-install-guide':
            void vscode.env.openExternal(vscode.Uri.parse(INSTALL_URL));
            break;
        }
      },
      undefined,
      this.context.extension.subscriptions
    );
  }

  // A pending fetch posts its own result, so cached content is not shown meanwhile
  private getTestTree(): void {
    if (this.pendingFetch || this.sendStoredError()) return;
    this.context.testStore.getTestTree().then((testTree?: TestTree) => {
      if (testTree !== undefined) {
        this.sendTestTreeToWebview(testTree);
      }
    }).catch(error => this.reportError(error, true));
  }

  private loadTestTree(): void {
    if (this.pendingFetch || this.sendStoredError()) return;
    this.context.testStore.getTestTree().then((testTree?: TestTree) => {
      if (testTree !== undefined) {
        this.sendTestTreeToWebview(testTree);
      } else {
        this.fetchTestTree();
      }
    }).catch(error => this.reportError(error, true));
  }

  private sendStoredError(): boolean {
    if (this.context.testStore.getIsBlasterMissing()) {
      this.showDependencyError();
      return true;
    }
    if (this.context.testStore.getDiscoveryError() !== undefined) {
      this.sendTestTreeErrorToWebview();
      return true;
    }
    return false;
  }

  private fetchTestTree(regenerateAll = true): void {
    if (this.pendingFetch) {
      return
    };
    // Refresh clears the dependency error first; a newer proof run error stays
    if (this.context.statusBarItem.text === DEPENDENCY_STATUS) this.context.statusBarItem.hide();
    this.pendingFetch = this.context.testStore.fetchTestTree(regenerateAll).then(testTree => {
      if (testTree === undefined) return this.reportMissingDependency();
      this.sendTestTreeToWebview(testTree);
      this.reportDiscoveryFileErrors();
    }).catch(async error => {
      if (error instanceof vscode.CancellationError) {
        if (!this.sendStoredError()) {
          this.sendTestTreeToWebview(await this.context.testStore.getTestTree() ?? { workspaces: {} });
        }
      } else {
        this.reportDiscoveryError(error);
      }
    }).catch(error => this.reportError(error, true)).finally(() => {
      this.pendingFetch = null;
    });
  }

  private reportMissingDependency(): void {
    this.context.outputChannel.appendLine('> ERROR: lean-blaster not found on PATH');
    this.showDependencyError();
  }

  private showDependencyError(): void {
    const { statusBarItem } = this.context;
    statusBarItem.text = DEPENDENCY_STATUS;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    statusBarItem.show();
    void this.webview?.postMessage({ type: 'test-tree-dependency-error' } satisfies ExtensionToWebviewMessage);
  }

  private runTests(payload: TestRunPayload): void {
    this.context.testStore.runTests(payload.testRuns).catch(error => this.reportError(error));
  }

  /**
   * Opens a test's source file in the editor and selects its range (a Lean site or a UAL annotation).
   */
  private openTestLocation({ path, range: { start, end } }: TestLocation): void {
    const selection = new vscode.Range(start.line, start.character, end.line, end.character);
    vscode.window.showTextDocument(vscode.Uri.file(path), { selection }).then(undefined, error => this.reportError(error));
  }

  /**
   * Opens a file of a Haskell generator's generated bundle (read-only).
   */
  private openBundleFile(payload: OpenBundleFilePayload): void {
    this.context.bundleDocuments.open(payload).catch(this.reportError.bind(this));
  }

  private runAllTests(): void {
    this.context.testStore.runAllTests().catch(error => this.reportError(error));
  }

  private stopAllTests(): void {
    this.context.testStore.stopAll();
  }

  private showOutput(): void {
    this.context.outputChannel.show(true);
  }

  private collapseAllTests(): void {
    this.context.testStore.collapseTestTree();
    this.getTestTree();
  }

  private clearAllTests(): void {
    this.context.testStore.clearTestResults().then(() => {
      this.getTestTree();
    }).catch(error => this.reportError(error));
  }

  private reportError(error: unknown, treeError = false): void {
    if (error instanceof vscode.CancellationError) return;
    const message = error instanceof Error ? error.message : String(error);
    this.context.outputChannel.appendLine(`> ERROR: ${message}`);
    void vscode.window.showErrorMessage(message);
    if (treeError) this.sendTestTreeErrorToWebview();
  }

  private reportDiscoveryError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.context.outputChannel.appendLine(`> ERROR: Property discovery failed: ${message}`);
    this.sendTestTreeErrorToWebview();
  }

  private reportDiscoveryFileErrors(): void {
    const fileErrors = this.context.testStore.getDiscoveryFileErrors();
    if (fileErrors.length === 0) return;
    const files = Array.from(new Set(fileErrors.map(error => error.group.at(-1)))).join(', ');
    void vscode.window.showErrorMessage(
      `Property Discovery Error: An error occurred in ${files}. View output for more details.`, 'Show Output'
    ).then(action => {
      if (action) this.showOutput();
    });
  }

  /**
   * Shows one notification for a finished generation pass, listing the generators that failed.
   */
  private reportGenerationErrors(failedTargets: Array<string>): void {
    if (failedTargets.length === 0) return;
    const generators = failedTargets.map(getGeneratorLabel).join(', ');
    void vscode.window.showErrorMessage(
      `Bundle Generation Failed: ${generators}. View output for more details.`, 'Show Output'
    ).then(this.handleGenerationErrorAction.bind(this));
  }

  /**
   * Opens the Blaster output when "Show Output" is picked on the generation notification.
   */
  private handleGenerationErrorAction(action: string | undefined): void {
    if (action) this.showOutput();
  }

  private sendTestTreeErrorToWebview(): void {
    void this.webview?.postMessage({ type: 'test-tree-error' } satisfies ExtensionToWebviewMessage);
  }

  private openTestResult(payload: OpenResultPayload): void {
    this.context.testResultView.open(payload.workspaceId, payload.testId);
  }

  private sendTestTreeToWebview(testTree: TestTree): void {
    if (this.webview !== null) {
      this.webview.postMessage({ type: 'test-tree', payload: { testTree } } satisfies ExtensionToWebviewMessage);
    }
  }

  /**
   * Sends the active file and the files open in editor tabs, for the `@doc` and `@openedFiles` filter tags.
   * When a non-text editor (e.g. a test result panel) is active, the first visible text editor counts as active.
   */
  private sendEditorFilesToWebview(): void {
    if (this.webview === null) return;
    const activeEditor = vscode.window.activeTextEditor ?? vscode.window.visibleTextEditors[0];
    const openFiles: Array<string> = [];
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (tab.input instanceof vscode.TabInputText) openFiles.push(tab.input.uri.fsPath);
      }
    }
    const payload: EditorFilesPayload = { activeFile: activeEditor?.document.uri.fsPath, openFiles };
    void this.webview.postMessage({ type: 'editor-files', payload } satisfies ExtensionToWebviewMessage);
  }

  private onTestTreeUpdate(payload: TestTreeUpdate): void {
    if (this.webview !== null) {
      this.webview.postMessage({ type: 'test-tree-update', payload } satisfies ExtensionToWebviewMessage);
    }
  }

  private onActionStateUpdate(payload: TestTreeActionState): void {
    void vscode.commands.executeCommand('setContext', 'blaster.testTreeBusy', payload.isBusy)
      .then(undefined, error => this.reportError(error));
    void this.webview?.postMessage({ type: 'test-tree-action-state', payload } satisfies ExtensionToWebviewMessage);
  }
}