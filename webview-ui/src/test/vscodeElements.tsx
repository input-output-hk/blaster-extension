import { forwardRef, type ElementType, type HTMLAttributes, type MouseEventHandler, type ReactNode } from 'react';

// Stand-ins keep the refs, attributes, events and disabled state the tests use. They do not test the real widgets.
interface HostProps extends HTMLAttributes<HTMLElement> {
  open?: boolean;
  children?: ReactNode;
}

const host = (tag: string) => forwardRef<HTMLElement, HostProps>(({ open, children, ...props }, ref) => {
  const Tag = tag as ElementType;
  // data-open mirrors the prop, since the open attribute also changes when the user toggles the item
  return <Tag ref={ref} open={open || undefined} data-open={open || undefined} {...props}>{children}</Tag>;
});

export const VscodeTree = host('vscode-tree');
export const VscodeTreeItem = host('vscode-tree-item');
export const VscodeProgressBar = host('vscode-progress-bar');

interface ButtonProps {
  className?: string;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children?: ReactNode;
}

export const VscodeButton = ({ className, disabled, onClick, children }: ButtonProps) =>
  <button type="button" className={className} disabled={disabled} onClick={onClick}>{children}</button>;
