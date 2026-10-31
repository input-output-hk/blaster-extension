const hashPrefix = 'd03abcb194238e97b78fde2ad23965150fdf72b156731759b60f7d493836adb';
const scriptAddress = 'addr1wy8ccvgzslpjf9yhrprvmqulpmjpkpxf8c0hvtjwvw8n6pqdcrnp0';
const walletAddress = 'addr1qygsresrr4z5zggkwee8kz808ea3mzn7prhgfmralnqxvjvz57923as3zdhkgevjhq24qefkj074en0efej63ejhn2asau4xh2';
const originalDatum = '{"constructor":0,"fields":[{"constructor":0,"fields":[{"bytes":"636d0d0118a8933ac167d4c448150bb325deaf7a4fdfb44adc7f2f5a"}]},{"constructor":0,"fields":[{"constructor":0,"fields":[{"bytes":"636d0d0118a8933ac167d4c448150bb325deaf7a4fdfb44adc7f2f5a"}]},{"constructor":0,"fields":[{"constructor":0,"fields":[{"constructor":0,"fields":[{"bytes":"e39b5f40aa85fbc121a625d777a776eca1cb4c923426949c997d8828"}]}]}]}]},{"constructor":0,"fields":[]},{"constructor":0,"fields":[{"constructor":0,"fields":[{"bytes":"636d0d0118a8933ac167d4c448150bb325deaf7a4fdfb44adc7f2f5a"}]},{"constructor":0,"fields":[{"constructor":0,"fields":[{"constructor":0,"fields":[{"bytes":"e39b5f40aa85fbc121a625d777a776eca1cb4c923426949c997d8828"}]}]}]}]},{"constructor":0,"fields":[]},{"constructor":0,"fields":[{"bytes":"f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c"},{"bytes":"b950921763ce10c2600579460a4a40ba0c286bfab6497acd09ae0cd8b2ef687d"}]},{"constructor":0,"fields":[{"constructor":0,"fields":[]},{"constructor":0,"fields":[{"int":"193007890"}]},{"int":"63970881068"},{"constructor":0,"fields":[]}]},{"int":"2000000"},{"constructor":1,"fields":[]}]}';

const utxo = (
  hash: string, index: number, address: string, consumed: boolean,
  lovelace = 12507620, assets: TxAsset[] = [], datum?: string
): GraphNodeUTxO => ({
  type: 'utxo', identifier: `${hash}#${index}`, label: `UTxO #${index}`,
  consumed, address, utxo: `${hash}#${index}`, value: { lovelace, assets },
  ...(datum === undefined ? {} : { datum })
});

const transaction = (hash: string, index: number, inputs: GraphNodeUTxO[], outputs: GraphNodeUTxO[]): GraphTx => ({
  tx: {
    type: 'tx', identifier: hash, label: `Transaction #${index}`, id: hash,
    fee: 1682177, inputCount: inputs.length, outputCount: outputs.length
  },
  inputs, outputs
});

const firstHash = `${hashPrefix}c`;
const secondHash = `${hashPrefix}d`;
const firstOutput = utxo(firstHash, 0, walletAddress, true);
const secondOutput = utxo(firstHash, 1, walletAddress, true);

const sampleResult: TestResult = {
  steps: Array.from('abcdefgh', (suffix, index): CounterexampleStep => {
    const number = String(index + 1);
    const discarded = index >= 4;
    return {
      txHash: hashPrefix + suffix,
      data: discarded ? {} : { datum: `datum${number}`, redeemer: `redeemer${number}`, variable1: number.repeat(4) },
      discarded
    };
  }),
  graph: [
    transaction(firstHash, 1, [
      utxo('31596ecbdcf102c8e5c17e75c65cf9780996285879d18903f035964f3a7499a8', 0, scriptAddress, true, 12507620, [], originalDatum),
      utxo('26741de9ee337aa24ebeea078832a901c4deacce261e142a23186b1691513863', 1,
        'addr1wywecz65rtwrqrqemhrtn7mrczl7x2c4pqc9hfjmsa3dc7cr5pvqw', true, 1124910, [{
          name: 'BUIDLERFEST2026', policyId: 'e1ddde8138579e255482791d9fba0778cb1f5c7b435be7b3e42069de', quantity: 1
        }], 'foobar')
    ], [firstOutput, secondOutput, utxo(firstHash, 2, walletAddress, false)]),
    transaction(secondHash, 2, [
      firstOutput, secondOutput,
      utxo('31596ecbdcf102c8e5c17e75c65cf9780996285879d18903f035964f3a7499a9', 3, scriptAddress, true)
    ], [utxo(secondHash, 0, scriptAddress, false), utxo(secondHash, 1, scriptAddress, false)])
  ]
};

export default sampleResult;