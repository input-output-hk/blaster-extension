const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');

const load = Module._load;
Module._load = function (id, ...args) {
  return id === 'vscode' ? {} : load.call(this, id, ...args);
};
const { isIgnoredPath } = require('../out/modules/haskellWatcher');
Module._load = load;

test('build output and tooling folders never trigger a refresh', () => {
  assert.equal(isIgnoredPath('/ws/plutus/dist-newstyle/build/x86_64-linux/ghc-9.6.7/autogen/Paths_x.hs'), true);
  assert.equal(isIgnoredPath('/ws/plutus/.git/index'), true);
  assert.equal(isIgnoredPath('C:\\ws\\plutus\\dist-newstyle\\Paths_x.hs'), true);
  assert.equal(isIgnoredPath('/ws/plutus/doc/Example/Ual/Recursive/FormalSpec.hs'), false);
  assert.equal(isIgnoredPath('/ws/plutus/doc/docusaurus-examples.cabal'), false);
});
