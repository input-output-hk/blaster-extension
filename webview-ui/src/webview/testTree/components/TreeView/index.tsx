import { useCallback, useMemo, useRef, useState } from 'react';
import { VscodeTree } from '@vscode-elements/react-elements';

import Tooltip from '../../../../components/Tooltip';
import TreeViewFilter from '../TreeViewFilter';
import TreeViewWorkspace from './TreeViewWorkspace';
import TreeViewContextMenu, { type TreeViewContextMenuRef } from '../TreeViewContextMenu';
import { getVisibleItems } from '../../utils/treeUtils';

import type { FilterContext } from '../../utils/filterTags';

interface TreeViewProps {
  testTree: TestTree;
  editorFiles: EditorFilesPayload;
  onRunTest: (testRuns: Array<TestRun>) => void;
  onFetchTestTree: () => void;
  onOpenTestResult: (workspaceId: string, testId: string) => void;
  onOpenTestLocation: (location: TestLocation) => void;
  onOpenBundleFile: (payload: OpenBundleFilePayload) => void;
  onUpdateOpenTestTreeNode: (isOpen: boolean, workspaceId: string, group?: Array<string>) => void;
}

const TreeView: React.FC<TreeViewProps> = ({
  testTree,
  editorFiles,
  onRunTest,
  onFetchTestTree,
  onUpdateOpenTestTreeNode,
  onOpenTestResult,
  onOpenTestLocation,
  onOpenBundleFile
}) => {
  const contextMenuRef = useRef<TreeViewContextMenuRef>(null);
  const [filter, setFilter] = useState<TestTreeFilter>({});

  const filterContext = useMemo<FilterContext>(
    () => ({ activeFile: editorFiles.activeFile, openFiles: new Set(editorFiles.openFiles) }),
    [editorFiles],
  );

  const visible = useMemo(
    () => getVisibleItems(testTree, filter, filterContext),
    [testTree, filter, filterContext],
  );

  /** Returns whether the filter left this item visible. */
  const isVisible = useCallback(
    (item: VisibleItem): boolean => visible.has(item),
    [visible],
  );

  /** Empties the filter text. */
  const handleClearSearch = () => {
    setFilter({ ...filter, text: undefined });
  };

  const handleContextMenu = (event: React.MouseEvent, item: TestTreeItem): void => {
    contextMenuRef.current?.open(event, item);
  };

  return (
    <div className="h-full flex flex-col">
      <TreeViewFilter
        filter={filter}
        onChangeFilter={setFilter}
        onClear={handleClearSearch}
      />
      <div className="flex-1 overflow-y-auto">
        <VscodeTree>
          {Object.values(testTree.workspaces).filter(isVisible).map(workspace => (
            <TreeViewWorkspace
              key={workspace.id}
              workspace={workspace}
              visible={visible}
              onRunTest={onRunTest}
              onFetchTestTree={onFetchTestTree}
              onOpenTestResult={onOpenTestResult}
              onOpenTestLocation={onOpenTestLocation}
              onUpdateOpenTestTreeNode={onUpdateOpenTestTreeNode}
              onContextMenu={handleContextMenu}
            />
          ))}
        </VscodeTree>
      </div>
      <TreeViewContextMenu
        ref={contextMenuRef}
        onRunTest={onRunTest}
        onOpenTestResult={onOpenTestResult}
        onOpenBundleFile={onOpenBundleFile}
      />
      <Tooltip id="tree-node-action" place="bottom" />
      <Tooltip id="tree-node-name" place="bottom" maxWidth="400px" />
    </div>
  );
};

export default TreeView;
