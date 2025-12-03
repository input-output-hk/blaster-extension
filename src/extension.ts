// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { exec } from 'child_process'; 
import { registerPropertyPanel } from './views/propertyPanel';
import { SolverConfigProvider, getWebviewHtml } from './views/webviewConfig';
import useStore from './store/store';

//Dependencies required to run the extension
const requiredDependencies = [
  { command: 'sc-verifier', errorMessage: 'SC Verifier is not found. Please install and make sure the executable is is globally accessible.' },
  { command: 'z3', errorMessage: 'Z3 is not installed. Please install it before using the extension.' },
  { command: 'lean', errorMessage: 'Lean is not installed. Please install it before using the extension.' },
];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	checkEnvSetup(requiredDependencies);

  //register the test explorer view
  const testCtrl = vscode.tests.createTestController('propertyPanel', 'Property Panel');
  registerPropertyPanel(testCtrl, context);

  //register the solver configurations view
  const solverConfigProvider = vscode.window.registerWebviewViewProvider('solverConfigurations', new SolverConfigProvider(context.extensionUri));

  let panel: vscode.WebviewPanel | undefined = undefined;

	//register command to open property results in a webview panel
  const viewResultsCommand = vscode.commands.registerCommand('afv.openPropertyResults', (testItem?: vscode.TestItem) => {

    //define the column to show the webview panel in
    const columnToShowIn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

    //get test item data from the store
    const { getPropertyNode, getFirstPropertyNode, propertyList } = useStore.getState();
    const propertyNode = testItem ? getPropertyNode(testItem.label) : getFirstPropertyNode();

    //check if webview panel is already open
    if (panel) {
      panel.reveal(columnToShowIn);

      //send the test item data to the webview
      if (propertyNode) {
        panel.webview.postMessage({ type: 'loadTestItem', payload: propertyNode });
      }
    } else {
      //register the property results view
    panel = vscode.window.createWebviewPanel(
      'propertyResults',
      'Property Results',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, 'build');
    // console.log('🔍 Final HTML passed to webview:\n', panel.webview.html);

    // Listen for messages from the webview
    panel.webview.onDidReceiveMessage(
      message => {
        if (message.type === 'webviewReady' && propertyNode) {
          panel!.webview.postMessage({ type: 'loadPropertyResults', payload: propertyNode });
        }
      },
      undefined,
      context.subscriptions
    );

    //dispose resources on panel close
    panel.onDidDispose(() => {
      panel = undefined;
    }, null, context.subscriptions);
    }
  });

  // push disposable resources to the context
  context.subscriptions.push(testCtrl, solverConfigProvider, viewResultsCommand);
}

// Function to check if required dependencies are installed
async function checkEnvSetup(packages: {command: string; errorMessage: string}[]) {
  for (const pkg of packages) {
    exec(`${pkg.command} --version`, (err, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(pkg.errorMessage);
          console.error('Env setup check cmd failed:', err.message);
          return;
        }
        if (stderr) {
          console.error('Env setup check stderr:', stderr);
          return;
        }
      }
    );
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}