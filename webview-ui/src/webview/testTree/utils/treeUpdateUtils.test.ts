import { describe, expect, test } from 'vitest';
import { updateOpenTestTreeNode, updateTest, updateTestWorkspace } from './treeUpdateUtils';
import { makeTree } from '../../../test/fixtures';

describe('updateTestWorkspace', () => {
  test('merges the update into a new workspace and leaves the input unchanged', () => {
    const { tree } = makeTree();
    const next = updateTestWorkspace(tree, { id: 'workspace', status: 'valid', time: 12 });

    expect(next.workspaces.workspace).toMatchObject({ status: 'valid', time: 12, path: '/home/user/project' });
    expect(next.workspaces.workspace.nodes).toBe(tree.workspaces.workspace.nodes);
    expect(tree).toEqual(makeTree().tree);
  });

  test('returns the same tree for an unknown workspace', () => {
    const { tree } = makeTree();
    expect(updateTestWorkspace(tree, { id: 'unknown', status: 'valid' })).toBe(tree);
  });
});

describe('updateTest', () => {
  test('replaces only the nested test and the nodes above it', () => {
    const { tree, a } = makeTree();
    const next = updateTest(tree, { ...a, status: 'invalid', time: 5 });

    const types = (next.workspaces.workspace.nodes.Ledger as TestTreeFolderNode).nodes['Types.lean'] as TestTreeFileNode;
    const previous = (tree.workspaces.workspace.nodes.Ledger as TestTreeFolderNode).nodes['Types.lean'] as TestTreeFileNode;
    expect(types.tests.a).toMatchObject({ status: 'invalid', time: 5 });
    expect(types.tests.b).toBe(previous.tests.b);
    expect(next.workspaces.workspace.nodes['Main.lean']).toBe(tree.workspaces.workspace.nodes['Main.lean']);
    expect(tree).toEqual(makeTree().tree);
  });

  test('returns the same tree for an unknown workspace or test', () => {
    const { tree, a } = makeTree();
    expect(updateTest(tree, { ...a, workspaceId: 'unknown' })).toBe(tree);
    expect(updateTest(tree, { ...a, id: 'unknown' })).toBe(tree);
  });
});

describe('updateOpenTestTreeNode', () => {
  test('opens the workspace without a path', () => {
    const { tree } = makeTree();
    const next = updateOpenTestTreeNode(tree, true, 'workspace');
    expect(next.workspaces.workspace.isOpen).toBe(true);
    expect(next.workspaces.workspace.nodes).toBe(tree.workspaces.workspace.nodes);
  });

  test('opens only the node at the path', () => {
    const { tree } = makeTree();
    const next = updateOpenTestTreeNode(tree, true, 'workspace', ['Ledger', 'Types.lean']);

    const ledger = next.workspaces.workspace.nodes.Ledger as TestTreeFolderNode;
    expect(ledger.nodes['Types.lean'].isOpen).toBe(true);
    expect(ledger.isOpen).toBe(false);
    expect(next.workspaces.workspace.isOpen).toBe(false);
    expect(next.workspaces.workspace.nodes['Main.lean']).toBe(tree.workspaces.workspace.nodes['Main.lean']);
    expect(tree).toEqual(makeTree().tree);
  });

  test('returns the same tree for an unknown workspace or path', () => {
    const { tree } = makeTree();
    expect(updateOpenTestTreeNode(tree, true, 'unknown')).toBe(tree);
    expect(updateOpenTestTreeNode(tree, true, 'workspace', ['Missing'])).toBe(tree);
    expect(updateOpenTestTreeNode(tree, true, 'workspace', ['Ledger', 'Missing.lean'])).toBe(tree);
    expect(updateOpenTestTreeNode(tree, true, 'workspace', ['Main.lean', 'Nested'])).toBe(tree);
  });
});
