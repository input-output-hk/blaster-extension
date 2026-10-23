import { useState } from 'react';
import {
  VscodeTableHeader,
  VscodeTableHeaderCell,
  VscodeTableBody,
  VscodeTableRow,
  VscodeTableCell
} from '@vscode-elements/react-elements';

import ScrollableTable from '../../../../components/ScrollableTable';

interface Props {
  test: Test;
  testResult: TestResult;
  isActive: boolean;
}

interface TableHeaderProps {
  headers: Array<string>;
}

interface TableBodyProps {
  steps: Array<CounterexampleStep>;
  columns: Array<string>;
}

const TableHeader: React.FC<TableHeaderProps> = ({ headers }) => (
  <VscodeTableHeader slot="header" className="bg-[var(--vscode-sideBar-background)] min-w-24">
    {headers.map(column => (
      <VscodeTableHeaderCell key={column} className="p-2 border border-[var(--vscode-sideBar-border)] text-[var(--vscode-sideBar-foreground)] text-center">
        {column}
      </VscodeTableHeaderCell>
    ))}
  </VscodeTableHeader>
);

const TableBody: React.FC<TableBodyProps> = ({ steps, columns }) => (
  <VscodeTableBody slot="body" className="flex-1 min-h-0 overflow-y-auto">
    {steps.map((step, index) =>
      <VscodeTableRow
        key={`${step.txHash}:${index}`}
        className={index % 2 === 0 ? 'bg-[var(--vscode-panel-background)]' : 'bg-[var(--vscode-sideBar-background)]'}
      >
        <VscodeTableCell className="p-2 break-all">
          {step.txHash}
        </VscodeTableCell>
        {columns.map(column => (
          <VscodeTableCell key={column} className="p-2 break-all">
            <span className="whitespace-pre-wrap">{step.data[column] ?? '-'}</span>
          </VscodeTableCell>
        ))}
        <VscodeTableCell className="p-2">{step.discarded ? 'Yes' : 'No'}</VscodeTableCell>
      </VscodeTableRow>
    )}
  </VscodeTableBody>
);

const CounterexampleView: React.FC<Props> = ({ test, testResult, isActive }) => {
  const [showDiscarded, setShowDiscarded] = useState(false);
  const steps = testResult.steps ?? [];
  const columns = Array.from(new Set(steps.flatMap(step => Object.keys(step.data))));
  return (
  <div className="flex flex-col h-full border border-[var(--vscode-sideBar-border)]">
    <label className="flex items-center gap-2 px-3 py-2 text-xs">
      <input type="checkbox" checked={showDiscarded} onChange={event => setShowDiscarded(event.target.checked)} />
      Show discarded
    </label>
    <ScrollableTable
      key={`${test.workspaceId}:${test.id}`}
      isActive={isActive}
    >
      <TableHeader headers={['Tx Hash', ...columns, 'Discarded']} />
      <TableBody steps={showDiscarded ? steps : steps.filter(step => !step.discarded)} columns={columns} />
    </ScrollableTable>
  </div>
  );
};

export default CounterexampleView;
