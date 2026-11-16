interface Props {
  isOpen: boolean;
  activeTags: Array<string>;
  onToggleTag: (tagName: string) => void;
}

const ITEM_CLASS =
  'flex items-center gap-1 w-full px-3 py-1 border-0 bg-transparent text-left text-inherit cursor-pointer ' +
  'hover:bg-[var(--vscode-menu-selectionBackground)] hover:text-[var(--vscode-menu-selectionForeground)]';

/** Returns the check icon classes, visible only when the tag is in the filter text. */
const getCheckClass = (activeTags: Array<string>, tagName: string): string =>
  `codicon codicon-check ${activeTags.includes(tagName) ? 'opacity-100' : 'opacity-0'}`;

const FilterMenu: React.FC<Props> = ({ isOpen, activeTags, onToggleTag }) => {
  if (!isOpen) return null;

  /** Toggles the `@falsified` tag. */
  const handleToggleFalsified = () => onToggleTag('falsified');

  /** Toggles the `@undetermined` tag. */
  const handleToggleUndetermined = () => onToggleTag('undetermined');

  /** Toggles the `@error` tag. */
  const handleToggleError = () => onToggleTag('error');

  return (
    <div className="absolute right-0 top-full mt-1 z-10 min-w-56 w-max py-2 border border-[var(--vscode-menu-border)] bg-[var(--vscode-menu-background)] text-[var(--vscode-menu-foreground)] shadow-[0_2px_8px_var(--vscode-widget-shadow)]">
      <button type="button" className={ITEM_CLASS} onClick={handleToggleFalsified}>
        <i className={getCheckClass(activeTags, 'falsified')} />
        <span>Falsified</span>
      </button>
      <button type="button" className={ITEM_CLASS} onClick={handleToggleUndetermined}>
        <i className={getCheckClass(activeTags, 'undetermined')} />
        <span>Undetermined</span>
      </button>
      <button type="button" className={ITEM_CLASS} onClick={handleToggleError}>
        <i className={getCheckClass(activeTags, 'error')} />
        <span>Errors</span>
      </button>
    </div>
  );
};

export default FilterMenu;
