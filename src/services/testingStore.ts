import * as vscode from 'vscode';

import RpcClient from './rpcClient';
import { AfvContext } from '../extension';

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
      result.counterexampleSteps = [
        { datum: 'datum1', redeemer: 'redeemer1', tx: '1111' },
        { datum: 'datum2', redeemer: 'redeemer2', tx: '2222' },
        { datum: 'datum3', redeemer: 'redeemer3', tx: '3333' },
        { datum: 'datum4', redeemer: 'redeemer4', tx: '4444' },
      ];
      
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
    result.counterexampleSteps = [
      { datum: 'datum1', redeemer: 'redeemer1', tx: '1111' },
      { datum: 'datum2', redeemer: 'redeemer2', tx: '2222' },
      { datum: 'datum3', redeemer: 'redeemer3', tx: '3333' },
      { datum: 'datum4', redeemer: 'redeemer4', tx: '4444' },
    ];

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