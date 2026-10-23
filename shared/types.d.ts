// Test

type RunStatus = "undetermined" | "valid" | "invalid";

type Test = {
  id: string;
  name: string;
  group: Array<string>;
  location: TestLocation;
  status: RunStatus;
  isWaiting: boolean;
  isRunning: boolean;
  time?: number;
  workspaceId: string;
};

type TestRange = {
  start: TestRangePosition;
  end: TestRangePosition;
};

type TestRangePosition = {
  line: number;
  character: number;
};

type TestLocation = {
  path: string;
  range: TestRange;
};

type TestRun = {
  workspaceId: string;
  testIds?: Array<string>;
};

type Workspace = {
  id: string;
  path: string;
};

type TestWorkspace = Workspace & {
  status: RunStatus;
  isWaiting: boolean;
  isRunning: boolean;
  isOpen: boolean;
  time?: number;
};

// Test Tree

type GenericMap<T> = Record<string, T>;

type TestTree = {
  workspaces: GenericMap<TestTreeWorkspaceNode>;
};

type TestTreeWorkspaceNode = TestWorkspace & {
  nodes: GenericMap<TestTreeGroupNode>;
};

type TestTreeGroupNode = {
  type: "folder" | "file";
  name: string;
  isOpen: boolean;
};

type TestTreeFolderNode = TestTreeGroupNode & {
  type: "folder";
  nodes: GenericMap<TestTreeGroupNode>;
};

type TestTreeFileNode = TestTreeGroupNode & {
  type: "file";
  tests: GenericMap<Test>;
};

// Test Result

type TestResult = {
  steps?: Array<CounterexampleStep>;
  graph?: Array<GraphTx>;
};

type CounterexampleStep = {
  txHash: string;
  data: Record<string, string>;
  discarded: boolean;
};

type GraphTx = {
  tx: GraphNodeTx;
  inputs: Array<GraphNodeUTxO>;
  outputs: Array<GraphNodeUTxO>;
};

type GraphNode = {
  type: "tx" | "utxo";
  identifier: string;
  label: string;
};

type GraphNodeTx = GraphNode & {
  type: "tx";
  id: string;
  fee: number;
  mint?: TxValue;
  inputCount: number;
  outputCount: number;
};

type GraphNodeUTxO = GraphNode & {
  type: "utxo";
  consumed: boolean;
  address: string;
  utxo: string;
  value: TxValue;
  datum?: string;
  redeemer?: string;
};

type TxValue = {
  lovelace: number;
  assets: Array<TxAsset>;
};

type TxAsset = {
  name: string;
  policyId: string;
  quantity: number;
};

// Webview Message

type TestTreePayload = {
  testTree: TestTree;
};

type TestTreeUpdate =
| { type: 'test', test: Test }
| { type: 'workspace', workspace: TestTreeWorkspaceUpdate };

type TestTreeWorkspaceUpdate = {
  id: string;
  status?: RunStatus;
  isWaiting?: boolean;
  isRunning?: boolean;
  isOpen?: boolean;
  time?: number;
  nodes?: GenericMap<TestTreeGroupNode>;
};

type TestResultPayload = {
  test: Test;
  result: TestResult;
};

type TestRunPayload = {
  testRuns: Array<TestRun>;
};

type OpenResultPayload = {
  workspaceId: string;
  testId: string;
};

type UpdateOpenStatePayload = {
  isOpen: boolean;
  workspaceId: string;
  group?: Array<string>;
};

type ExtensionToWebviewMessage =
  | { type: "test-tree"; payload: TestTreePayload }
  | { type: "test-tree-error"; payload: { message: string } }
  | { type: "test-tree-update"; payload: TestTreeUpdate }
  | { type: "test-result"; payload: TestResultPayload };

type WebviewToExtensionMessage =
  | { type: "webview-ready" }
  | { type: "test-tree-fetch" }
  | { type: "test-tree-run"; payload: TestRunPayload }
  | { type: "test-tree-open-result"; payload: OpenResultPayload }
  | { type: "test-tree-update-open-state"; payload: UpdateOpenStatePayload }
  | { type: "test-tree-open-folder" };

// RPC Messages

type RpcFetchParams = {
  workspaces: Array<Workspace>;
};

type RpcFetchResponse = {
  testTree: TestTree;
};

type RpcTestRun = {
  workspacePath: string;
  testIds?: Array<string>;
};

type RpcRunParams = {
  testRuns: Array<RpcTestRun>;
};

// Test Event

type TestEventType = "test-update" | "test-result" | "test-error";

type TestEvent = {
  type: TestEventType;
  payload: unknown;
};

type TestUpdateEvent = TestEvent & {
  type: "test-update";
  payload: {
    workspaceId: string;
    testId: string;
    status?: RunStatus;
    isRunning?: boolean;
    time?: number;
  };
};

type TestResultEvent = TestEvent & {
  type: "test-result";
  payload: {
    workspaceId: string;
    testId: string;
    result: TestResult;
  };
};

type TestErrorEvent = TestEvent & {
  type: "test-error";
  payload: {
    workspaceId: string;
    testId: string;
    error: {
      message: string;
      trace?: string;
    };
  };
};
