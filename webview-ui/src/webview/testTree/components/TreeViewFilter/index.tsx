import { useLayoutEffect, useRef, useState } from 'react';

import TagDropdown from './TagDropdown';
import { getTagQuery, getTagSuggestions, insertTag, type FilterTag } from '../../utils/filterTags';

interface Props {
  filter: TestTreeFilter;
  placeholder?: string;
  onChangeFilter: (filter: TestTreeFilter) => void;
  onClear?: () => void;
}

const TreeViewFilter: React.FC<Props> = ({ filter, placeholder = 'Filter (e.g. text, !exclude, @tag)', onChangeFilter, onClear }) => {
  const [cursor, setCursor] = useState<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [isTagListDismissed, setIsTagListDismissed] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingCursorRef = useRef<number | null>(null);

  /** After a tag is inserted, puts the cursor right after it once the new text is rendered. */
  const restoreCursor = () => {
    const input = inputRef.current;
    if (input === null || pendingCursorRef.current === null) return;
    input.setSelectionRange(pendingCursorRef.current, pendingCursorRef.current);
    pendingCursorRef.current = null;
  };

  useLayoutEffect(restoreCursor, [filter.text]);

  const text = filter.text ?? '';
  const tagQuery = cursor === null ? null : getTagQuery(text, cursor);
  const tagSuggestions = tagQuery === null ? [] : getTagSuggestions(tagQuery);
  const isTagListOpen = tagSuggestions.length > 0 && !isTagListDismissed;
  const activeIndex = highlightedIndex < tagSuggestions.length ? highlightedIndex : 0;

  /** Stores the typed text as is and reopens the tag list for the word at the cursor. */
  const handleFilterTextInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChangeFilter({ ...filter, text: event.target.value });
    setCursor(event.target.selectionStart);
    setHighlightedIndex(0);
    setIsTagListDismissed(false);
  };

  /** Tracks the cursor, so clicks and arrow keys open or close the tag list for the word at the cursor. */
  const handleSelect = (event: React.SyntheticEvent<HTMLInputElement>) => {
    setCursor(event.currentTarget.selectionStart);
  };

  /** Closes the tag list when the input loses focus. */
  const handleBlur = () => {
    setCursor(null);
  };

  /** Replaces the word at the cursor with the picked tag and moves the cursor after it. */
  const handlePickTag = (tag: FilterTag) => {
    const result = insertTag(text, cursor ?? text.length, tag.name);
    pendingCursorRef.current = result.cursor;
    setCursor(result.cursor);
    onChangeFilter({ ...filter, text: result.text });
  };

  /** Moves the tag list highlight to the given row. */
  const handleHighlightTag = (index: number) => {
    setHighlightedIndex(index);
  };

  /** Navigates the tag list while it's open: ↑/↓ move, Enter/Tab pick, Esc closes. Other keys type normally. */
  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isTagListOpen) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((activeIndex + 1) % tagSuggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((activeIndex - 1 + tagSuggestions.length) % tagSuggestions.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      handlePickTag(tagSuggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setIsTagListDismissed(true);
    }
  };

  return (
    <div className="relative flex items-center w-full px-2 py-2">
      <input
        ref={inputRef}
        type="text"
        className={`w-full pl-2 ${onClear !== undefined ? 'pr-6' : 'pr-2'} py-1 text-sm rounded-[var(--vscode-cornerRadius-small)] border border-[var(--vscode-commandCenter-border)] bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] outline-none focus:border-[var(--vscode-focusBorder)]`}
        placeholder={placeholder}
        value={text}
        onChange={handleFilterTextInput}
        onSelect={handleSelect}
        onBlur={handleBlur}
        onKeyDown={handleInputKeyDown}
      />
      {isTagListOpen && (
        <TagDropdown
          tags={tagSuggestions}
          highlightedIndex={activeIndex}
          onPick={handlePickTag}
          onHighlight={handleHighlightTag}
        />
      )}
      {onClear !== undefined && (
        <span className="absolute right-3 inline-flex items-center gap-1">
          <i
            className="codicon codicon-clear-all cursor-pointer opacity-70 hover:opacity-100"
            onClick={onClear}
            data-tooltip-id="tree-node-action"
            data-tooltip-content="Clear"
          />
        </span>
      )}
    </div>
  );
};

export default TreeViewFilter;
