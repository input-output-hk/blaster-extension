// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyView from './EmptyView';

// The root view tests cover each screen's buttons. This message is unreachable from the root view.
describe('EmptyView', () => {
  test('explains a folder without test suites', () => {
    render(<EmptyView message="empty-tree" onOpenFolder={() => {}} />);
    expect(screen.getByText(/No test suites found in this workspace/)).toBeTruthy();
  });
});
