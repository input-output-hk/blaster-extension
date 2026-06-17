import { createContext, useContext } from 'react';
import type { WebviewApi } from 'vscode-webview';

const NotifyContext = createContext<(text: string) => void>(() => {});

export const NotifyProvider: React.FC<{ vscode: WebviewApi<unknown>; children: React.ReactNode }> = ({ vscode, children }) => {
  const notify = (text: string) => {
    vscode.postMessage({ type: 'notify', payload: { text } } as WebviewToExtensionMessage);
  };
  return <NotifyContext.Provider value={notify}>{children}</NotifyContext.Provider>;
};

export const useNotify = () => useContext(NotifyContext);
