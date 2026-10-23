interface Props {
  onOpenExplorer: () => void;
}

const Toolbar: React.FC<Props> = ({ onOpenExplorer }) => (
  <div className="flex-none p-2 flex flex-row justify-between items-start gap-2 bg-[var(--vscode-sideBar-background)]">
    <div className="flex-none flex flex-row items-center gap-2">
      <button
        type="button" onClick={onOpenExplorer}
        className="ml-1 pt-1 px-1 rounded-[var(--vscode-cornerRadius-small,2px)] hover:bg-[var(--vscode-toolbar-hoverBackground)] cursor-pointer"
        data-tooltip-id="graph-toolbar-action"
        data-tooltip-content="Graph Explorer"
      >
        <i className="codicon codicon-map text-[var(--vscode-icon-foreground)]" />
      </button>
    </div>
  </div>
);

export default Toolbar;
