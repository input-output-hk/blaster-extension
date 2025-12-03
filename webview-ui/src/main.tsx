import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '../index.d.ts';
import App from './App'

export default function Main() {
  const vscode = acquireVsCodeApi();

  return (
    <StrictMode>
      <App vscode={vscode} />
    </StrictMode>
  )
}

createRoot(document.getElementById('root')!).render(
  <Main />
)
