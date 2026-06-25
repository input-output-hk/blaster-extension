type TestTree = {
  path: string;
  label: string;
  children: TestTreeNode[];
};

type TestTreeNode = {
  type: "folder" | "file";
  label: string;
  path: string;
};

type TestTreeFolderNode = TestTreeNode & {
  type: "folder";
  children: TestTreeNode[];
};

type TestTreeFileNode = TestTreeNode & {
  type: "file";
  tests: Test[];
};

type Range = {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
};

type Test = {
  id: string;
  label: string;
  path: string;
  range: Range;
};

type TestResult = {
  test: Test;
  time?: number;
  status: "undetermined" | "running" | "valid" | "invalid";
  details?: TestDetails;
  counterexampleSteps?: TestCounterexampleStep[];
  graph?: TestGraph;
};

type TestDetails = {
  diagnostics: TestDiagnostic[];
};

type TestDiagnostic = {
  message: string;
  range?: Range;
  severity: "error" | "warning" | "information";
};

type TestCounterexampleStep = {
  txHash: string;
  data: Record<string, string>;
  discarded: boolean;
};

type PlutusDataField = { bytes: string } | { int: number } | { list: PlutusDataField[] } | { map: unknown };
type PlutusData = { constructor: number; fields: PlutusDataField[] };

type TestGraph = {
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
    datum?: unknown;
    referenceScriptHash?: string;
    amount: {
      unit: string;
      quantity: number;
    }[];
  }[];
};

type TestResultDetail = {
  type: "tx" | "datum" | "redeemer";
  data: Record<string, any>;
};

type TestResultTxDetail = TestResultDetail & {
  type: "tx";
  data: {
    inputs: TestGraph["utxos"];
    outputs: TestGraph["utxos"];
  };
};

type ExtensionToWebviewMessage =
  | { type: "test-result"; payload: TestResult }
  | {
      type: "test-tree";
      payload: {
        testTree: TestTree[];
        testResults?: Record<string, TestResult>;
      };
    }
  | { type: "test-result-detail"; payload: TestResultDetail };

type WebviewToExtensionMessage =
  | { type: "webview-ready" }
  | { type: "scan-workspace" }
  | { type: "change-test"; payload: { testId: string } }
  | { type: "run-test"; payload?: { testIds: string[] } }
  | { type: "open-result"; payload: { testId: string } }
  | {
      type: "open-result-detail";
      payload: { type: "tx" | "datum" | "redeemer"; id: string };
    }
  | { type: "notify"; payload: { text: string } };
