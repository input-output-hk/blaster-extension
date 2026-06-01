import {
  VscodeSingleSelect,
  VscodeOption,
} from '@vscode-elements/react-elements';

interface Props {
  testTree: TestTree[];
  selectedTestId?: string;
  onTestSelected: (testId: string) => void;
}

interface Option {
  label: string;
  value?: string;
}

const TestSelector: React.FC<Props> = ({ testTree, selectedTestId, onTestSelected }) => {
  
  const onChange = (e: Event) => {
    const value = (e.target as EventTarget & { value?: string }).value;
    if (value) onTestSelected(value);
  };

  const getSelectOptions = (): Option[] => {
    const options: Option[] = [];

    const traverse = (nodes: TestTreeNode[], prefix = '-') => {
      for (const node of nodes) {
        if (node.type === 'folder') {
          options.push({ label: prefix + ' ' + node.label });
          traverse((node as TestTreeFolderNode).children, prefix + '-');
        } else if (node.type === 'file') {
          options.push({ label: prefix + ' ' + node.label });
          for (const test of (node as TestTreeFileNode).tests) {
            options.push({ label: prefix + '- ' + test.label, value: test.id });
          }
        }
      }
    };

    for (const tree of testTree) {
      options.push({ label: tree.label });
      traverse(tree.children);
    }

    return options;
  };

  return (
    <VscodeSingleSelect onChange={onChange} value={selectedTestId}>
      {getSelectOptions().map((option, index) =>
        <VscodeOption key={index} value={option.value}>{option.label}</VscodeOption>
      )}
    </VscodeSingleSelect>
  );
};

export default TestSelector;
