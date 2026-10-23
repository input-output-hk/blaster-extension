# Blaster VS Code Extension

Discover Lean properties in workspace folders, run verification, and inspect
statuses, timings, counterexample steps, and transaction graphs in VS Code.

## Prerequisites

- VS Code matching the version in `package.json`.
- Node.js 22 or newer and npm for development.
- Elan/Lake available on the PATH inherited by VS Code, plus each Lean project's
    pinned toolchain, dependencies, and required solver.
- A matching Blaster RPC API executable in `bin/`.

The extension launches `bin/blaster-rpc-api-${platform}-${arch}` (`.exe` on Windows).
The bundled macOS arm64 binary is built from the companion `blaster-rpc-api`
project. Other platform binaries are not included or verified by this migration.
The old `sc-verifier` CLI is not used.

## Local Development

```sh
npm install
npm test
npm run compile
```

Compilation builds the extension host into `out/` and React webviews into `build/`.
Open this extension project in VS Code and launch its Extension Development Host
with F5. In that window, open a prepared Lean project and select the Blaster view.

Use **Blaster: Refresh Test Tree** to discover properties. Run individual tests,
files, folders, workspaces, or **Blaster: Run All Tests**. Opening a test result
shows its latest state; **Blaster: Clear All Results** clears completed runs.
Refresh and clear operations are guarded while tests are pending. Expansion state
is retained during discovery in the current extension session.

For the companion examples, prepare dependencies with `lake build Blaster` from
its `example/` directory. The deliberately false theorem is a verification sample,
so a full example-library build is expected to fail on that theorem.

## Result Limitations

Verification status and elapsed time are real. For confirmed invalid proofs,
`steps` and `graph` currently contain historical sample data supplied by the RPC
API, not extracted counterexample evidence. Valid tests and tooling failures do
not receive sample details. Rerunning a test clears its previous result first.

The counterexample table displays transaction hashes and data fields, with discarded
steps hidden by default. The graph uses transaction and UTxO nodes and plain values.
Real counterexample extraction is deferred to the API implementation.

## Configuration and Protocol

Enable `blaster-extension.trace` for RPC traffic and normal server exit messages
in the **Blaster** output channel.

The extension uses the new `fetch` request, `run` notification, and `testEvent`
notifications. The old RPC protocol is unsupported. Shared TypeScript types live
in `shared/types.d.ts`; full wire documentation and native protocol tests live in
the companion API repository.

## Project Layout

- `src/`: activation, RPC process lifecycle, data store, and webview controllers.
- `shared/`: public test/tree/result/message types.
- `webview-ui/`: React tree and result views.
- `scripts/regression.test.cjs`: focused state, selection, subscription, and queue tests.
- `bin/`: platform-specific RPC executables.

See `CONTRIBUTING.md` for contribution guidelines.