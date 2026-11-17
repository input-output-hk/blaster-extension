const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Load the small React surface with the existing compiler, without a browser test dependency.
const extensions = { '.ts': require.extensions['.ts'], '.tsx': require.extensions['.tsx'] };
for (const extension of Object.keys(extensions)) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    module._compile(outputText, filename);
  };
}
const HelperText = require('../webview-ui/src/webview/testTree/components/HelperText.tsx').default;
for (const [extension, handler] of Object.entries(extensions)) {
  if (handler) require.extensions[extension] = handler;
  else delete require.extensions[extension];
}

const render = (statuses, actionState = { isBusy: false }) => renderToStaticMarkup(
  React.createElement(HelperText, {
    actionState,
    testTree: { workspaces: { workspace: { nodes: {
      folder: { type: 'folder', nodes: {
        file: { type: 'file', tests: Object.fromEntries(statuses.map((status, index) => [index, { status }])) },
      } },
    } } } },
  })
);

test('helper shows empty, active action and valid counts with elapsed wall-clock time', t => {
  t.mock.method(Date, 'now', () => 4000);
  assert.match(render(['empty', 'empty']), /No results yet\./);
  assert.doesNotMatch(render(['empty']), /codicon-pass|Elapsed time/);
  const running = render(['valid', 'empty', 'empty'], {
    isBusy: true, currentAction: { type: 'run', startedAt: 1000, isCancelling: false },
    run: { startedAt: 1000 },
  });
  assert.match(running, />1\/3</);
  assert.match(running, /1 of 3 properties valid/);
  assert.match(running, /codicon-loading/);
  assert.match(running, /3\.0s/);
  const starting = render(['empty'], {
    isBusy: true, currentAction: { type: 'run', startedAt: 4000 }, run: { startedAt: 4000 },
  });
  assert.match(starting, />0\/1</);
  for (const [type, text] of [['fetch', 'Fetching properties...'], ['clear', 'Clearing results...']]) {
    assert.ok(render([], { isBusy: true, currentAction: { type } }).includes(text));
  }
  assert.match(render([], { isBusy: true, currentAction: { type: 'run', isCancelling: true } }), /Stopping/);
});

test('completed helper freezes elapsed time, reflects falsified results, and resets after clearing', t => {
  t.mock.method(Date, 'now', () => 9000);
  const state = { isBusy: false, run: { startedAt: 1000, finishedAt: 3000 } };
  const passed = render(['valid', 'valid'], state);
  assert.match(passed, />2\/2</);
  assert.match(passed, /codicon-pass/);
  assert.match(passed, /2\.0s/);
  assert.doesNotMatch(passed, /codicon-loading/);
  const failed = render(['valid', 'invalid', 'empty'], state);
  assert.match(failed, />1\/3</);
  assert.match(failed, /codicon-error/);
  assert.match(render(['error'], state), /codicon-error/);
  const cleared = render(['empty', 'empty']);
  assert.match(cleared, /No results yet\./);
  assert.doesNotMatch(cleared, /Elapsed time|codicon-pass|codicon-error/);
});
