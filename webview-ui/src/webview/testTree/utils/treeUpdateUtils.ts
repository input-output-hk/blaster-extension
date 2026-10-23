export const updateTestWorkspace = (testTree: TestTree, workspace: TestTreeWorkspaceUpdate): TestTree => {
  const workspaceNode = testTree.workspaces[workspace.id];
  if (!workspaceNode) return testTree;

  return {
    ...testTree,
    workspaces: {
      ...testTree.workspaces,
      [workspace.id]: {
        ...workspaceNode,
        ...workspace,
      },
    },
  };
};

export const updateTest = (testTree: TestTree, test: Test): TestTree => {
  const workspaceNode = testTree.workspaces[test.workspaceId];
  if (!workspaceNode) return testTree;

  const updateNodes = (nodes: GenericMap<TestTreeGroupNode>): GenericMap<TestTreeGroupNode> => {
    let updated = false;
    const nextNodes: GenericMap<TestTreeGroupNode> = {};

    for (const [key, node] of Object.entries(nodes)) {
      let nextNode = node;

      if (node.type === 'folder') {
        const folderNode = node as TestTreeFolderNode;
        const nextFolderNodes = updateNodes(folderNode.nodes);
        if (nextFolderNodes !== folderNode.nodes) {
          nextNode = { ...folderNode, nodes: nextFolderNodes } as TestTreeFolderNode;
        }
      } else {
        const fileNode = node as TestTreeFileNode;
        const existingTest = fileNode.tests[test.id];
        if (existingTest) {
          nextNode = {
            ...fileNode,
            tests: {
              ...fileNode.tests,
              [test.id]: { ...existingTest, ...test },
            },
          } as TestTreeFileNode;
        }
      }

      nextNodes[key] = nextNode;
      if (nextNode !== node) updated = true;
    }

    return updated ? nextNodes : nodes;
  };

  const nextNodes = updateNodes(workspaceNode.nodes);
  if (nextNodes === workspaceNode.nodes) return testTree;

  return {
    ...testTree,
    workspaces: {
      ...testTree.workspaces,
      [test.workspaceId]: {
        ...workspaceNode,
        nodes: nextNodes,
      },
    },
  };
};

export const updateOpenTestTreeNode = (
  testTree: TestTree,
  isOpen: boolean,
  workspaceId: string,
  path?: Array<string>
): TestTree => {
  const workspaceNode = testTree.workspaces[workspaceId];
  if (!workspaceNode) return testTree;

  if (!path || path.length === 0) {
    return updateTestWorkspace(testTree, { id: workspaceId, isOpen });
  }

  const updateNodes = (nodes: GenericMap<TestTreeGroupNode>, index: number): GenericMap<TestTreeGroupNode> => {
    const key = path[index];
    const node = nodes[key];
    if (!node) return nodes;
    if (index === path.length - 1) {
      return { ...nodes, [key]: { ...node, isOpen } };
    }
    if (node.type !== 'folder') return nodes;
    const folder = node as TestTreeFolderNode;
    const nextNodes = updateNodes(folder.nodes, index + 1);
    return nextNodes === folder.nodes ? nodes : {
      ...nodes, [key]: { ...folder, nodes: nextNodes } as TestTreeFolderNode
    };
  };
  const nodes = updateNodes(workspaceNode.nodes, 0);
  return nodes === workspaceNode.nodes ? testTree : updateTestWorkspace(testTree, { id: workspaceId, nodes });
};