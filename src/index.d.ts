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
  details?: TheoremResultDetails;
	counterexampleSteps?: Record<string, string>[];
	graph?: TheoremGraph;
}

type TheoremResultDetails = {
  diagnostics: TheoremResultDiagnostic[];
}

type TheoremResultDiagnostic = {
  message: string;
	range: Range;
  severity: 'error' | 'warning' | 'information';
}

type TheoremGraph = {
	txs: {
		hash: string;
		block: string;
		slot: number;
		fees: number;
		size: number;
		outputAmount: {
			unit: string;
			quantity: number;
		}[];
		totalOutput: number;
		inputs: string[];
		outputs: string[];
	}[];
	utxos: {
		txHash: string;
		outputIndex: number;
		address: string;
		datum?: string;
		referenceScriptHash?: string;
		amount: {
			unit: string;
			quantity: number;
		}[];
	}[];
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