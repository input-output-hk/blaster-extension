import { useState, useCallback, forwardRef, useImperativeHandle } from 'react';

import ContextMenu, { type ContextMenuItem } from '../../../../components/ContextMenu';
import { getContextMenuEntries, type TreeViewContextMenuEntry } from './utils';

interface Handle {
  open: (event: React.MouseEvent, item: TestTreeItem) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  item: TestTreeItem;
}

interface Props {
  onRunTest: (testRuns: Array<TestRun>) => void;
  onOpenTestResult: (workspaceId: string, testId: string) => void;
}

const TreeViewContextMenu: React.FC<Props & React.RefAttributes<Handle>> = forwardRef<Handle, Props>(
  ({ onRunTest, onOpenTestResult }, ref) => {
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    useImperativeHandle(ref, () => ({
      open: (event: React.MouseEvent, item: TestTreeItem): void => {
        setContextMenu({ x: event.clientX, y: event.clientY, item });
      }
    }));

    const handleClose = useCallback((): void => {
      setContextMenu(null);
    }, []);

    if (!contextMenu) return null;

    const items: Array<ContextMenuItem<TreeViewContextMenuEntry>> = getContextMenuEntries(contextMenu.item)
      .map(entry => ({ value: entry, disabled: entry.disabled, content: <span>{entry.label}</span> }));

    const handleSelect = (entry: TreeViewContextMenuEntry): void => {
      switch (entry.action) {
        case 'run':
          onRunTest(entry.testRuns);
          break;
        case 'results':
          onOpenTestResult(entry.test.workspaceId, entry.test.id);
          break;
      }
    };

    return (
      <ContextMenu
        position={contextMenu}
        items={items}
        onSelect={handleSelect}
        onClose={handleClose}
      />
    );
  }
);

export type { Handle as TreeViewContextMenuRef };
export default TreeViewContextMenu;
