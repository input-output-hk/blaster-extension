import * as vscode from 'vscode';
import * as fs from 'fs';
import { spawn } from 'node:child_process';
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
        const rootTag = new vscode.TestTag('root');
        rootItem.tags = [rootTag];
	    testCtrl.items.add(rootItem);

        const folderTag = new vscode.TestTag('folder');
        const propertyTag = new vscode.TestTag('property');

        for (const file of fileTree.children || []) {
		if (file.type === 'file') {
			const fileUri = vscode.Uri.file(file.path);
			const fileItem = testCtrl.createTestItem(file.path, file.label, fileUri);
            fileItem.tags = [folderTag];
            fileItem.canResolveChildren = true;
			rootItem.children.add(fileItem);
            if (file.children && file.children.length > 0) {
                fileItem.description = `${file.children.length} ${file.children.length > 1 ? 'properties' : 'property'}`;
                for (const prop of file.children) {
                    const propItem = testCtrl.createTestItem(prop.label, prop.label, fileUri);
                    propItem.tags = [propertyTag];
                    fileItem.children.add(propItem);
                }
            } else {
                fileItem.description = 'No properties found';
            }
	    }
    }

    testCtrl.createRunProfile('Run Proofs', vscode.TestRunProfileKind.Run, async (request, token) => {
        startTestRun(testCtrl, request, token);
    }, true);
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
        label: `${rootFolder.name}/DemoRareEvo`,
        path: `${rootFolder.uri.fsPath}/DemoRareEvo`,
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
                if (match && match[1]) {
                    foundTheorems.push(match[1]);
                }
            }
        }

        file[2] = foundTheorems;
    }
}

async function startTestRun(testCtrl: vscode.TestController, request: vscode.TestRunRequest, token: vscode.CancellationToken) {
    const run = testCtrl.createTestRun(request);
    const queue: vscode.TestItem[] = [];
    const testItems: vscode.TestItem[] = [];
    let cmdUri: string | undefined;
    let propFlag: string = '';

    if (request.include) {
        cmdUri = request.include[0].uri?.path;
        if (request.include[0].tags[0].id === 'property') {
            propFlag = request.include[0].label;
        }
        request.include.forEach(test => queue.push(test));
    } else {
        testCtrl.items.forEach(item => {
            if (!cmdUri) {
                if (item.uri) {
                    cmdUri = item.uri.path;
                } else {
                    console.warn('Test item does not have a URI:', item);
                }
            }
        });
        testCtrl.items.forEach(test => queue.push(test));
    }

    while (queue.length > 0 && !token.isCancellationRequested) {
        const test = queue.pop();
        if (!test) continue;

        if (test.children.size > 0) {
            test.children.forEach(child => queue.push(child));
            continue;
        }
        testItems.push(test);
        run.enqueued(test);
    }

    const cmd = `sc-verifier --json ${cmdUri} ${propFlag}`;
    console.log('This is the full command:', cmd);
    const runCmd = spawn(cmd, { shell: true });

    for (const test of testItems) {
        run.started(test);
    }

    token.onCancellationRequested(() => {
        console.warn('Test run was canceled. Stopping the command execution.');
        runCmd.kill(); 
        run.end();
    });

    runCmd.stdout.on('data', (data: any) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
            try {
                const result = JSON.parse(line);
                const testName = result['theorem'].split('.').pop();
                const testItem = testItems.find(item => item.label === testName);

                if (testItem) {
                    if (result['status'] === 'valid') {
                        run.passed(testItem);
                    } else if (result['status'] === 'falsified') {
                        run.failed(testItem, new vscode.TestMessage('falsified property'));
                    } else {
                        run.skipped(testItem);
                    }
                } else {
                    console.warn(`Test item not found for name: ${testName}`);
                }
            } catch (error) {
                console.error(`Error parsing line as JSON: ${error}`);
            }
        }
    });

    runCmd.stderr.on('data', (data: any) => {
        console.error(`stderr: ${data}`);
    });

    // runCmd.on('error', (error: any) => {
    //     console.error(`Error executing command: ${error.message}`);
    //     // run.end();
    // });

    runCmd.on('exit', (code: number) => {
        console.log(`Child process exited with code ${code}`);
        run.end();
    });    
}