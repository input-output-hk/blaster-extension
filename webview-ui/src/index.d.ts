type Theorem = {
	id: string;
	label: string;
	path: string;
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
