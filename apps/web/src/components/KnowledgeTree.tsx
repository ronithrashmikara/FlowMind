'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Loader2, Eye, X } from 'lucide-react';
import NodeDetailsPanel from './NodeDetailsPanel';

interface UploadedFile {
  workspace_id: string;
  file_id: string;
  filename: string;
  topics: string[];
  sections: string[];
  concept_list: string[];
  raw_text: string;
}

interface KnowledgeTreeProps {
  uploadedFile: UploadedFile;
}

interface NodeData {
  label: string;
  description: string;
  type: 'topic' | 'concept' | 'detail';
  level: number;
}

export default function KnowledgeTree({ uploadedFile }: KnowledgeTreeProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const generateGraph = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/generate/graph', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: uploadedFile.raw_text,
          topics: uploadedFile.topics,
          workspace_id: uploadedFile.workspace_id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate graph');
      }

      const data = await response.json();
      
      // Convert to ReactFlow format
      const flowNodes: Node<NodeData>[] = data.nodes.map((node: any, index: number) => ({
        id: node.id,
        type: 'default',
        position: {
          x: (index % 3) * 300 + Math.random() * 100,
          y: Math.floor(index / 3) * 150 + node.level * 100,
        },
        data: {
          label: node.title,
          description: node.description,
          type: node.type,
          level: node.level,
        },
        style: {
          background: node.type === 'topic' ? '#3B82F6' : node.type === 'concept' ? '#10B981' : '#F59E0B',
          color: 'white',
          border: '1px solid #ccc',
          borderRadius: '8px',
          padding: '10px',
          fontSize: '12px',
          width: 180,
        },
      }));

      const flowEdges: Edge[] = data.edges.map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: true,
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (error) {
      console.error('Error generating graph:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node<NodeData>) => {
    setSelectedNode(node);
    setShowDetails(true);
  }, []);

  useEffect(() => {
    generateGraph();
  }, [uploadedFile]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900">Generating Knowledge Tree...</p>
          <p className="text-sm text-gray-600">This may take a few moments</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Knowledge Tree</h2>
          <p className="text-gray-600">Interactive visualization of your document's concepts</p>
        </div>
        <button
          onClick={generateGraph}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          Regenerate
        </button>
      </div>

      <div className="h-96 border rounded-lg bg-gray-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Topics</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Concepts</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span>Details</span>
          </div>
        </div>
        <p className="mt-2">Click on any node to view detailed information</p>
      </div>

      {/* Node Details Panel */}
      {showDetails && selectedNode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Node Details</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto">
              <NodeDetailsPanel
                node={selectedNode}
                content={uploadedFile.raw_text}
                workspaceId={uploadedFile.workspace_id}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
