// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import TreeViewTest from './TreeViewTest';
import { getAction, getRow, makeTest } from '../../../../test/fixtures';

const renderTest = (overrides: Partial<Test> = {}) => {
  const props = { onRunTest: vi.fn(), onOpenTestResult: vi.fn(), onContextMenu: vi.fn() };
  const test = makeTest('a', ['Ledger', 'Types.lean'], 2, overrides);
  const { container } = render(<TreeViewTest test={test} {...props} />);
  return { ...props, test, row: getRow(container, 'a') };
};

describe('TreeViewTest', () => {
  test('runs only this test, by file and 1-based position', () => {
    const { row, onRunTest } = renderTest();
    fireEvent.click(getAction(row, 'Run Test')!);
    expect(onRunTest).toHaveBeenCalledWith([{ workspaceId: 'workspace', tests: [{ uri: 'Ledger/Types.lean', ids: ['3:1'] }] }]);
  });

  test.each([{ isRunning: true }, { isWaiting: true }])('cannot run while %o', state => {
    const { row, onRunTest } = renderTest(state);
    const run = getAction(row, 'Run Test')!;
    expect(run.disabled).toBe(true);
    fireEvent.click(run);
    expect(onRunTest).not.toHaveBeenCalled();
  });

  test('has no result action before a result', () => {
    const { row } = renderTest();
    expect(getAction(row, 'View Results')).toBeNull();
    expect(getAction(row, 'View Details')).toBeNull();
  });

  test.each([
    ['valid', 'View Details', 'codicon-output'],
    ['undetermined', 'View Details', 'codicon-output'],
    ['error', 'View Details', 'codicon-output'],
    ['invalid', 'View Results', 'codicon-graph-line'],
  ] as const)('a %s result opens with %s', (status, tooltip, icon) => {
    const { row, onOpenTestResult } = renderTest({ status });
    const open = getAction(row, tooltip)!;
    expect(open.querySelector('i')!.className).toContain(icon);
    fireEvent.click(open);
    expect(onOpenTestResult).toHaveBeenCalledWith('workspace', 'a');
  });

  test('labels an error instead of showing its time', () => {
    const { row } = renderTest({ status: 'error', time: 20 });
    expect(row.textContent).toContain('Error');
    expect(row.textContent).not.toContain('20ms');
  });

  test('shows the time of a completed run', () => {
    expect(renderTest({ status: 'valid', time: 1500 }).row.textContent).toContain('1.5s');
  });

  test('opens the context menu for this test', () => {
    const { row, test, onContextMenu } = renderTest();
    fireEvent.contextMenu(row);
    expect(onContextMenu).toHaveBeenCalledWith(expect.anything(), { type: 'test', test });
  });
});
