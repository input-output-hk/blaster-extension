// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import TestTreeView from '.';
import { flush, getAction, getRow, makeTree, makeWebviewApi, makeWorkspace } from '../../test/fixtures';

const renderView = () => {
  const { api, postMessage } = makeWebviewApi();
  const view = render(<TestTreeView vscode={api} />);
  return { ...view, postMessage };
};

const send = (message: ExtensionToWebviewMessage) => act(() => {
  window.dispatchEvent(new MessageEvent('message', { data: message }));
});

const sendTree = (testTree: TestTree) => send({ type: 'test-tree', payload: { testTree } });

const isLoading = (container: HTMLElement) => container.querySelector('vscode-progress-bar') !== null;

describe('TestTreeView', () => {
  test('reports ready and shows loading until the tree arrives', () => {
    const { container, postMessage } = renderView();
    expect(postMessage.mock.calls).toEqual([[{ type: 'webview-ready' }]]);
    expect(isLoading(container)).toBe(true);
  });

  test('without workspaces, explains it and opens a folder', () => {
    const { postMessage } = renderView();
    sendTree({ workspaces: {} });
    expect(screen.getByText(/No folders detected/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Folder' }));
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'test-tree-open-folder' });
  });

  test('a workspace without tests chooses the tree screen, not the empty screen', () => {
    renderView();
    sendTree({ workspaces: { workspace: makeWorkspace([]) } });
    expect(screen.getByPlaceholderText(/^Filter/)).toBeTruthy();
    expect(screen.queryByText(/No test suites found/)).toBeNull();
    expect(screen.queryByText(/No folders detected/)).toBeNull();
  });

  test('the tree sends run and result actions with their identifiers', () => {
    const { container, postMessage } = renderView();
    const { tree, c } = makeTree();
    c.status = 'invalid';
    sendTree(tree);

    fireEvent.click(getAction(getRow(container, 'c'), 'Run Test')!);
    expect(postMessage).toHaveBeenLastCalledWith({
      type: 'test-tree-run', payload: { testRuns: [{ workspaceId: 'workspace', tests: [{ uri: 'Main.lean', ids: ['5:1'] }] }] },
    });
    fireEvent.click(getAction(getRow(container, 'c'), 'View Results')!);
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'test-tree-open-result', payload: { workspaceId: 'workspace', testId: 'c' } });
  });

  test('applies test and workspace updates', () => {
    const { container } = renderView();
    const { tree, a } = makeTree();
    sendTree(tree);
    send({ type: 'test-tree-update', payload: { type: 'test', test: { ...a, status: 'valid', time: 1500 } } });
    expect(getRow(container, 'a').textContent).toContain('1.5s');
    expect(getRow(container, 'a').querySelector('i')!.className).toContain('codicon-pass');

    send({ type: 'test-tree-update', payload: { type: 'workspace', workspace: { id: 'workspace', time: 2500 } } });
    expect(getRow(container, 'project').querySelector(':scope > span')!.textContent).toContain('2.5s');
  });

  test('passes the editor files to the filter', () => {
    const { container } = renderView();
    sendTree(makeTree().tree);
    send({ type: 'editor-files', payload: { activeFile: '/project/Main.lean', openFiles: [] } });
    fireEvent.change(screen.getByPlaceholderText(/^Filter/), { target: { value: '@doc' } });
    expect(getRow(container, 'c')).toBeTruthy();
    expect(() => getRow(container, 'a')).toThrow();
  });

  test('reports expansion and keeps it in the shown tree', async () => {
    const { container, postMessage } = renderView();
    sendTree(makeTree().tree);
    await act(async () => {
      getRow(container, 'Ledger').setAttribute('open', '');
      await flush();
    });
    expect(postMessage).toHaveBeenLastCalledWith({
      type: 'test-tree-update-open-state', payload: { isOpen: true, workspaceId: 'workspace', group: ['Ledger'] },
    });

    // The stored tree now renders the folder open, and only that folder
    send({ type: 'test-tree-update', payload: { type: 'workspace', workspace: { id: 'workspace', time: 1 } } });
    expect(getRow(container, 'Ledger').hasAttribute('data-open')).toBe(true);
    expect(getRow(container, 'Main.lean').hasAttribute('data-open')).toBe(false);
  });

  test('the error screen retries discovery, which shows loading', () => {
    const { container, postMessage } = renderView();
    send({ type: 'test-tree-error' });
    expect(screen.getByText('Property Detection Failure')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'test-tree-fetch' });

    send({ type: 'test-tree-action-state', payload: { isBusy: true, currentAction: { type: 'fetch', startedAt: 1, isCancelling: false } } });
    expect(isLoading(container)).toBe(true);
  });

  test('the missing dependency screen opens the install guide or retries', () => {
    const { postMessage } = renderView();
    send({ type: 'test-tree-dependency-error' });
    expect(screen.getByText('Blaster Not Detected')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Install Blaster' }));
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'test-tree-open-install-guide' });
    fireEvent.click(screen.getByRole('button', { name: 'Retry dependency detection' }));
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'test-tree-fetch' });
  });

  test('a refresh keeps the shown tree instead of loading', () => {
    const { container } = renderView();
    sendTree(makeTree().tree);
    send({ type: 'test-tree-action-state', payload: { isBusy: true, currentAction: { type: 'fetch', startedAt: 1, isCancelling: false } } });
    expect(isLoading(container)).toBe(false);
    expect(getRow(container, 'project')).toBeTruthy();
  });

  test('stops listening after unmount', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderView();
    const listener = add.mock.calls.find(([type]) => type === 'message')![1];
    unmount();
    expect(remove).toHaveBeenCalledWith('message', listener);
    add.mockRestore();
    remove.mockRestore();
  });
});
