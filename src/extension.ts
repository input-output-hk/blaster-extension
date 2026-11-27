// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import TestStore from './services/testStore';
import TestTreeView from './modules/testTreeView';
import TestResultView from './modules/testResultView';
import BundleDocuments from './modules/bundleDocuments';

export type BlasterContext = {
  extension: vscode.ExtensionContext;
  testStore: TestStore;
  testTreeView: TestTreeView;
  testResultView: TestResultView;
  bundleDocuments: BundleDocuments;
  outputChannel: vscode.OutputChannel;
  statusBarItem: vscode.StatusBarItem;
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Init store
  const testStore = new TestStore(context);

  // Init test tree view
  const testTreeView = new TestTreeView();

  // Init test result view
  const testResultView = new TestResultView();

  // Init generated bundle documents
  const bundleDocuments = new BundleDocuments();

  // Init output channel
  const outputChannel = vscode.window.createOutputChannel('Blaster');

  // Init status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

  // Init context
  const blasterContext: BlasterContext = {
    extension: context,
    testStore,
    testTreeView,
    testResultView,
    bundleDocuments,
    outputChannel,
    statusBarItem,
  };

  // Init workspaces
  context.subscriptions.push(outputChannel, statusBarItem);

  try {
    await testStore.initialize(blasterContext);
    testTreeView.activate(blasterContext);
    testResultView.activate(blasterContext);
    bundleDocuments.activate(blasterContext);
  } catch (error) {
    outputChannel.appendLine(`> ERROR initializing Blaster: ${String(error)}`);
    vscode.window.showErrorMessage(`Unable to initialize Blaster: ${String(error)}`);
  }
}
