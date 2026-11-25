// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TreeView from '.';
import { getRow, makeFile, makeTest, makeTree, makeWorkspace } from '../../../../test/fixtures';

const renderTree = (testTree: TestTree) => {
  const props = { onRunTest: vi.fn(), onFetchTestTree: vi.fn(), onOpenTestResult: vi.fn(), onUpdateOpenTestTreeNode: vi.fn() };
  const { container } = render(<TreeView testTree={testTree} editorFiles={{ openFiles: [] }} {...props} />);
  return { ...props, container };
};

describe('TreeView', () => {
  test('shows every workspace', () => {
    const { tree } = makeTree();
    const other = makeWorkspace([makeFile('Other.lean', [makeTest('d', ['Other.lean'], 0, { workspaceId: 'other' })])], { id: 'other', path: '/home/user/other' });
    const { container } = renderTree({ workspaces: { ...tree.workspaces, other } });
    expect(getRow(container, 'project')).toBeTruthy();
    expect(getRow(container, 'other')).toBeTruthy();
  });

  test('the filter keeps matching tests with their parents', () => {
    const { container } = renderTree(makeTree().tree);
    fireEvent.change(screen.getByPlaceholderText(/^Filter/), { target: { value: 'b' } });
    for (const name of ['project', 'Ledger', 'Types.lean', 'b']) expect(getRow(container, name)).toBeTruthy();
    for (const name of ['a', 'Main.lean', 'c']) expect(() => getRow(container, name)).toThrow();
  });

  test('right-clicking a test opens its menu, which runs it', () => {
    const { container, onRunTest } = renderTree(makeTree().tree);
    fireEvent.contextMenu(getRow(container, 'c'));
    expect(screen.getByRole('menuitem', { name: 'View Results' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Run Proof' }));
    expect(onRunTest).toHaveBeenCalledWith([{ workspaceId: 'workspace', tests: [{ uri: 'Main.lean', ids: ['5:1'] }] }]);
  });
});
