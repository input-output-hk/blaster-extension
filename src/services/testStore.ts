import * as vscode from 'vscode';

import RpcClient from './rpcClient';
import { AfvContext } from '../extension';

const MOCK_COUNTEREXAMPLE_STEPS = [
  { txHash: 'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adba', data: { datum: 'datum1', redeemer: 'redeemer1', variable1: '1111' }, discarded: false },
  { txHash: 'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbb', data: { datum: 'datum2', redeemer: 'redeemer2', variable1: '2222' }, discarded: false },
  { txHash: 'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbc', data: { datum: 'datum3', redeemer: 'redeemer3', variable1: '3333' }, discarded: false },
  { txHash: 'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbd', data: { datum: 'datum4', redeemer: 'redeemer4', variable1: '4444' }, discarded: false },
  { txHash: 'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbe', data: {}, discarded: true },
  { txHash: 'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbf', data: {}, discarded: true },
  { txHash: 'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbg', data: {}, discarded: true },
  { txHash: 'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbh', data: {}, discarded: true },
] as TestCounterexampleStep[];

const MOCK_GRAPH = {
  txs: [{
    hash: 'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbc',
    block: '2ae4a1b9031aad886938983a712c43e5ae879bc21459eb2df1e8bb665e010375',
    slot: 181077899,
    fees: 1682177,
    size: 714,
    outputAmount: [
      { unit: 'lovelace', quantity: 510442733 },
      { unit: '1d9c0b541adc300c19ddc6b9fb63c0bfe32b1508305ba65b8762dc7b5449434b45543734', quantity: 1 },
    ],
    totalOutput: 510442733,
    inputs: [
      '31596ecbdcf102c8e5c17e75c65cf9780996285879d18903f035964f3a7499a8#0',
      '26741de9ee337aa24ebeea078832a901c4deacce261e142a23186b1691513863#1',
    ],
    outputs: [
      'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbc#0',
      'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbc#1',
      'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbc#2',
    ],
  },{
    hash: 'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbd',
    block: '2ae4a1b9031aad886938983a712c43e5ae879bc21459eb2df1e8bb665e010376',
    slot: 181077900,
    fees: 1682177,
    size: 700,
    outputAmount: [{ unit: 'lovelace', quantity: 510442733 }],
    totalOutput: 510442733,
    inputs: [
      'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbc#0',
      'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbc#1',
      '31596ecbdcf102c8e5c17e75c65cf9780996285879d18903f035964f3a7499a9#3',
    ],
    outputs: [
      'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbd#0',
      'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbd#1',
    ],
  }],
  utxos: [{
    txHash: '31596ecbdcf102c8e5c17e75c65cf9780996285879d18903f035964f3a7499a8',
    outputIndex: 0,
    address: 'addr1wy8ccvgzslpjf9yhrprvmqulpmjpkpxf8c0hvtjwvw8n6pqdcrnp0',
    referenceScriptHash: '1d9c0b541adc300c19ddc6b9fb63c0bfe32b1508305ba65b8762dc7b',
    amount: [{
      unit: 'lovelace',
      quantity: 12507620,
    }],
  },{
    txHash: '26741de9ee337aa24ebeea078832a901c4deacce261e142a23186b1691513863',
    outputIndex: 1,
    address: 'addr1wywecz65rtwrqrqemhrtn7mrczl7x2c4pqc9hfjmsa3dc7cr5pvqw',
    datum: 'Test Datum',
    amount: [{
      unit: 'lovelace',
      quantity: 1124910,
    },{
      unit: 'e1ddde8138579e255482791d9fba0778cb1f5c7b435be7b3e42069de425549444c45524645535432303236',
      quantity: 1,
    }],
  },{
    txHash: 'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbc',
    outputIndex: 0,
    address: 'addr1qygsresrr4z5zggkwee8kz808ea3mzn7prhgfmralnqxvjvz57923as3zdhkgevjhq24qefkj074en0efej63ejhn2asau4xh2',
    amount: [{
      unit: 'lovelace',
      quantity: 12507620,
    }],
  },{
    txHash: 'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbc',
    outputIndex: 1,
    address: 'addr1qygsresrr4z5zggkwee8kz808ea3mzn7prhgfmralnqxvjvz57923as3zdhkgevjhq24qefkj074en0efej63ejhn2asau4xh2',
    amount: [{
      unit: 'lovelace',
      quantity: 12507620,
    }],
  },{
    txHash: 'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbc',
    outputIndex: 2,
    address: 'addr1qygsresrr4z5zggkwee8kz808ea3mzn7prhgfmralnqxvjvz57923as3zdhkgevjhq24qefkj074en0efej63ejhn2asau4xh2',
    amount: [{
      unit: 'lovelace',
      quantity: 12507620,
    }],
  },{
    txHash: '31596ecbdcf102c8e5c17e75c65cf9780996285879d18903f035964f3a7499a9',
    outputIndex: 3,
    address: 'addr1wy8ccvgzslpjf9yhrprvmqulpmjpkpxf8c0hvtjwvw8n6pqdcrnp0',
    amount: [{
      unit: 'lovelace',
      quantity: 12507620,
    }],
  },{
    txHash: 'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbd',
    outputIndex: 0,
    address: 'addr1wy8ccvgzslpjf9yhrprvmqulpmjpkpxf8c0hvtjwvw8n6pqdcrnp0',
    amount: [{
      unit: 'lovelace',
      quantity: 12507620,
    }],
  },{
    txHash: 'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adbd',
    outputIndex: 1,
    address: 'addr1wy8ccvgzslpjf9yhrprvmqulpmjpkpxf8c0hvtjwvw8n6pqdcrnp0',
    amount: [{
      unit: 'lovelace',
      quantity: 12507620,
    }],
  }],
} as TestGraph;

