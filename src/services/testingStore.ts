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
] as TheoremCounterexampleStep[];

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
} as TheoremGraph;

export default class TestingStore {
  private rpcClient: RpcClient;
  private workspaces: Workspace[] | null = null;
  private theoremResults: Map<string, TheoremResult> = new Map();
  private theoremUpdateCallbacks: ((result: TheoremResult) => void)[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.rpcClient = new RpcClient(context);
  }

  public async initialize(context: AfvContext): Promise<void> {
    await this.rpcClient.initialize();

    this.rpcClient.onTestResult((result: TheoremResult) => {

      // TODO: Remove this when implementing counterexample data support
      result.counterexampleSteps = MOCK_COUNTEREXAMPLE_STEPS;

      // TODO: Remove this when implementing theorem graph data support
      result.graph = MOCK_GRAPH;
      
      this.theoremResults.set(result.theorem.id, result);
      this.notifyTheoremUpdate(result);
    });
  }

  public async fetchWorkspaces(): Promise<Workspace[]> {
    if (this.workspaces !== null) {
      return this.workspaces;
    }
    const workspaces = await this.rpcClient.fetchWorkspaces();
    this.updateWorkspaces(workspaces);
    return workspaces;
  }

  private updateWorkspaces(workspaces: Workspace[]): void {
    this.workspaces = workspaces;
    for (const workspace of workspaces) {
      this.updateWorkspaceNodes(workspace.children);
    }
  }

  private updateWorkspaceNodes(nodes: Node[]): void {
    for (const node of nodes) {
      if (node.type === 'folder') {
        this.updateWorkspaceNodes((node as FolderNode).children);
      } else if (node.type === 'file') {
        for (const theorem of (node as FileNode).theorems) {
          if (!this.theoremResults.has(theorem.id)) {
            this.theoremResults.set(theorem.id, {
              theorem, status: 'undetermined'
            });
          }
        }
      }
    }
  }

  public async fetchTheoremResult(theoremId: string): Promise<TheoremResult> {
    if (this.theoremResults.has(theoremId)) {
      return this.theoremResults.get(theoremId)!;
    }
    const result = await this.rpcClient.fetchTheoremResult(theoremId);

    // TODO: Remove this when implementing counterexample data support
    result.counterexampleSteps = MOCK_COUNTEREXAMPLE_STEPS;

    // TODO: Remove this when implementing theorem graph data support
    result.graph = MOCK_GRAPH;

    this.theoremResults.set(theoremId, result);
    return result;
  }

  public getTheoremResults(): Map<string, TheoremResult> {
    return this.theoremResults;
  }

  public onTheoremUpdate(callback: (result: TheoremResult) => void): void {
    this.theoremUpdateCallbacks.push(callback);
  }

  private notifyTheoremUpdate(result: TheoremResult): void {
    for (const callback of this.theoremUpdateCallbacks) {
      callback(result);
    }
  }

  public runTheorem(theoremIds: string[]): void {
    for (const theoremId of theoremIds) {
      if (this.theoremResults.has(theoremId)) {
        this.theoremResults.get(theoremId)!.status = 'running';
        this.theoremResults.get(theoremId)!.time = 0;
        this.notifyTheoremUpdate(this.theoremResults.get(theoremId)!);
      }
    }
    this.rpcClient.runTheorem(theoremIds);
  }

}