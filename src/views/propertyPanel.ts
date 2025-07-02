import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class PropertyPanelProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    constructor(private workspacePathURI: string) {}

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (!this.workspacePathURI) {
			vscode.window.showInformationMessage('No properties in empty workspace');
			return Promise.resolve([]);
		}

        const propertiesPath = path.join(this.workspacePathURI, 'properties');
        if (!fs.existsSync(propertiesPath)) {
            return [];
        }

        const files = fs.readdirSync(propertiesPath);
        return files.map(file => new vscode.TreeItem(file, vscode.TreeItemCollapsibleState.None));
    }
}