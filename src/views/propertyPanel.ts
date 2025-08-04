import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'node:child_process';
import useStore from '../store/store';
import { FolderNode, FileNode, PropertyNode } from '../store/types';

// Function to register the property panel in the Test Explorer
export async function registerPropertyPanel(testCtrl: vscode.TestController) {
        await constructTreeList();
        const { fileTree } = useStore.getState();

        if (!fileTree) {
            console.warn('Could not load file tree. Ensure that the workspace is set up correctly.');
            return;
        }

        const rootTag = new vscode.TestTag('root');
        const folderTag = new vscode.TestTag('folder');
        const fileTag = new vscode.TestTag('file');
        const propertyTag = new vscode.TestTag('property');

        const addChildren = (parentItem: vscode.TestItem, node: FolderNode) => {
            for (const child of node.children || []) {
                const childUri = vscode.Uri.file(child.path);
                const childItem = testCtrl.createTestItem(child.path, child.label, childUri);

                if (child.type === 'folder') {
                    childItem.tags = [folderTag];
                    childItem.canResolveChildren = true;
                    parentItem.children.add(childItem);
                    addChildren(childItem, child);
                } else if (child.type === 'file') {
                    childItem.tags = [fileTag];
                    childItem.canResolveChildren = true;
                    parentItem.children.add(childItem);
                    childItem.description = `${child.children.length} ${child.children.length > 1 ? 'properties' : 'property'}`;
                    for (const prop of child.children) {
                        const propItem = testCtrl.createTestItem(prop.label, prop.label, childUri);
                        propItem.tags = [propertyTag];
                        childItem.children.add(propItem);
                    }
                }
            }
        };

    for (const root of fileTree) {
            const rootItem = testCtrl.createTestItem(root.path, root.label, vscode.Uri.file(root.path));
            rootItem.tags = [rootTag];
            testCtrl.items.add(rootItem);
            addChildren(rootItem, root);
        }

    testCtrl.createRunProfile('Run Proofs', vscode.TestRunProfileKind.Run, async (request, token) => {
        startTestRun(testCtrl, request, token);
    }, true);
}

// Import the store to manage the file tree state
const { createFileTree } = useStore.getState();

// Function to get the list of Lean files in the workspace and update the file tree
async function constructTreeList(){
    // Get the root folder of the workspace
    const rootFolder = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0)) ? vscode.workspace.workspaceFolders : undefined;

    if (!rootFolder) {
        vscode.window.showErrorMessage('No workspace folder is open. Please open a folder to use this extension.');
        return;
    }

    //Check if the user has a single or multiroot folder workspace set up and recursively read the folder structure accordingly
    const treeList = await Promise.all(rootFolder.map(folder => readFolderRecursively(folder.uri.fsPath)));
  
    await createFileTree(treeList);

    return treeList;
}

async function readFolderRecursively(currentPath: string): Promise<FolderNode>{
    const folderNode: FolderNode = {
        label: path.basename(currentPath),
        path: currentPath,
        timeToExecute: '',
        status: 'unchecked',
        type: 'folder',
        children: [] as Array<FileNode | FolderNode>,
    };

    let subChildren = fs.readdirSync(currentPath, {withFileTypes: true});

    for (const child of subChildren) {
        const itemPath = path.join(currentPath, child.name);

        if (child.isDirectory()) {
            const subFolder = await readFolderRecursively(itemPath);
            if (subFolder.children.length > 0) {
                folderNode.children.push(subFolder);
            }
        } else if (child.isFile() && child.name.endsWith('.lean')) {
            const props = await getProperties(child);
            if (props && props.length > 0) {
                const fileNode: FileNode = {
                    label: child.name,
                    path: itemPath,
                    timeToExecute: '',
                    status: 'unchecked',
                    type: 'file',
                    children: props.map(prop => ({
                        label: prop,
                        path: itemPath,
                        parentFile: child.name,
                        timeToExecute: '',
                        status: 'unchecked',
                        type: 'property',
                    })),
                };
                folderNode.children.push(fileNode);
            }
        }
    }
    return folderNode;
}

// Function to get properties of the files
async function getProperties(leanFile: fs.Dirent<string>) {
    const filePath = `${leanFile.parentPath}/${leanFile.name}`;

    let content;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
    }
    if (!content) {
        console.warn(`No content found in file ${filePath}. Skipping.`);
        return;
    }
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    const foundTheorems: string[] = [];

    for (const line of lines) {
        if (line.startsWith('theorem ')) {
            console.log(`Found theorem in file ${filePath}:`, line);
            const match = line.match(/^theorem\s+([^\s{(]+)/);
            if (match && match[1]) {
                foundTheorems.push(match[1]);
            }
        }
    }

    return foundTheorems;
}

async function startTestRun(testCtrl: vscode.TestController, request: vscode.TestRunRequest, token: vscode.CancellationToken) {
    console.log('Starting test run with request:', request);
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

    runCmd.on('error', (error: any) => {
        console.error(`Error executing command: ${error.message}`);
        // run.end();
    });

    runCmd.on('exit', (code: number) => {
        console.log(`Child process exited with code ${code}`);
        run.end();
    });    
}