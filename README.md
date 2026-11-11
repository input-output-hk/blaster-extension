# Blaster VS Code Extension

Discover Lean properties in workspace folders, run verification, and inspect
statuses, timings, counterexample steps, and transaction graphs in VS Code.

## Prerequisites

- VS Code matching the version in `package.json`.
- Node.js 22 or newer and npm for development.
- Elan/Lake available on the PATH inherited by VS Code, plus each Lean project's
    pinned toolchain, dependencies, and required solver.
- The `lean-blaster` CLI on the same PATH (see the Lean-blaster repository).

Discovery runs `lean-blaster discover <workspace> --json` for each workspace folder.
Runs use `lean-blaster check <file.lean> --solver-timeout 1s --json`; Lean checks
whole files, so running one test runs every test in its file.

Run selections use workspace-relative file paths (forward slashes) and one-based
`line:column` IDs, for example:

```json
{
  "workspaceId": "workspace-id",
  "tests": [{ "uri": "Tests/Recursor.lean", "ids": ["17:40"] }]
}
```

Omitting `tests` selects the whole workspace. Omitting `ids` selects the whole
file. Explicit empty arrays (`tests: []` or `ids: []`) select nothing. Selected
positions are validated before the run is expanded to all discovered tests in
each selected file; unrelated files and workspaces are not changed.

## Local Development

```sh
npm install
npm test
npm run compile
```

Compilation builds the extension host into `out/` and React webviews into `build/`.
Open this extension project in VS Code and launch its Extension Development Host
with F5. In that window, open a prepared Lean project and select the Blaster view.

`npm test` checks the UI request shape, file/position selection, whole-file
execution, and scoped failure handling without requiring Lean.

Use **Blaster: Refresh Test Tree** to discover properties. Run individual tests,
files, folders, workspaces, or **Blaster: Run All Tests**. Opening a test result
shows its latest state; **Blaster: Clear All Results** clears completed runs.
Expansion state is retained during discovery in the current extension session.

The CLI prepares missing or stale project imports with Lake. The project's Lean
toolchain and Blaster dependency must be compatible with the installed CLI.

## Result Limitations

Status and elapsed time come from `lean-blaster`. A result matching the source's
expected status (e.g. `(solve-result: 1)`) counts as valid; errors, skipped checks,
and discovered sites that produce no result count as invalid.
Unrun tests have the `empty` status (grey circle). Undetermined results use a
purple (`#B180D7`) question icon and expose the details view. Multiple results
from one invocation are combined using the worst status and summed elapsed time.
The fixed 1s timeout applies per solver query, not to the total file runtime.
For falsified results, `steps` and `graph` contain sample data, not extracted
counterexample evidence. Rerunning a test clears its previous result first.

The counterexample table displays transaction hashes and data fields, with discarded
steps hidden by default. The graph uses transaction and UTxO nodes and plain values.
Real counterexample extraction is deferred.

## Output

CLI commands, Lean/Lake stderr, and diagnostics are written to the **Blaster**
output channel. Shared TypeScript types live in `shared/types.d.ts`.

## Project Layout

- `src/`: activation, `lean-blaster` process handling, data store, and webview controllers.
- `shared/`: public test/tree/result/message types.
- `webview-ui/`: React tree and result views.

See `CONTRIBUTING.md` for contribution guidelines.