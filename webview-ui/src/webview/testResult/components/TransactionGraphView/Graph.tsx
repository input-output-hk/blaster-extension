import { useState, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  useReactFlow,
  useNodesInitialized,
  useNodesState,
  useEdgesState,
  applyNodeChanges
} from '@xyflow/react';

import GraphNode from './GraphNode';
import MiniMapNode from './MiniMapNode';

import {
  mapGraphTxsToGraphData,
  applyMeasuredLayout,
  resolveNodeCollisions
} from '../../utils/reactFlowUtils';

import type { Node, Edge, OnNodeDrag, OnNodesChange } from '@xyflow/react';

import "@xyflow/react/dist/style.css";

interface Props {
  graphTxs: Array<GraphTx>;
  nodeId?: string;
  isActive: boolean;
}

const nodeTypes = { tx: GraphNode, utxo: GraphNode };

const mapNodeToColor = (node: Node): string => {
  switch (node.type) {
    case 'tx':
      return '#73C991';
    case 'utxo':
      return '#569CD6';
    default:
      return '#FFFFFF';
  }
};

const Graph: React.FC<Props> = (props) => {
  const [graphTxs, setGraphTxs] = useState<Array<GraphTx> | null>(null);
  const [layouted, setLayouted] = useState<boolean>(false);

  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const reactFlowInstance = useReactFlow();
  const nodesInitialized = useNodesInitialized();

  if (graphTxs !== props.graphTxs) {
    const graphData = mapGraphTxsToGraphData(props.graphTxs);
    setNodes(graphData.nodes);
    setEdges(graphData.edges);
    setGraphTxs(props.graphTxs);
    setLayouted(false);
  }

  useEffect(() => {
    if (nodesInitialized && !layouted) {
      const measuredNodes = reactFlowInstance.getNodes();

      if (
        measuredNodes.length !== nodes.length ||
        measuredNodes.some(node => !nodes.some(currentNode => currentNode.id === node.id) || !node.measured?.width || !node.measured?.height)
      ) {
        return;
      }

      const positions = applyMeasuredLayout(measuredNodes);
      const animationFrame = requestAnimationFrame(() => {
        setLayouted(true);
        setNodes(currentNodes => currentNodes.map(node => ({
          ...node,
          position: positions[node.id] ?? node.position,
        })));
      });

      return () => cancelAnimationFrame(animationFrame);
    }
  }, [nodesInitialized, layouted, nodes, reactFlowInstance, setNodes]);

  useEffect(() => {
    if (props.isActive && layouted) {
      const timeout = setTimeout(() =>
        reactFlowInstance.fitView({
          nodes: props.nodeId ? [{ id: props.nodeId }] : undefined,
          duration: 300,
          minZoom: 0.5,
          maxZoom: 1.0,
        })
      );
      return () => clearTimeout(timeout);
    }
  }, [props.isActive, props.nodeId, layouted, reactFlowInstance]);

  const onNodeDrag: OnNodeDrag<Node> = (_, draggedNode) => {
    setNodes(currentNodes => resolveNodeCollisions(
      currentNodes.map(node => node.id === draggedNode.id ? {
        ...node,
        position: draggedNode.position,
      } : node)
    ));
  };

  const onNodesChange: OnNodesChange<Node> = changes => {
    const dimensionsChanged = changes.some(change => change.type === 'dimensions');
    setNodes(currentNodes => {
      const changedNodes = applyNodeChanges(changes, currentNodes);
      return layouted && dimensionsChanged
        ? resolveNodeCollisions(changedNodes)
        : changedNodes;
    });
  };

  return (
    <ReactFlow
      className="transaction-graph"
      style={{
        '--xy-controls-button-background-color': 'var(--vscode-button-secondaryBackground)',
        '--xy-controls-button-background-color-hover': 'var(--vscode-button-secondaryHoverBackground)',
        '--xy-controls-button-color': 'var(--vscode-button-secondaryForeground)',
        '--xy-controls-button-color-hover': 'var(--vscode-button-secondaryForeground)',
      } as React.CSSProperties}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDrag={onNodeDrag}
      nodeTypes={nodeTypes}
    >
      <MiniMap
        pannable={true}
        bgColor="var(--vscode-settings-numberInputBackground)"
        maskColor="color-mix(in srgb, var(--vscode-sideBarTitle-foreground) 12%, transparent)"
        nodeColor={mapNodeToColor}
        nodeComponent={MiniMapNode}
      />
      <Controls showInteractive={false} />
      <Background
        bgColor="color-mix(in srgb, var(--vscode-panel-background) 92%, black)"
        color="var(--vscode-sideBar-border, var(--vscode-sideBarSectionHeader-border))"
      />
    </ReactFlow>
  );
};

const GraphWithProvider: React.FC<Props> = (props) => (
  <ReactFlowProvider>
    <Graph {...props} />
  </ReactFlowProvider>
);

export default GraphWithProvider;
