import { useEffect, useState } from 'react';

import LoadingView from './components/LoadingView';
import EmptyView from './components/EmptyView';
import ErrorView from './components/ErrorView';
import TreeView from './components/TreeView';
import HelperText from './components/HelperText';

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
  const [actionState, setActionState] = useState<TestTreeActionState>({ isBusy: false });

  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data as ExtensionToWebviewMessage;
      if (message.type === 'test-tree') {
        const hasTests = Object.values(message.payload.testTree.workspaces).length > 0;
        setTestTree(message.payload.testTree);
        setActiveView(hasTests ? 'tree' : 'empty-tree');
      }
      if (message.type === 'test-tree-error') {
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
      if (message.type === 'test-tree-action-state') {
        setActionState(message.payload);
        if (message.payload.currentAction?.type === 'fetch') {
          setActiveView(view => view === 'error' ? 'loading' : view);
        }
      }
    };

    window.addEventListener('message', messageHandler);
    vscode.postMessage({ type: 'webview-ready' } as WebviewToExtensionMessage);
    
    return () => window.removeEventListener('message', messageHandler);
  }, [vscode]);

  const onFetchTestTree = () => {
    vscode.postMessage({ type: 'test-tree-fetch' } as WebviewToExtensionMessage)
  };

  const onOpenFolder = () => {
    vscode.postMessage({ type: 'test-tree-open-folder' } as WebviewToExtensionMessage)
  };

  const onRunTest = (testRuns: Array<TestRun>) => {
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

  return (
    <div className="flex h-full flex-col">
      <HelperText testTree={testTree} actionState={actionState} />
      <div className="min-h-0 flex-1">
        {activeView === 'loading' && <LoadingView />}
        {activeView === 'error' &&
          <ErrorView onFetchTestTree={onFetchTestTree} />
        }
        {activeView === 'empty-tree' &&
          <EmptyView
            message={testTree && Object.keys(testTree.workspaces).length > 0 ? 'empty-tree' : 'empty-workspaces'}
            onOpenFolder={onOpenFolder}
          />
        }
        {activeView === 'tree' && testTree !== null &&
          <TreeView
            testTree={testTree}
            onRunTest={onRunTest}
            onFetchTestTree={onFetchTestTree}
            onUpdateOpenTestTreeNode={onUpdateOpenTestTreeNode}
            onOpenTestResult={onOpenTestResult}
          />
        }
      </div>
    </div>
  )
};

export default TestTreeView;