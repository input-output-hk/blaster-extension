`list-generators.json` is the output of `node scripts/blueprints/list-generators.js` run on
[RSoulatIOHK/plutus](https://github.com/RSoulatIOHK/plutus) PR #2
(branch `feat/ual-ndjson-generators`, commit `9516d8b6c`), with `cwd` replaced by `${ROOT}`.
`auction.ndjson` is the `--ndjson` output of `docusaurus-examples:exe:example-ual-auction`
from the same commit (35 records, including the bundled `environment.json`), generated inside `nix develop`.
Plutus is Apache-2.0 licensed. Property titles and contents are excerpts of its UAL examples.
