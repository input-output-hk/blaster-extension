import { describe, expect, test } from 'vitest';
import { formatRunTime } from './format';

describe('formatRunTime', () => {
  test('shows whole milliseconds below one second', () => {
    expect(formatRunTime(0)).toBe('0ms');
    expect(formatRunTime(999.9)).toBe('999ms');
  });

  test('shows seconds with one decimal from one second', () => {
    expect(formatRunTime(1000)).toBe('1.0s');
    expect(formatRunTime(59_940)).toBe('59.9s');
  });

  test('shows minutes with two decimals from one minute', () => {
    expect(formatRunTime(60_000)).toBe('1.00m');
    expect(formatRunTime(90_000)).toBe('1.50m');
  });
});
