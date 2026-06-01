// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import TestStore from './services/testStore';
import TestTreeView from './modules/testTreeView';
import TestResultView from './modules/testResultView';
import { getBinaryPath } from './utils/binary';

export type AfvContext = {
  extension: vscode.ExtensionContext;
  testStore: TestStore;
  testTreeView: TestTreeView;
  testResultView: TestResultView;
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Only proceed if compatible binary exists
  vscode.workspace.fs
    .stat(vscode.Uri.file(context.asAbsolutePath(getBinaryPath())))
    .then(
      () => {
        initializeExtension(context);
      },
      () => {
        vscode.window.showErrorMessage(
          "Compatible AFV binary not found. Your platform/architecture is not supported.",
        );
      },
    );
}

function initializeExtension(context: vscode.ExtensionContext) {
  // Init test store
  const testStore = new TestStore(context);

  // Init test tree view
  const testTreeView = new TestTreeView();

  // Init test result view
  const testResultView = new TestResultView();

  // Init context
  const afvContext: AfvContext = {
    extension: context,
    testStore,
    testTreeView,
    testResultView,
  };

  // Init workspaces
  testStore.initialize(afvContext).then(() => {
    // Activate modules
    testTreeView.activate(afvContext);
    testResultView.activate(afvContext);
  });
}

// This method is called when your extension is deactivated
export function deactivate() {}
