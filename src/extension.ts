// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { exec } from 'child_process'; 
import { workspacePathURI } from './utils';
import { PropertyPanelProvider } from './views/propertyPanel';

//Dependencies required to run the extension
const requiredDependencies = [
  { command: 'afv', errorMessage: 'The Automatic Formal Verification tool is not installed. Please install it before using the extension.' },
  { command: 'z3', errorMessage: 'Z3 is not installed. Please install it before using the extension.' },
];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	checkEnvSetup(requiredDependencies);

	// register the tree view provider for the property panel
	const propertyPanelProvider = new PropertyPanelProvider(workspacePathURI);
   // registerTreeDataProvider<T>(viewId: string, treeDataProvider: TreeDataProvider<T>):
	vscode.window.registerTreeDataProvider('property-panel', propertyPanelProvider);
	// regsiter any commands the property panel needs to use

	// register the other views in the extension
}

async function checkEnvSetup(packages: {command: string; errorMessage: string}[]) {
  for (const pkg of packages) {
    exec(`${pkg.command} --version`, (error) => {
        if (error) {
          vscode.window.showErrorMessage(pkg.errorMessage);
          return;
        }
      }
    );
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}