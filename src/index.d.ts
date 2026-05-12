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

type WorkspaceParams = {
	workspacePaths: string[];
}

type RunTheoremParams = {
	theoremIds: string[];
}

type FetchTheoremResultParams = {
	theoremId: string;
}