export default class TestStore {
  private rpcClient: RpcClient;
  private testTree: TestTree[] | null = null;
  private testResults: Record<string, TestResult> = {};
  private testUpdateCallbacks: ((result: TestResult) => void)[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.rpcClient = new RpcClient(context);
  }

  public async initialize(context: AfvContext): Promise<void> {
    await this.rpcClient.initialize();

    this.rpcClient.onTestResult((result: TestResult) => {

      // TODO: Remove this when implementing counterexample data support
      result.counterexampleSteps = MOCK_COUNTEREXAMPLE_STEPS;

      // TODO: Remove this when implementing test graph data support
      result.graph = MOCK_GRAPH;
      
      this.testResults[result.test.id] = result;
      this.notifyTestUpdate(result);
    });
  }

  public async buildTestTree(): Promise<TestTree[]> {
    const testTree = await this.rpcClient.buildTestTree();
    this.updateTestTree(testTree);
    return testTree;
  }

  public getTestTree(): TestTree[] | null {
    return this.testTree;
  }

  private updateTestTree(testTree: TestTree[]): void {
    this.testTree = testTree;
    for (const test of testTree) {
      this.updateTestNodes(test.children);
    }
  }

  private updateTestNodes(nodes: TestTreeNode[]): void {
    for (const node of nodes) {
      if (node.type === 'folder') {
        this.updateTestNodes((node as TestTreeFolderNode).children);
      } else if (node.type === 'file') {
        for (const test of (node as TestTreeFileNode).tests) {
          if (!this.testResults[test.id]) {
            this.testResults[test.id] = {
              test, status: 'undetermined'
            }
          }
        }
      }
    }
  }

  public async fetchTestResult(testId: string): Promise<TestResult> {
    if (this.testResults[testId]) {
      return this.testResults[testId];
    }
    const result = await this.rpcClient.fetchTestResult(testId);

    // TODO: Remove this when implementing counterexample data support
    result.counterexampleSteps = MOCK_COUNTEREXAMPLE_STEPS;

    // TODO: Remove this when implementing test graph data support
    result.graph = MOCK_GRAPH;

    this.testResults[testId] = result;
    return result;
  }

  public getTestResults(): Record<string, TestResult> {
    return this.testResults;
  }

  public onTestUpdate(callback: (result: TestResult) => void): void {
    this.testUpdateCallbacks.push(callback);
  }

  private notifyTestUpdate(result: TestResult): void {
    for (const callback of this.testUpdateCallbacks) {
      callback(result);
    }
  }

  // Resolves input/output UTXOs for a tx hash by searching all cached test graphs.
  // UTxO refs are stored as "txHash#outputIndex" strings and matched against graph.utxos.
  // Returns null if no cached graph contains the transaction.
  public getTxDetail(txHash: string): TestResultDetail | null {
    const results = Object.values(this.testResults);

    const graph = results.map(r => r.graph).find(g => g?.txs.some(t => t.hash === txHash));
    if (!graph) return null;

    const tx = graph.txs.find(t => t.hash === txHash)!;

    const resolveRef = (ref: string) => {
      const [hash, idx] = ref.split('#');
      return graph.utxos.find(u => u.txHash === hash && u.outputIndex === Number(idx));
    };

    return {
      type: 'tx',
      data: {
        inputs: tx.inputs.map(resolveRef).filter(u => u !== undefined),
        outputs: tx.outputs.map(resolveRef).filter(u => u !== undefined),
      },
    };
  }

  public runTest(testIds: string[]): void {
    for (const testId of testIds) {
      if (this.testResults[testId]) {
        this.testResults[testId]!.status = 'running';
        this.testResults[testId]!.time = 0;
        this.notifyTestUpdate(this.testResults[testId]!);
      }
    }
    this.rpcClient.runTest(testIds);
  }

}