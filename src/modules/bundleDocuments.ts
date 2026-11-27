import * as vscode from 'vscode';

import { getGeneratorLabel } from '../services/generators';
import { findRecord, getCheckingContextPath } from '../services/generators/bundle';

import type { BlasterContext } from '../extension';
import type { BundleRecord } from '../services/generators/bundle';

const BUNDLE_SCHEME = 'blaster-bundle';
const NOT_GENERATED = 'Not generated yet. Refresh, or see the Blaster output.';

type BundleFileQuery = { workspaceId: string; generator: string; path: string };

/**
 * Returns the path of a bundle record (used as the QuickPick label).
 */
function getRecordPath(record: BundleRecord): string {
  return record.path;
}

/**
 * Shows the files a Haskell generator produced (its in-memory NDJSON bundle) as read-only documents.
 * Nothing is written to disk.
 */
export default class BundleDocuments implements vscode.TextDocumentContentProvider {
  private context: BlasterContext = {} as BlasterContext;
  private changeEmitter = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this.changeEmitter.event;

  /**
   * Registers the `blaster-bundle` documents and refreshes the open ones whenever a generator's state changes.
   */
  public activate(context: BlasterContext): void {
    this.context = context;
    context.extension.subscriptions.push(
      this.changeEmitter,
      vscode.workspace.registerTextDocumentContentProvider(BUNDLE_SCHEME, this),
      context.testStore.onGeneratorStateUpdate(this.refreshOpenDocuments.bind(this))
    );
  }

  /**
   * Opens a property's checking context, or lets the user pick one of the generator's files.
   */
  public async open({ workspaceId, generator, propertyId }: OpenBundleFilePayload): Promise<void> {
    const bundle = this.context.testStore.getBundle(workspaceId, generator);
    if (bundle === undefined) {
      void vscode.window.showInformationMessage(`${getGeneratorLabel(generator)}: ${NOT_GENERATED}`);
      return;
    }
    let path: string | undefined;
    if (propertyId !== undefined) {
      path = getCheckingContextPath(bundle.records, propertyId);
    } else {
      path = await vscode.window.showQuickPick(bundle.records.map(getRecordPath), {
        placeHolder: `Generated files of ${getGeneratorLabel(generator)}`
      });
    }
    if (path === undefined) return;
    const uri = vscode.Uri.from({
      scheme: BUNDLE_SCHEME,
      path: `/${getGeneratorLabel(generator)}/${path}`,
      query: JSON.stringify({ workspaceId, generator, path } satisfies BundleFileQuery),
    });
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri), { preview: true });
  }

  /**
   * Returns a bundle file's exact text (base16 files as their hex text), from the last generated bundle.
   */
  public provideTextDocumentContent(uri: vscode.Uri): string {
    const { workspaceId, generator, path } = JSON.parse(uri.query) as BundleFileQuery;
    const bundle = this.context.testStore.getBundle(workspaceId, generator);
    const record = bundle === undefined ? undefined : findRecord(bundle.records, path);
    return record?.content ?? NOT_GENERATED;
  }

  /**
   * Reloads every open bundle document, so it shows the latest generated bundle.
   */
  private refreshOpenDocuments(): void {
    for (const document of vscode.workspace.textDocuments) {
      if (document.uri.scheme === BUNDLE_SCHEME) this.changeEmitter.fire(document.uri);
    }
  }
}
