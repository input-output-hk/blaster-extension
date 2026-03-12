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
}

type TheoremResultDetails = {
  diagnostics: TheoremResultDiagnostic[];
}

type TheoremResultDiagnostic = {
  message: string;
  severity: 'error' | 'warning' | 'information';
}