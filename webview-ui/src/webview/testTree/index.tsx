import { useEffect, useState } from 'react';

import LoadingView from './components/LoadingView';
import EmptyView from './components/EmptyView';
import ErrorView from './components/ErrorView';
import TreeView from './components/TreeView';

import {
  updateTest,
  updateTestWorkspace,
  updateOpenTestTreeNode
} from './utils/treeUpdateUtils';

import type { WebviewApi } from 'vscode-webview';

interface Props {
  vscode: WebviewApi<unknown>;
}

const TestTreeView: React.FC<Props> = ({ vscode }) => {
  const [activeView, setActiveView] = useState<'loading' | 'empty-tree' | 'tree' | 'error'>('loading');
  const [testTree, setTestTree] = useState<TestTree | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [operationState, setOperationState] = useState<TestOperationState>('idle');
  const [hasWorkspaceFolders, setHasWorkspaceFolders] = useState(false);

  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data as ExtensionToWebviewMessage;
      if (message.type === 'test-operation') {
        setOperationState(message.payload.state);
        if (message.payload.state === 'discovering') setActiveView('loading');
      }
      if (message.type === 'test-tree') {
        const hasTests = Object.values(message.payload.testTree.workspaces).some(workspace => Object.keys(workspace.nodes).length > 0);
        setHasWorkspaceFolders(message.payload.hasWorkspaceFolders ?? Object.keys(message.payload.testTree.workspaces).length > 0);
        setTestTree(message.payload.testTree);
        setActiveView(hasTests ? 'tree' : 'empty-tree');
        setError(undefined);
      }
      if (message.type === 'test-tree-error') {
        setError(message.payload.message);
        setActiveView('error');
      }
      if (message.type === 'test-tree-update') {
        setTestTree(testTree => {
          if (!testTree) return testTree;
          switch (message.payload.type) {
            case 'test':
              return updateTest(testTree, message.payload.test);
            case 'workspace':
              return updateTestWorkspace(testTree, message.payload.workspace);
          }
        });
      }
    };

    window.addEventListener('message', messageHandler);
    vscode.postMessage({ type: 'webview-ready' } as WebviewToExtensionMessage);
    
    return () => window.removeEventListener('message', messageHandler);
  }, [vscode]);

  const onFetchTestTree = () => {
    if (operationState !== 'idle') return;
    setActiveView('loading');
    vscode.postMessage({ type: 'test-tree-fetch' } as WebviewToExtensionMessage)
  };

  const onOpenFolder = () => {
    vscode.postMessage({ type: 'test-tree-open-folder' } as WebviewToExtensionMessage)
  };

  const onRunTest = (testRuns: Array<TestRun>) => {
    if (operationState !== 'idle') return;
    vscode.postMessage({ type: 'test-tree-run', payload: { testRuns } } as WebviewToExtensionMessage);
  };

  const onUpdateOpenTestTreeNode = (
    isOpen: boolean,
    workspaceId: string,
    group?: Array<string>
  ) => {
    setTestTree(testTree => {
      if (!testTree) return testTree;
      return updateOpenTestTreeNode(
        { ...testTree },
        isOpen,
        workspaceId,
        group
      );
    });

    vscode.postMessage({
      type: 'test-tree-update-open-state',
      payload: { isOpen, workspaceId, group }
    } as WebviewToExtensionMessage);
  };

  const onOpenTestResult = (workspaceId: string, testId: string) => {
    vscode.postMessage({ type: 'test-tree-open-result', payload: { workspaceId, testId } } as WebviewToExtensionMessage);
  };

  const onShowTestLocation = (workspaceId: string, testId: string) => {
    vscode.postMessage({ type: 'test-tree-show-location', payload: { workspaceId, testId } } satisfies WebviewToExtensionMessage);
  };

  return (
    <>
      {activeView === 'loading' && <LoadingView />}
      {activeView === 'error' &&
        <ErrorView
          message={error}
          onFetchTestTree={onFetchTestTree}
        />
      }
      {activeView === 'empty-tree' &&
        <EmptyView
          message={hasWorkspaceFolders ? 'empty-tree' : 'empty-workspaces'}
          onOpenFolder={onOpenFolder}
        />
      }
      {activeView === 'tree' && testTree !== null &&
        <TreeView
          testTree={testTree}
          isBusy={operationState !== 'idle'}
          onRunTest={onRunTest}
          onUpdateOpenTestTreeNode={onUpdateOpenTestTreeNode}
          onOpenTestResult={onOpenTestResult}
          onShowTestLocation={onShowTestLocation}
        />
      }
    </>
  )
};

export default TestTreeView;