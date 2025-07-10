import * as vscode from 'vscode';
import useStore from '../store/store';

export async function registerPropertyPanel(testCtrl: vscode.TestController) {
        await getTreeList();
        const { fileTree } = useStore.getState();

        if (!fileTree) return;

        const rootItem = testCtrl.createTestItem(fileTree.path, fileTree.label, vscode.Uri.file(fileTree.path));
	    testCtrl.items.add(rootItem);

        for (const file of fileTree.children || []) {
		if (file.type === 'file') {
			const fileUri = vscode.Uri.file(file.path);
			const fileItem = testCtrl.createTestItem(file.path, file.label, fileUri);
			rootItem.children.add(fileItem);

		    }
	    }

        testCtrl.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, (request, token) => {
        const run = testCtrl.createTestRun(request);

        for (const test of request.include ?? []) {
            run.started(test);
            run.passed(test); 
        }

        run.end();
    }, true);
    }

const rootFolder = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0)) ? vscode.workspace.workspaceFolders[0] : undefined;
const { changeFileTree, fileTree } = useStore.getState();

async function getTreeList(){
    if (!rootFolder) {
        vscode.window.showErrorMessage('No workspace folder is open. Please open a folder to use this extension.');
        return;
    }

    const treeList: string[] = [];
    const files = vscode.workspace.findFiles('**/*.lean');
    
    await files.then((fileUris) => {
        fileUris.forEach(fileUri => {
            treeList.push(fileUri.path);
        });
    });

    await changeFileTree({
        label: rootFolder.name,
        path: rootFolder.uri.fsPath,
        timeToExecute: '',
        status: 'unchecked',
        type: 'folder',
        children: treeList.map(filePath => ({
            label: filePath.split('/').pop() || '',
            path: filePath,
            timeToExecute: '',
            status: 'unchecked',
            type: 'file'
        }))
    });

    return fileTree;
}