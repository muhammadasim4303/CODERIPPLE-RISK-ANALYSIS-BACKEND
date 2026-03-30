import { useEffect, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { cn } from '@/lib/utils';

interface DependencyGraphProps {
  data: {
    nodes: Array<{
      id: string;
      label: string;
      type: 'source' | 'impacted' | 'unaffected';
      risk_score?: number;
    }>;
    edges: Array<{
      source: string;
      target: string;
      relationship: string;
    }>;
  };
  className?: string;
}

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 150, height: 50 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    node.position = {
      x: nodeWithPosition.x - 75,
      y: nodeWithPosition.y - 25,
    };

    return node;
  });

  return { nodes, edges };
};

// Custom node component
function CustomNode({ data }: { data: { label: string; nodeType: string; riskScore?: number } }) {
  const getNodeStyles = () => {
    switch (data.nodeType) {
      case 'source':
        return 'bg-[#00aaff] bg-opacity-20 border-[#00aaff] text-[#00aaff] shadow-glow';
      case 'impacted':
        return 'bg-[#ff4040] bg-opacity-20 border-[#ff4040] text-[#ff4040] shadow-risk-high';
      default:
        return 'bg-node-default/30 border-node-default/50 text-muted-foreground';
    }
  };

  return (
    <div
      className={cn(
        'px-4 py-2 rounded-lg border-2 min-w-[120px] text-center transition-all bg-card/80 backdrop-blur-sm',
        getNodeStyles()
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-border" />
      <div className="text-xs font-mono font-medium truncate max-w-[150px]" title={data.label}>{data.label}</div>
      {data.riskScore !== undefined && (
        <div className="text-[10px] mt-1 opacity-75">
          Risk: {(data.riskScore * 100).toFixed(0)}%
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-border" />
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

export function DependencyGraph({ data, className }: DependencyGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!data || !data.nodes || !data.edges) return;

    // First map to React Flow format
    const flowNodes: Node[] = data.nodes.map((node) => ({
      id: node.id,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: node.label,
        nodeType: node.type,
        riskScore: node.risk_score,
      },
    }));

    const sourceIds = new Set(data.nodes.filter(n => n.type === 'source').map(n => n.id));

    const flowEdges: Edge[] = data.edges.map((edge, index) => ({
      id: `e${index}-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.relationship,
      animated: sourceIds.has(edge.source) || edge.relationship === 'calls',
      style: { stroke: 'hsl(220, 20%, 30%)' },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'hsl(220, 20%, 40%)',
      },
      labelStyle: { fill: 'hsl(215, 15%, 55%)', fontSize: 10 },
      labelBgStyle: { fill: 'hsl(222, 40%, 8%)', fillOpacity: 0.8 },
    }));

    // Apply layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      flowNodes,
      flowEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [data, setNodes, setEdges]);

  return (
    <div className={cn('h-[400px] w-full rounded-lg border border-border bg-background/50', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        className="bg-transparent"
        nodesDraggable={true}
      >
        <Background color="hsl(220, 25%, 15%)" gap={20} size={1} />
        <Controls className="[&>button]:bg-secondary [&>button]:border-border [&>button]:text-foreground" />
        <MiniMap
          nodeColor={(node) => {
            switch (node.data?.nodeType) {
              case 'source':
                return 'hsl(195, 100%, 50%)';
              case 'impacted':
                return 'hsl(0, 75%, 55%)';
              default:
                return 'hsl(220, 30%, 25%)';
            }
          }}
          maskColor="hsl(222, 47%, 5%, 0.6)"
          className="!bg-card !border-border"
        />
        <Panel position="top-right" className="bg-background/80 px-2 py-1 rounded text-xs text-muted-foreground backdrop-blur">
          {nodes.length} nodes, {edges.length} edges
        </Panel>
      </ReactFlow>
    </div>
  );
}
