// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import TreeViewWorkspace from './TreeViewWorkspace';
import { allItems, flush, getAction, getRow, makeTree, makeWorkspace } from '../../../../test/fixtures';

const renderWorkspace = (workspace: TestTreeWorkspaceNode) => {
  const props = {
    onRunTest: vi.fn(), onFetchTestTree: vi.fn(), onOpenTestResult: vi.fn(),
    onUpdateOpenTestTreeNode: vi.fn(), onContextMenu: vi.fn(),
  };
  const visible = allItems({ workspaces: { [workspace.id]: workspace } });
  const { container } = render(<TreeViewWorkspace workspace={workspace} visible={visible} {...props} />);
  return { ...props, container };
};

describe('TreeViewWorkspace', () => {
  test.each([
    ['/home/user/project/', 'project'],
    ['C:\\Users\\me\\project', 'project'],
  ])('names %s after its last folder', (path, name) => {
    const { container } = renderWorkspace({ ...makeTree().workspace, path });
    expect(getRow(container, name)).toBeTruthy();
  });

  test('shows its groups and its run time', () => {
    const { container } = renderWorkspace({ ...makeTree().workspace, time: 2500 });
    expect(getRow(container, 'Ledger')).toBeTruthy();
    expect(getRow(container, 'Main.lean')).toBeTruthy();
    expect(getRow(container, 'project').querySelector(':scope > span')!.textContent).toContain('2.5s');
  });

  test('runs the whole workspace', () => {
    const { container, onRunTest } = renderWorkspace(makeTree().workspace);
    fireEvent.click(getAction(getRow(container, 'project'), 'Run Tests')!);
    expect(onRunTest).toHaveBeenCalledWith([{ workspaceId: 'workspace' }]);
  });

  test.each([
    ['running', { isRunning: true }],
    ['waiting', { isWaiting: true }],
    ['empty', { nodes: {} }],
  ])('cannot run while %s', (_, state) => {
    const { container, onRunTest } = renderWorkspace({ ...makeTree().workspace, ...state });
    const run = getAction(getRow(container, 'project'), 'Run Tests')!;
    expect(run.disabled).toBe(true);
    fireEvent.click(run);
    expect(onRunTest).not.toHaveBeenCalled();
  });

  test('reports its own expansion without a path', async () => {
    const { container, onUpdateOpenTestTreeNode } = renderWorkspace(makeWorkspace([]));
    getRow(container, 'project').setAttribute('open', '');
    await flush();
    expect(onUpdateOpenTestTreeNode.mock.calls).toEqual([[true, 'workspace']]);
  });
});
