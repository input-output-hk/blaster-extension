import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PropertyPanel from '../webview/propertyPanel'
import '../style.css'

const vscode = acquireVsCodeApi()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PropertyPanel vscode={vscode} />
  </StrictMode>,
)
