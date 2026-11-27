# CLAUDE.md

VS Code extension ("Blaster") that discovers and verifies Lean properties by shelling out to the
`lean-blaster` CLI, then shows results in React webviews (status tree, counterexample table,
transaction graph). Maintained by IOG's Cardano High Assurance team.

## General

- Primary branch is `main`. Feature branches use `feature/<issue>-<slug>` (e.g. `feature/41-proof-run-errors`).
- Scope: only this repo. Don't read or change sibling repos (e.g. `lean-blaster`) unless the user asks.

## Brother app: sc-testing-tools-vs-extension

- `sc-testing-tools-vs-extension` (at `/run/media/had3z/big ssd/work/IOHK/sc-testing-tools-vs-extension`)
  is a brother app. Both are VS Code extensions with the same stack and webview structure, and they
  share a lot of code (`webview-ui/src/components`, `style.css`, tree views, filters, ...).
- The user will sometimes ask to bring code (or a feature) over from there. Then:
  - You may read the brother app freely, including its `- plans -` folder and git branches. Never modify it.
  - Port, don't paste: adapt to Blaster's model. Blaster's tree is workspace → folder/file → `Test`
    (theirs: package → suite → group → test node), and Blaster tests have no `type`. In Blaster,
    `undetermined` is a real result and "not run" is `empty`.
  - Apply this file's rules to ported code (VS Code colors, named handlers, JSDoc, minimal changes).
  - Write a plan first (see Planning) listing source → target files and every deviation.
  - Keep names and file paths the same where possible, so future ports stay easy to diff.

## Commands

```sh
npm install              # root + webview-ui workspace
npm run compile          # tsc -> out/  and  vite build -> build/
npm run compile:extension
npm run compile:webview
npm run lint -w webview-ui     # currently broken: no eslint.config.js in webview-ui
npm test -w webview-ui          # Vitest, webview pure logic (*.test.ts next to the code)
npm run test:coverage -w webview-ui
```

- Debug: F5 ("Run Extension") runs `npm run compile` then opens an Extension Development Host.
  Open a prepared Lean project there and select the Blaster activity bar view.
- Tests only exist in `webview-ui` (no root `test` script, even though the README mentions `npm test`).
  The extension host has no tests.
- `out/` and `build/` are generated and gitignored. Never edit them.

## Runtime requirements (for manual testing)

`lean-blaster`, Elan/Lake, the Lean project's pinned toolchain and the solver must be on the PATH
that VS Code inherits. Without them discovery fails with "lean-blaster not found on PATH".

## Architecture

Two separate TypeScript builds:

- **Extension host** (`src/`, CommonJS via `tsconfig.json`, excludes `webview-ui`)
  - `extension.ts`: builds a `BlasterContext` (store, views, output channel, status bar) and activates everything.
  - `services/command.ts`: the only place that talks to `lean-blaster`.
    - Discovery: `lean-blaster discover <workspace> --json` per workspace folder (exit 0 or 4 is OK).
    - Run: `lean-blaster check <file.lean> --solver-timeout 1s --json`.
    - Output is NDJSON, `schemaVersion: 1`, events `discovery | result | diagnostic | complete`,
      validated strictly in `parseEvent`. Unknown/invalid events abort the run.
    - Runs are queued one at a time (`async.queue`, concurrency 1) and deduped by a hash of the `TestRun`.
    - Lean checks whole files, so any selection is widened to the whole file.
    - Results map to tests by position inside each test's range. Several results for one site
      combine to the worst status with summed time.
  - `services/testStore.ts`: facade between `Command`, the database and the views. Holds tree open state.
  - `services/database/`: RxDB with **in-memory** storage (nothing persists across sessions).
    Schemas live in `collections/schemas/`, queries/mutations in `methods.ts`.
  - `modules/testTreeView.ts`, `modules/testResultView.ts`: webview controllers. They register
    commands and route `postMessage` traffic.
  - `utils/webview.ts`: loads `build/<name>.html` and rewrites asset URLs with `asWebviewUri`.
  - `utils/sampleResult.ts`: **placeholder** counterexample steps/graph used for falsified/undetermined
    results. Real counterexample extraction isn't implemented yet.
- **Webviews** (`webview-ui/`, npm workspace, React 19 + Vite + Tailwind 4 + `@vscode-elements/react-elements`,
  `@xyflow/react` for the graph). Two entrypoints, `testTree` and `testResult`, built into `../build/`.
