import * as fs from 'fs';
import * as rpc from 'vscode-jsonrpc/node';
import * as crypto from 'node:crypto';

type Workspace = {
	path: string;
	label: string;
	children: Node[];
}

type Node = {
	type: 'folder' | 'file';
	label: string;
	path: string;
}

type FolderNode = Node & {
	type: 'folder';
	children: Node[];
}

type FileNode = Node & {
	type: 'file';
	theorems: Theorem[];
}

type Theorem = {
	id: string;
	label: string;
	path: string;
	range: Range;
}

type Range = {
	startLine: number;
	startCharacter: number;
	endLine: number;
	endCharacter: number;
}

type TheoremResult = {
	theorem: Theorem;
	time?: number;
	status: 'undetermined' | 'running' | 'valid' | 'invalid';
}

type WorkspaceParams = {
	workspacePaths: string[];
}

let WORKSPACES: Workspace[] = [];
let RESULTS: Record<string, TheoremResult> = {};

const initializeWorkspace = (paths: string[]) => {
	let workspaces: Workspace[] = [];
	for (const path of paths) {
		const workspace: Workspace = {
			path,
			label: path.split('/').pop() || '',
			children: readFolderNode(path).children
		};

		if (workspace.children.length > 0) {
			workspaces.push(workspace);
		}
	}

	WORKSPACES = workspaces;
};

const readFolderNode = (path: string): FolderNode => {
	const folderNode: FolderNode = {
		path,
		type: 'folder',
		label: path.split('/').pop() || '',
		children: []
	};

	const items = fs.readdirSync(path, { withFileTypes: true });
	for (const item of items) {
		const itemPath = `${path}/${item.name}`;
		if (item.isDirectory()) {
			const subFolderNode = readFolderNode(itemPath);
			if (subFolderNode.children.length > 0) {
				folderNode.children.push(subFolderNode);
			}
		}
		else if (item.isFile() && item.name.endsWith('.lean')) {
			const fileNode = readFileNode(itemPath);
			if (fileNode.theorems.length > 0) {
				folderNode.children.push(fileNode);
			}
		}
	}

	return folderNode;
};

const readFileNode = (path: string): FileNode => {
	const fileNode: FileNode = {
		path,
		type: 'file',
		label: path.split('/').pop() || '',
		theorems: []
	};

	fs.readFileSync(path, 'utf-8').split('\n').forEach((line, index) => {
		if (line.startsWith('theorem ')) {
			const match = line.match(/^theorem\s+([^\s{(]+)/);
			if (match && match[1]) {
				const theorem = {
					id: crypto.randomBytes(10).toString('hex'),
					path,
					label: match[1],
					range: {
						startLine: index,
						startCharacter: 0,
						endLine: index,
						endCharacter: line.length
					}
				};
				fileNode.theorems.push(theorem);
				RESULTS[theorem.id] = { theorem, status: 'undetermined' };
			}
		}
	});

	return fileNode;
};

const connection = rpc.createMessageConnection(
	new rpc.StreamMessageReader(process.stdin),
	new rpc.StreamMessageWriter(process.stdout)
);

const initializeWorkspaceNotification = new rpc.NotificationType<WorkspaceParams>('initializeWorkspace');
connection.onNotification(initializeWorkspaceNotification, (params: WorkspaceParams) => {
	initializeWorkspace(params.workspacePaths);
	connection.sendNotification('workspaceInitialized');
});

const updateWorkspaceNotification = new rpc.NotificationType<WorkspaceParams>('updateWorkspace');
connection.onNotification(updateWorkspaceNotification, (params: WorkspaceParams) => {
	initializeWorkspace(params.workspacePaths);
});

const getWorkspaceRequest = new rpc.RequestType<void, Workspace[], void>('getWorkspace');
connection.onRequest(getWorkspaceRequest, () => WORKSPACES);

const runTheorem = async (theoremId: string): Promise<void> => {
	RESULTS[theoremId].status = 'running';

	const randomTime = Math.floor(Math.random() * 5000) + 1000;
	await new Promise<void>((resolve) => setTimeout(() => resolve(), randomTime));

	RESULTS[theoremId].time = randomTime;
	RESULTS[theoremId].status = Math.random() > 0.5 ? 'valid' : 'invalid';

	connection.sendNotification('testResult', RESULTS[theoremId]);
};

const runTheoremNotification = new rpc.NotificationType<string[]>('runTheorem');
connection.onNotification(runTheoremNotification, (theoremIds: string[]) => {
	for (const theoremId of theoremIds) {
		runTheorem(theoremId);
	}
});

const getTheoremResultRequest = new rpc.RequestType<string, TheoremResult, void>('getTheoremResult');
connection.onRequest(getTheoremResultRequest, (theoremId: string) => RESULTS[theoremId]);

connection.listen();