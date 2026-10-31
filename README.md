# Blaster VS Code Extension

Discover Lean Blaster invocations, run verification with the installed
`lean-blaster` CLI, and inspect statuses and timings in VS Code.

## Prerequisites

- VS Code matching the version in `package.json`.
- Node.js 22 or newer and npm for development.
- `lean-blaster` installed on the PATH inherited by the VS Code extension host.
- A compatible Lean toolchain and Blaster build in each Lake project. The CLI
    installation supplies its own Blaster libraries and solver; Lake must be
    available for dependency preparation when needed.
- A trusted, local workspace containing `lakefile.lean` or `lakefile.toml` at
    each Lean project root.

The extension does not install the CLI or bundle an executable. If the command
cannot be found, check VS Code's PATH, restart VS Code after changing it, and
retry discovery. `lean-blaster doctor --json` can diagnose the CLI environment.
If the CLI reports a different Blaster build in the project, align the CLI and
project dependency revisions and rebuild the project's dependencies.

## Local Development

```sh
npm install
npm run compile
```

Compilation builds the extension host into `out/` and React webviews into `build/`.
Open this extension project in VS Code and launch its Extension Development Host
with F5. In that window, open a prepared Lean project and select the Blaster view.

Automated tests are deferred. Use `npm run compile:extension` and
`npm run compile:webview` for focused build checks.

## Discovery and Execution

Opening the Blaster view discovers each workspace root with a Lake configuration:

```sh
lean-blaster discover <project-root> --json
```

Other workspace roots are skipped. One tree row represents one source invocation,
which may check multiple properties. Reopening the view uses the cached tree;
**Blaster: Refresh Test Tree** explicitly rediscovers saved sources. There are no
file watchers or automatic refreshes after edits. Expansion state is retained
within the session. **Blaster: Collapse All Tests** collapses the current tree,
and **Go to Source** opens an invocation's location.

Selecting a row runs its entire containing file, including every sibling invocation:

```sh
lean-blaster check <file> --solver-timeout 1s --json
```

File, folder, workspace, and **Run All Tests** selections are deduplicated and
executed one file at a time across the extension. The fixed timeout applies to
each solver query, not to dependency preparation, elaboration, or total run time.
Discovery and checks always use disk contents, without inspecting or saving editor buffers.

**Stop Tests** replaces **Run All Tests** in the same toolbar position during a
run. It cancels queued files and terminates the active process tree. Completed
evidence is retained; unchecked work becomes undetermined. The toolbar returns
to Run All only after cleanup. Refresh and clear are blocked while busy.
File-specific failures do not stop the remaining queue; global CLI failures do.

Use **Blaster: Clear All Results** to clear completed results. CLI details and
diagnostics are available in the **Blaster** output channel; infrastructure error
messages offer **Show Output**. A failed discovery can be retried. Partial
discovery results remain visible with a warning.

## Result Limitations

Verification outcomes and reported elapsed time come from the CLI. The tree maps
`valid` to valid, `falsified`/`error` to invalid, and `undetermined`/`skipped` to
undetermined. A row combines all results from its invocation. A source annotation
expecting falsification does not turn a falsified result into a passing one.
Source discovery is syntactic: sites that do not execute are not marked valid.

**Sample Steps** and **Sample Graph** show one hardcoded extension-owned sample,
not extracted counterexample evidence. They appear for every failed (`invalid`)
row, including falsifications and tooling errors. Valid and undetermined results
do not receive sample data. Rerunning clears the previous result.
Discarded sample steps are hidden by default. Actual goals, reasons, counterexample
strings and expected statuses are logged in Output, not converted into a graph.

## Configuration and Protocol

Commands, discovery progress, process exits, actual results and diagnostics are
logged without enabling trace. Enable `blaster-extension.trace` for raw CLI JSON
events.
The CLI service consumes newline-delimited JSON with schema version 1. Exit codes
1 (falsified) and 3 (undetermined) are verification outcomes, not process errors.
Malformed output or a missing completion event leaves a run incomplete.

## Manual Verification

Use the companion `CardanoLedgerApiBlaster` project for integration checks:

```sh
cd ../CardanoLedgerApiBlaster
lean-blaster discover ./ --json
lean-blaster check ./Tests/Scripts/HelloWorld/Properties.lean --solver-timeout 1s --json
```

In the Extension Development Host, verify first-open discovery, whole-file
execution from one row, Run All/Stop swapping, cancellation, source navigation,
collapse, clear, retry and partial-discovery diagnostics. Solver outcomes can
vary under the one-second limit. Native Windows/Linux cancellation requires
verification on those platforms.

## Project Layout

- `src/`: activation, CLI process lifecycle, data store, and webview controllers.
- `shared/`: public test/tree/result/message types.
- `webview-ui/`: React tree and result views.

See `CONTRIBUTING.md` for contribution guidelines.