- **Shared types**: `shared/types.d.ts` holds *global* ambient types (`Test`, `TestRun`, `TestEvent`,
  `RunStatus`, webview message unions, etc.) used by both builds without imports. Change message
  shapes there first.

## Domain rules

- Test IDs: `<relative path>:<line>:<column>`, 1-based in the CLI and IDs, 0-based in `TestRangePosition`
  (see `toPosition`).
- `TestRun` selections use workspace-relative, forward-slash paths and `line:column` ids.
  Omitted `tests`/`ids` means "all". An empty array means "none".
- `RunStatus`: `empty | valid | undetermined | invalid | error`. A result whose status equals the source's
  `expectedStatus` counts as `valid`. CLI `error`/`skipped` results are `error`, `falsified` is `invalid`.
- All CLI output, stderr and diagnostics go to the **Blaster** output channel.
- Commands are prefixed `blaster-extension.` and contributed in `package.json`. Keep the
  `package.json` contributions in sync with the `registerCommand` calls.

## Styling

- Webviews use Tailwind CSS 4. Use Tailwind utility classes, not custom CSS. `webview-ui/src/style.css`
  is only for the theme, global resets and third-party overrides (react-flow, react-tooltip).
- **Colors: use VS Code theme variables.** Write them as Tailwind arbitrary values, e.g.
  `bg-[var(--vscode-sideBar-background)]`, `text-[var(--vscode-descriptionForeground)]`,
  `border-[var(--vscode-sideBar-border)]`, `text-[var(--vscode-testing-iconPassed)]`, so the UI
  follows the user's theme (light, dark, high contrast).
- Fall back to the palette tokens in `style.css` (`text-blue-06`, `bg-green-05`, ...) only when no
  suitable `--vscode-*` variable exists. Never convert existing `var(--vscode-*)` colors back to tokens,
  and don't add raw hex values (e.g. `text-[#B180D7]`). Use the matching token or variable instead.
- Mapping Figma colors: first look for a matching VS Code theme variable. If none fits, use the
  closest token from `style.css`:
  - Base (white → black): `base-01` (#FFFFFF) … `base-21` (#000000)
  - Blue: `blue-01` … `blue-11` (e.g. `#007ACC` → `blue-06`)
  - Red: `red-01` … `red-04`
  - Green: `green-01` … `green-05`
  - Purple: `purple-01` … `purple-04` (e.g. `#B180D7` → `purple-02`)
  - Yellow: `yellow-01` … `yellow-05`
  - Orange: `orange-01` … `orange-03`
- Theme-specific styles: use the `dark:` / `light:` variants (they key off `body.vscode-dark` /
  `body.vscode-light`), not `prefers-color-scheme`.

## Figma

- Figma links (`figma.com/design/...`, `figma.com/file/...`): always read them through the `figma`
  MCP server (configured in `.mcp.json`), never by fetching the URL. Use `get_design_context` (and
  `get_screenshot` when useful) before implementing anything.
- If its tools aren't available, ask the user to authenticate it with `/mcp`.
- Treat the generated code as a reference. Rebuild it with this project's components, codicons and
  colors (see Styling and UI Components).

## UI Components

- Webview UI uses `@vscode-elements/react-elements`. Stick to the components in that package plus the
  existing ones in `webview-ui/src/components/`. Don't add other UI libraries.
- Icons are VS Code codicons (`@vscode/codicons`), used as `<i className="codicon codicon-<name>" />`.
  Always look up the codicon library first for a suitable icon. If none fits, ask the user for a
  replacement name or wait for them to provide an SVG.

## Code Style

- Keep changes minimal. Don't refactor or improve code beyond what was asked.
- Don't add comments, docstrings, or type annotations to code you didn't change.
- Add a JSDoc comment to every function you add (including small helpers and named handlers).
- Don't add error handling for scenarios that can't happen.
- Never add inline functions, even one-liners (e.g. in JSX props). Always create a named handler.
  This applies to new code. Don't rewrite existing inline functions unless asked.
- Formatting: 2-space indent, single quotes, `import type` for type-only imports.

## Planning

- Whenever the user asks for a plan, write it to a file in the `- plans -` folder (create it if it
  doesn't exist) so they can review it before any code changes. Do this even if they don't ask
  for a file.
- Prefix every new plan file name with `- ` (e.g. `- 41_proof_run_errors.md`) so it sorts first.
- When creating a new plan, remove the leading `- ` / `-` prefix from all other plans in the folder,
  so only the newest plan keeps it.

## Skills

- Project skills live in `.claude/skills/` (`tdd`, `ponytail*`). Use `tdd` when adding a test setup.
