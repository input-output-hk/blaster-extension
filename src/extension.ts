// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { exec } from 'child_process'; 
import { registerPropertyPanel } from './views/propertyPanel';

//Dependencies required to run the extension
const requiredDependencies = [
  // { command: 'afv', errorMessage: 'The Automatic Formal Verification tool is not installed. Please install it before using the extension.' },
  { command: 'z3', errorMessage: 'Z3 is not installed. Please install it before using the extension.' },
  { command: 'lean', errorMessage: 'Lean is not installed. Please install it before using the extension.' },
  // add a check for Lean and other dependencies as needed and offer to install them
];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	checkEnvSetup(requiredDependencies);

  //register the test explorer view
  const testCtrl = vscode.tests.createTestController('propertyPanel', 'Property Panel');
  registerPropertyPanel(testCtrl);
  
	// regsiter any commands the property panel needs to use

	// register the other views in the extension

  // push disposable resources to the context
  context.subscriptions.push(testCtrl);
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