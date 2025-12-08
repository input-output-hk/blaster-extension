// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import RpcClient from './services/rpcClient';
import SolverConfig from './modules/solverConfig';
import PropertyPanel from './modules/propertyPanel';

export type AfvContext = {
  extension: vscode.ExtensionContext;
  rpcClient: RpcClient;
  propertyPanel: PropertyPanel;
  solverConfig: SolverConfig;
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  // Init rpc client
  const rpcClient = new RpcClient(context);

  // Init solver config
  const solverConfig = new SolverConfig();

  // Init property panel
  const propertyPanel = new PropertyPanel();

  // Init context
  const afvContext: AfvContext = {
    extension: context,
    rpcClient,
    propertyPanel,
    solverConfig
  };

  // Init workspaces
  rpcClient.initialize(afvContext).then(() => {

    // Activate modules
    solverConfig.activate(afvContext);
    propertyPanel.activate(afvContext);
  
  });
}

// This method is called when your extension is deactivated
export function deactivate() {}