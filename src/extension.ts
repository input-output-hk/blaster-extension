// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import TestingStore from './services/testingStore';
import SolverConfig from './modules/solverConfig';
import PropertyPanel from './modules/propertyPanel';
import TestingController from './modules/testingController';
import { getBinaryPath } from './utils/binary';

export type AfvContext = {
  extension: vscode.ExtensionContext;
  testingStore: TestingStore;
  testingController: TestingController;
  propertyPanel: PropertyPanel;
  solverConfig: SolverConfig;
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Only proceed if compatible binary exists
  vscode.workspace.fs.stat(vscode.Uri.file(context.asAbsolutePath(getBinaryPath())))
    .then(
      () => {
        initializeExtension(context);
      },
      () => {
        vscode.window.showErrorMessage('Compatible AFV binary not found. Your platform/architecture is not supported.');
      }
    );
}

function initializeExtension(context: vscode.ExtensionContext) {
  // Init testing store
  const testingStore = new TestingStore(context);

  // Init solver config
  const solverConfig = new SolverConfig();

  // Init property panel
  const propertyPanel = new PropertyPanel();

  // Init testing controller
  const testingController = new TestingController();

  // Init context
  const afvContext: AfvContext = {
    extension: context,
    testingStore,
    testingController,
    propertyPanel,
    solverConfig
  };

  // Init workspaces
  testingStore.initialize(afvContext).then(() => {

    // Activate modules
    solverConfig.activate(afvContext);
    propertyPanel.activate(afvContext);
    testingController.activate(afvContext);
    
  });
}

// This method is called when your extension is deactivated
export function deactivate() {}