import type { WebviewApi } from 'vscode-webview'

interface Props {
  vscode: WebviewApi<unknown>;
}

const SolverConfig: React.FC<Props> = () => {
  return (
    <>
      <h1>Placeholder</h1>
    </>
  )
}

export default SolverConfig
