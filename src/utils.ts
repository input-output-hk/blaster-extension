import * as vscode from 'vscode';

//uri to the folder opened in the workspace
export let workspacePathURI = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0)) ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';
