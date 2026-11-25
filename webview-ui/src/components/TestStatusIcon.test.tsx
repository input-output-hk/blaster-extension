// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/react';
import TestStatusIcon from './TestStatusIcon';

const iconClass = (status: RunStatus, isWaiting = false, isRunning = false): string =>
  render(<TestStatusIcon status={status} isWaiting={isWaiting} isRunning={isRunning} />).container.querySelector('i')!.className;

describe('TestStatusIcon', () => {
  test.each([
    ['empty', 'codicon-circle'],
    ['undetermined', 'codicon-question'],
    ['valid', 'codicon-pass'],
    ['invalid', 'codicon-error'],
    ['error', 'codicon-info'],
  ] as const)('shows %s as %s', (status, icon) => {
    expect(iconClass(status)).toContain(icon);
  });

  test('running wins over waiting and the status', () => {
    expect(iconClass('valid', true, true)).toContain('codicon-loading');
  });

  test('waiting wins over the status', () => {
    expect(iconClass('invalid', true)).toContain('codicon-history');
  });
});
