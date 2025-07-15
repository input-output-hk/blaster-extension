import * as vscode from 'vscode';
import * as fs from 'fs';
import useStore from '../store/store';
import { TreeNode, PropertyNode } from '../store/types';

// Function to register the property panel in the Test Explorer
export async function registerPropertyPanel(testCtrl: vscode.TestController) {
        await getTreeList();
        const { fileTree } = useStore.getState();

        if (!fileTree) {
            console.warn('Could not load file tree. Ensure that the workspace is set up correctly.');
            return;
        }

        const rootItem = testCtrl.createTestItem(fileTree.path, fileTree.label, vscode.Uri.file(fileTree.path));
	    testCtrl.items.add(rootItem);

        for (const file of fileTree.children || []) {
		if (file.type === 'file') {
			const fileUri = vscode.Uri.file(file.path);
			const fileItem = testCtrl.createTestItem(file.path, file.label, fileUri);
            fileItem.canResolveChildren = true;
			rootItem.children.add(fileItem);
            if (file.children && file.children.length > 0) {
                fileItem.description = `${file.children.length} ${file.children.length > 1 ? 'properties' : 'property'}`;
                for (const prop of file.children) {
                    const propItem = testCtrl.createTestItem(prop.label, prop.label, fileUri);
                    fileItem.children.add(propItem);
                }
            } else {
                fileItem.description = 'No properties found';
            }
	    }
    }
}

// Get the root folder of the workspace
const rootFolder = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0)) ? vscode.workspace.workspaceFolders[0] : undefined;

// Import the store to manage the file tree state
const { changeFileTree, fileTree } = useStore.getState();

// Function to get the list of Lean files in the workspace and update the file tree
async function getTreeList(){
    if (!rootFolder) {
        vscode.window.showErrorMessage('No workspace folder is open. Please open a folder to use this extension.');
        return;
    }
   
    const treeList: TreeNode[] = [];
    const leanTestFolder = new vscode.RelativePattern(rootFolder, 'DemoRareEvo/*.lean');
    const files = vscode.workspace.findFiles(leanTestFolder);

    await files.then((fileUris) => {
        fileUris.forEach(fileUri => {
            treeList.push([fileUri.path, fileUri.path.split('/').pop() || '', []]);
        });
    });
    
    await getProperties(treeList);

    await changeFileTree({
        label: rootFolder.name,
        path: rootFolder.uri.fsPath,
        timeToExecute: '',
        status: 'unchecked',
        type: 'folder',
        children: treeList.map(filePath => ({
            path: filePath[0],
            label: filePath[1],
            children: filePath[2].map(child => ({
                label: child || '',
                path: filePath[0],
                parentFile: filePath[1],
                timeToExecute: '',
                status: 'unchecked',
                type: 'property',
            })) as PropertyNode[],
            timeToExecute: '',
            status: 'unchecked',
            type: 'file',
        }))
    });

    return fileTree;
}

// Function to get properties of the files
async function getProperties(filePaths: TreeNode[]) {
    for (const file of filePaths) {
        const filePath = file[0];

        let content;
        try {
            content = fs.readFileSync(filePath, 'utf-8');
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            continue;
        }
        const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        const foundTheorems: string[] = [];

        for (const line of lines) {
            if (line.startsWith('theorem ')) {
                const match = line.match(/^theorem\s+([^\s:]+)\s*:/);
                console.log(match);
                if (match && match[1]) {
                    foundTheorems.push(match[1]);
                }
            }
        }

        file[2] = foundTheorems;
    }
}