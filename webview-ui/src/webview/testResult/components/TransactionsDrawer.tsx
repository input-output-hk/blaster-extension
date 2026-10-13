import { useMemo, useState } from "react";
import {
  VscodeTabs,
  VscodeTabHeader,
  VscodeTabPanel,
} from "@vscode-elements/react-elements";
import { formatHash } from "../../utils/cardanoUtils";

interface Props {
  graph: TestGraph;
  onFocusUtxo: (id: string) => void;
}

const TransactionsDrawer: React.FC<Props> = ({ graph, onFocusUtxo }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);
  const handleReset = () => setSearch("");
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearch(e.target.value);
  const handleUtxoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const id = e.currentTarget.dataset.utxoId;
    if (id) onFocusUtxo(id);
  };

  const utxoMap = useMemo(
    () => new Map(graph.utxos.map((u) => [`${u.txHash}#${u.outputIndex}`, u])),
    [graph],
  );

  const inputUtxos = useMemo(() => {
    const ids = new Set(graph.txs.flatMap((tx) => tx.inputs));
    return [...ids]
      .map((id) => utxoMap.get(id))
      .filter((u): u is TestGraph["utxos"][number] => u !== undefined);
  }, [graph, utxoMap]);

  const outputUtxos = useMemo(() => {
    const ids = new Set(graph.txs.flatMap((tx) => tx.outputs));
    return [...ids]
      .map((id) => utxoMap.get(id))
      .filter((u): u is TestGraph["utxos"][number] => u !== undefined);
  }, [graph, utxoMap]);

  if (!isOpen) {
    return (
      <div
        className="group absolute top-2 left-2 z-10 bg-base-19 rounded-[8px] h-[47px] min-w-[47px] pl-[11.5px] hover:pl-3 hover:pr-4 hover:gap-3 flex items-center justify-start shrink-0 cursor-pointer transition-[padding,gap] duration-200 ease-out"
        onClick={handleOpen}
      >
        <div className="size-6 rounded-full border border-base-06 flex items-center justify-center shrink-0">
          <i className="codicon codicon-list-unordered text-base-06 text-xs" />
        </div>
        <span className="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[160px] group-hover:opacity-100 transition-[max-width,opacity] duration-200 ease-out text-base-06 text-[14px] whitespace-nowrap">
          Transaction Index
        </span>
      </div>
    );
  }

  const filteredInputs = inputUtxos.filter((u) =>
    `${u.txHash}#${u.outputIndex}`.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredOutputs = outputUtxos.filter((u) =>
    `${u.txHash}#${u.outputIndex}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="absolute top-2 left-2 z-10 w-[219px] bg-base-19 rounded-xl flex flex-col animate-[fadeIn_0.15s_ease-out]">
      <div className="flex items-center justify-between px-4 h-10 shrink-0">
        <button
          className="flex items-center justify-center"
          onClick={handleClose}
        >
          <i className="codicon codicon-arrow-left text-base-06 text-base" />
        </button>
        <button className="text-base-06 text-[13px]" onClick={handleReset}>
          Reset
        </button>
      </div>

      <div className="px-4 pb-2 shrink-0">
        <span className="text-base-06 text-[14px]">Transactions Index</span>
      </div>

      <div className="px-4 py-4 shrink-0">
        <div className="bg-base-14 rounded-[5px] flex items-center px-2 py-1">
          <input
            className="flex-1 bg-transparent text-base-09 text-[13px] outline-none placeholder:text-base-09"
            placeholder="Search..."
            value={search}
            onChange={handleSearchChange}
          />
          <i className="codicon codicon-search text-base-09 text-base" />
        </div>
      </div>

      <VscodeTabs className="px-4">
        <VscodeTabHeader slot="header">Inputs</VscodeTabHeader>
        <VscodeTabHeader slot="header">Outputs</VscodeTabHeader>

        <VscodeTabPanel>
          <div className="flex flex-col pl-1 pb-4 overflow-y-auto">
            {filteredInputs.map((utxo) => (
              <div
                key={`${utxo.txHash}#${utxo.outputIndex}`}
                data-utxo-id={`${utxo.txHash}#${utxo.outputIndex}`}
                className="px-4 py-1 text-base-06 text-[11px] cursor-pointer hover:text-blue-04"
                onClick={handleUtxoClick}
              >
                {formatHash(utxo.txHash, 10)}#{utxo.outputIndex}
              </div>
            ))}
          </div>
        </VscodeTabPanel>

        <VscodeTabPanel>
          <div className="flex flex-col pl-1 pb-4 overflow-y-auto">
            {filteredOutputs.map((utxo) => (
              <div
                key={`${utxo.txHash}#${utxo.outputIndex}`}
                data-utxo-id={`${utxo.txHash}#${utxo.outputIndex}`}
                className="px-4 py-1 text-base-06 text-[11px] cursor-pointer hover:text-blue-04"
                onClick={handleUtxoClick}
              >
                {formatHash(utxo.txHash, 10)}#{utxo.outputIndex}
              </div>
            ))}
          </div>
        </VscodeTabPanel>
      </VscodeTabs>
    </div>
  );
};

export default TransactionsDrawer;
