import * as vscode from 'vscode';

import { detectLanguages } from '../services/generators/project';

import type { BlasterContext } from '../extension';

const WATCH_GLOB = '{**/*.hs,**/*.cabal,cabal.project,scripts/blueprints/list-generators.js}';
const REFRESH_DELAY_MS = 2000;
const IGNORED_SEGMENTS = ['/dist-newstyle/', '/.git/', '/node_modules/'];

/**
 * Tells whether a changed file is build output or tooling (cabal writes generated .hs files into
 * dist-newstyle while generating, which must not trigger another refresh).
 */
export function isIgnoredPath(path: string): boolean {
  const normalized = path.replaceAll('\\', '/');
  for (const segment of IGNORED_SEGMENTS) {
    if (normalized.includes(segment)) return true;
  }
  return false;
}

/**
 * Refreshes the property tree a short while after Haskell sources, Cabal files or the generator script
 * change on disk in a Haskell workspace root, so renamed generators and properties show up by themselves.
 */
export default class HaskellWatcher {
  private context: BlasterContext = {} as BlasterContext;
  private timer?: NodeJS.Timeout;
  private changedPaths: Set<string> = new Set();

  /**
   * Watches every Haskell workspace root that is open now.
   */
  public activate(context: BlasterContext): void {
    this.context = context;
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      if (!detectLanguages(folder.uri.fsPath).haskell) continue;
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, WATCH_GLOB));
      watcher.onDidChange(this.handleFileChange, this);
      watcher.onDidCreate(this.handleFileChange, this);
      watcher.onDidDelete(this.handleFileChange, this);
      context.extension.subscriptions.push(watcher);
    }
    context.extension.subscriptions.push({ dispose: this.cancelRefresh.bind(this) });
  }

  /**
   * Schedules a refresh, restarting the delay on every change so a burst of saves refreshes once.
   */
  private handleFileChange(uri: vscode.Uri): void {
    if (isIgnoredPath(uri.fsPath)) return;
    this.changedPaths.add(uri.fsPath);
    clearTimeout(this.timer);
    this.timer = setTimeout(this.refresh.bind(this), REFRESH_DELAY_MS);
  }

  /**
   * Refreshes the property tree for the collected changes (only the affected generators regenerate).
   */
  private refresh(): void {
    const paths = Array.from(this.changedPaths);
    this.timer = undefined;
    this.changedPaths.clear();
    this.context.testTreeView.refreshChangedFiles(paths);
  }

  /**
   * Cancels a scheduled refresh.
   */
  private cancelRefresh(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
