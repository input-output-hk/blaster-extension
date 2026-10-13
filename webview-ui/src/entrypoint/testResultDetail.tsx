import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import TestResultDetail from '../webview/components/TestResultDetail'
import '../style.css'

const vscode = acquireVsCodeApi()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TestResultDetail vscode={vscode} />
  </StrictMode>,
)
