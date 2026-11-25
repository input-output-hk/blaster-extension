import { afterEach, vi } from 'vitest';

// The installed @vscode-elements components failed in our jsdom probe, so tests render plain stand-ins
vi.mock('@vscode-elements/react-elements', () => import('./vscodeElements'));

afterEach(async () => {
  // Testing Library needs a DOM, which only the jsdom test files have
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
