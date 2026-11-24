// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import TreeViewGroup from './TreeViewGroup';
import { allItems, flush, getAction, getRow, makeFile, makeFolder, makeTest, makeTree } from '../../../../test/fixtures';

const renderGroup = (node: TestTreeGroupNode, visible = allItems({ workspaces: { workspace: makeTree().workspace } })) => {
  const props = {
    onRunTest: vi.fn(), onFetchTestTree: vi.fn(), onOpenTestResult: vi.fn(),
    onUpdateOpenTestTreeNode: vi.fn(), onContextMenu: vi.fn(),
  };
  const { container } = render(
    <TreeViewGroup node={node} workspaceId="workspace" path={[]} visible={visible} {...props} />
  );
  return { ...props, container };
};

const visibleOf = (node: TestTreeGroupNode) => allItems({ workspaces: { workspace: { ...makeTree().workspace, nodes: { [node.name]: node } } } });

describe('TreeViewGroup', () => {
  test('shows nested folders, files and tests', () => {
    const { ledger } = makeTree();
    const { container } = renderGroup(ledger, visibleOf(ledger));
    for (const name of ['Ledger', 'Types.lean', 'a', 'b']) expect(getRow(container, name)).toBeTruthy();
  });

  test('hides children the filter left out', () => {
    const { ledger, b } = makeTree();
    const visible = visibleOf(ledger);
    visible.delete(b);
    const { container } = renderGroup(ledger, visible);
    expect(getRow(container, 'a')).toBeTruthy();
    expect(() => getRow(container, 'b')).toThrow();
  });

  test('a folder runs every file under it, and a file runs only its own tests', () => {
    const { types } = makeTree();
    const other = makeFile('Other.lean', [makeTest('d', ['Ledger', 'Other.lean'], 0)]);
    const ledger = makeFolder('Ledger', [types, other]);
    const { container, onRunTest } = renderGroup(ledger, visibleOf(ledger));

    fireEvent.click(getAction(getRow(container, 'Ledger'), 'Run Tests')!);
    expect(onRunTest).toHaveBeenLastCalledWith([{ workspaceId: 'workspace', tests: [
      { uri: 'Ledger/Types.lean', ids: ['3:1', '10:1'] },
      { uri: 'Ledger/Other.lean', ids: ['1:1'] },
    ] }]);

    fireEvent.click(getAction(getRow(container, 'Types.lean'), 'Run Tests')!);
    expect(onRunTest).toHaveBeenLastCalledWith([{ workspaceId: 'workspace', tests: [{ uri: 'Ledger/Types.lean', ids: ['3:1', '10:1'] }] }]);
    expect(onRunTest).toHaveBeenCalledTimes(2);
  });

  test.each([{ isRunning: true }, { isWaiting: true }])('cannot run while a test is %o, and hides the time', state => {
    const file = makeFile('A.lean', [makeTest('a', ['A.lean'], 0, { time: 15, ...state }), makeTest('b', ['A.lean'], 1, { time: 5 })]);
    const { container, onRunTest } = renderGroup(file, visibleOf(file));
    const row = getRow(container, 'A.lean');
    const run = getAction(row, 'Run Tests')!;
    expect(run.disabled).toBe(true);
    fireEvent.click(run);
    expect(onRunTest).not.toHaveBeenCalled();
    expect(row.querySelector(':scope > span')!.textContent).not.toContain('20ms');
  });

  test('shows the total time once the run finishes', () => {
    const file = makeFile('A.lean', [makeTest('a', ['A.lean'], 0, { time: 15 }), makeTest('b', ['A.lean'], 1, { time: 5 })]);
    const { container } = renderGroup(file, visibleOf(file));
    expect(getRow(container, 'A.lean').querySelector(':scope > span')!.textContent).toContain('20ms');
  });

  test('a file whose discovery failed shows the error, cannot run, and retries discovery', () => {
    const file = makeFile('Broken.lean', [], { error: 'unknown identifier' });
    const { container, onRunTest, onFetchTestTree } = renderGroup(file, visibleOf(file));
    const row = getRow(container, 'Broken.lean');
    const failed = row.querySelector('[data-tooltip-content="unknown identifier"]')!;
    expect(failed.textContent).toBe('Discovery Failed');

    const run = getAction(row, 'Run Tests')!;
    expect(run.disabled).toBe(true);
    fireEvent.click(run);
    expect(onRunTest).not.toHaveBeenCalled();

    fireEvent.click(getAction(row, 'Retry Discovery')!);
    expect(onFetchTestTree).toHaveBeenCalledOnce();
  });

  test('a file with tests and a discovery error still cannot run', () => {
    const file = makeFile('A.lean', [makeTest('a', ['A.lean'], 0)], { error: 'unknown identifier' });
    const { container } = renderGroup(file, visibleOf(file));
    expect(getAction(getRow(container, 'A.lean'), 'Run Tests')!.disabled).toBe(true);
  });

  test('an empty folder cannot run', () => {
    const folder = makeFolder('Empty', []);
    const { container } = renderGroup(folder, visibleOf(folder));
    expect(getAction(getRow(container, 'Empty'), 'Run Tests')!.disabled).toBe(true);
  });

  test('reports expansion of each node with its own path only', async () => {
    const { ledger } = makeTree();
    const { container, onUpdateOpenTestTreeNode } = renderGroup(ledger, visibleOf(ledger));
    getRow(container, 'Types.lean').setAttribute('open', '');
    await flush();
    expect(onUpdateOpenTestTreeNode.mock.calls).toEqual([[true, 'workspace', ['Ledger', 'Types.lean']]]);

    getRow(container, 'Ledger').setAttribute('open', '');
    getRow(container, 'Types.lean').removeAttribute('open');
    await flush();
    // Each item has its own observer, so their reports arrive in any order
    expect(onUpdateOpenTestTreeNode).toHaveBeenCalledTimes(3);
    expect(onUpdateOpenTestTreeNode.mock.calls.slice(1)).toEqual(expect.arrayContaining([
      [true, 'workspace', ['Ledger']],
      [false, 'workspace', ['Ledger', 'Types.lean']],
    ]));
  });

  test('opens the context menu for this group', () => {
    const { ledger } = makeTree();
    const { container, onContextMenu } = renderGroup(ledger, visibleOf(ledger));
    fireEvent.contextMenu(getRow(container, 'Ledger'));
    expect(onContextMenu).toHaveBeenCalledOnce();
    expect(onContextMenu).toHaveBeenCalledWith(expect.anything(), { type: 'group', workspaceId: 'workspace', node: ledger });
  });
});
