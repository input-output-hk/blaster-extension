// Test

type RunStatus = "empty" | "undetermined" | "valid" | "invalid" | "error";

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
  haskell?: HaskellProperty;
};

// A UAL property found by a Haskell generator (scripts/blueprints/list-generators.js)
type HaskellProperty = {
  generator: string;
  propertyId: string;
  index: number;
  kind: "explicit" | "template";
  title?: string;
  content?: string;
  // The scripts a template property applies to (assurance `scope`), filled in after generation
  scope?: string;
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
  tests?: {
    uri: string;
    ids?: Array<string>;
  }[];
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
  type: "folder" | "file" | "generator";
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
  error?: string;
};

// Bundle generation (`cabal run … --ndjson`) of one generator, after discovery
type GeneratorState =
  | { kind: "pending" }
  | { kind: "generating" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

// A Haskell generator (Cabal executable target); its name is the full target
type TestTreeGeneratorNode = TestTreeGroupNode & {
  type: "generator";
  tests: GenericMap<Test>;
  error?: string;
  state?: GeneratorState;
};

type TestTreeItem =
  | { type: "group"; workspaceId: string; node: TestTreeGroupNode }
  | { type: "test"; test: Test };

type DiscoveryFileError = {
  workspaceId: string;
  group: Array<string>;
  message: string;
  type?: "generator";
};

type TestTreeFilter = {
  text?: string;
};

type VisibleItem = TestTreeWorkspaceNode | TestTreeGroupNode | Test;

type EditorFilesPayload = {
  activeFile?: string;
  openFiles: Array<string>;
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

type TestActionType = 'fetch' | 'run' | 'clear';

type TestTreeActionState = {
  isBusy: boolean;
  currentAction?: {
    type: TestActionType;
    startedAt: number;
    isCancelling: boolean;
  };
  run?: {
    startedAt: number;
    finishedAt?: number
  };
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

// Opens a generated bundle file: a property's checking context, or a pick of all the generator's files
type OpenBundleFilePayload = {
  workspaceId: string;
  generator: string;
  propertyId?: string;
};

type UpdateOpenStatePayload = {
  isOpen: boolean;
  workspaceId: string;
  group?: Array<string>;
};

type ExtensionToWebviewMessage =
  | { type: "test-tree"; payload: TestTreePayload }
  | { type: "test-tree-error" }
  | { type: "test-tree-dependency-error" }
  | { type: "test-tree-update"; payload: TestTreeUpdate }
  | { type: "editor-files"; payload: EditorFilesPayload }
  | { type: "test-tree-action-state"; payload: TestTreeActionState }
  | { type: "test-result"; payload: TestResultPayload };

type WebviewToExtensionMessage =
  | { type: "webview-ready" }
  | { type: "test-tree-fetch" }
  | { type: "test-tree-run"; payload: TestRunPayload }
  | { type: "test-tree-open-result"; payload: OpenResultPayload }
  | { type: "test-tree-open-location"; payload: TestLocation }
  | { type: "test-tree-open-bundle-file"; payload: OpenBundleFilePayload }
  | { type: "test-tree-update-open-state"; payload: UpdateOpenStatePayload }
  | { type: "test-tree-open-folder" }
  | { type: "test-tree-open-install-guide" };

// Test Event

type TestEventType = "test-update" | "test-result" | "test-error" | "test-run-failed";

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

type TestRunFailedEvent = TestEvent & {
  type: "test-run-failed";
  payload: {
    testRun: TestRun;
    error: {
      message: string;
      trace?: string;
    };
  };
};
