import { useCallback, useMemo } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
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

// Custom node component
function CustomNode({ data }: { data: { label: string; nodeType: string; riskScore?: number } }) {
  const getNodeStyles = () => {
    switch (data.nodeType) {
      case 'source':
        return 'bg-node-source/20 border-node-source text-node-source shadow-glow';
      case 'impacted':
        return 'bg-node-impacted/20 border-node-impacted text-node-impacted shadow-risk-high';
      default:
        return 'bg-node-default/30 border-node-default/50 text-muted-foreground';
    }
  };

  return (
    <div
      className={cn(
        'px-4 py-2 rounded-lg border-2 min-w-[120px] text-center transition-all',
        getNodeStyles()
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-border" />
      <div className="text-xs font-mono font-medium truncate max-w-[150px]">{data.label}</div>
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
  const initialNodes: Node[] = useMemo(
    () =>
      data.nodes.map((node, index) => ({
        id: node.id,
        type: 'custom',
        position: {
          x: 150 + (index % 3) * 200,
          y: 100 + Math.floor(index / 3) * 120,
        },
        data: {
          label: node.label,
          nodeType: node.type,
          riskScore: node.risk_score,
        },
      })),
    [data.nodes]
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      data.edges.map((edge, index) => ({
        id: `e${index}`,
        source: edge.source,
        target: edge.target,
        label: edge.relationship,
        animated: edge.source.includes('source'),
        style: { stroke: 'hsl(220, 20%, 30%)' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: 'hsl(220, 20%, 40%)',
        },
        labelStyle: { fill: 'hsl(215, 15%, 55%)', fontSize: 10 },
        labelBgStyle: { fill: 'hsl(222, 40%, 8%)', fillOpacity: 0.8 },
      })),
    [data.edges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className={cn('h-[400px] w-full rounded-lg border border-border bg-background/50', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        className="bg-background"
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
          maskColor="hsl(222, 47%, 5%, 0.8)"
          className="!bg-card !border-border"
        />
      </ReactFlow>
    </div>
  );
}
