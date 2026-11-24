// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/react';
import useTreeItemState from './useTreeItemState';
import { VscodeTreeItem } from '../test/vscodeElements';
import { flush } from '../test/fixtures';

type Callbacks = Parameters<typeof useTreeItemState>[0];

const Item: React.FC<Callbacks & { open?: boolean }> = ({ open, ...callbacks }) => {
  const ref = useTreeItemState(callbacks);
  return <VscodeTreeItem data-testid="item" ref={ref as unknown as React.Ref<HTMLElement>} open={open} />;
};


describe('useTreeItemState', () => {
  test('reports each change of the open and selected attributes once', async () => {
    const onToggleCollapsed = vi.fn();
    const onToggleSelection = vi.fn();
    const { getByTestId } = render(<Item onToggleCollapsed={onToggleCollapsed} onToggleSelection={onToggleSelection} />);
    const item = getByTestId('item');

    item.setAttribute('open', '');
    item.setAttribute('open', '');
    item.setAttribute('selected', '');
    await flush();
    expect(onToggleCollapsed.mock.calls).toEqual([[false]]);
    expect(onToggleSelection.mock.calls).toEqual([[true]]);

    item.removeAttribute('open');
    item.removeAttribute('selected');
    item.setAttribute('title', 'unrelated');
    await flush();
    expect(onToggleCollapsed.mock.calls).toEqual([[false], [true]]);
    expect(onToggleSelection.mock.calls).toEqual([[true], [false]]);
  });

  test('starts from the rendered state, so an item rendered open reports closing', async () => {
    const onToggleCollapsed = vi.fn();
    const { getByTestId } = render(<Item open onToggleCollapsed={onToggleCollapsed} />);
    getByTestId('item').removeAttribute('open');
    await flush();
    expect(onToggleCollapsed.mock.calls).toEqual([[true]]);
  });

  test('calls the latest callback after a rerender', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { getByTestId, rerender } = render(<Item onToggleCollapsed={first} />);
    rerender(<Item onToggleCollapsed={second} />);
    getByTestId('item').setAttribute('open', '');
    await flush();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(false);
  });

  test('stops observing after unmount', async () => {
    const onToggleCollapsed = vi.fn();
    const { getByTestId, unmount } = render(<Item onToggleCollapsed={onToggleCollapsed} />);
    const item = getByTestId('item');
    unmount();
    item.setAttribute('open', '');
    await flush();
    expect(onToggleCollapsed).not.toHaveBeenCalled();
  });
});
