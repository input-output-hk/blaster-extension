type Range = {
	startLine: number;
	startCharacter: number;
	endLine: number;
	endCharacter: number;
}

type Theorem = {
	id: string;
	label: string;
	path: string;
	range: Range;
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
	range?: Range;
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

type TheoremResultDetail = {
	cexLabel?: string;
	counterexample?: Record<string, string | string[]>;
	depth: number | null;
	expected: boolean;
	status: 'valid' | 'falsified' | 'running' | 'undetermined';
	timestamp: number;
	type: 'result';
}

type ExtensionToWebviewMessage =
	| { type: 'theorem-result'; payload: TheoremResult }
	| { type: 'workspaces'; payload: unknown }

type WebviewToExtensionMessage =
	| { type: 'webview-ready' }
	| { type: 'change-theorem'; payload: { theoremId: string } }
	| { type: 'run-theorem' }
