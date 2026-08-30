'use client';

import { useState, useEffect } from 'react';
import { Loader2, BookOpen, Lightbulb, FileText, Link } from 'lucide-react';

interface Node {
  id: string;
  data: {
    label: string;
    description: string;
    type: 'topic' | 'concept' | 'detail';
    level: number;
  };
}

interface NodeDetailsPanelProps {
  node: Node;
  content: string;
  workspaceId: string;
}

interface NodeDetails {
  theory: string;
  simplified: string;
  examples: string[];
  flashcards: Array<{ question: string; answer: string }>;
  references: string[];
}

export default function NodeDetailsPanel({ node, content, workspaceId }: NodeDetailsPanelProps) {
  const [details, setDetails] = useState<NodeDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'theory' | 'simplified' | 'examples' | 'flashcards'>('theory');

  useEffect(() => {
    const fetchNodeDetails = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/node/details', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nodeTitle: node.data.label,
            content: content,
            workspace_id: workspaceId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch node details');
        }

        const data = await response.json();
        setDetails(data);
      } catch (error) {
        console.error('Error fetching node details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNodeDetails();
  }, [node, content, workspaceId]);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading details...</p>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600">Failed to load details</p>
      </div>
    );
  }

  const tabs = [
    { id: 'theory', label: 'Theory', icon: BookOpen },
    { id: 'simplified', label: 'Simplified', icon: Lightbulb },
    { id: 'examples', label: 'Examples', icon: FileText },
    { id: 'flashcards', label: 'Flashcards', icon: Link },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">{node.data.label}</h2>
        <p className="text-gray-600">{node.data.description}</p>
        <div className="mt-2">
          <span className={`inline-block px-2 py-1 text-xs rounded-full ${
            node.data.type === 'topic' ? 'bg-blue-100 text-blue-800' :
            node.data.type === 'concept' ? 'bg-green-100 text-green-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {node.data.type}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {activeTab === 'theory' && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Theoretical Explanation</h3>
            <p className="text-gray-700 leading-relaxed">{details.theory}</p>
          </div>
        )}

        {activeTab === 'simplified' && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Simplified Explanation</h3>
            <p className="text-gray-700 leading-relaxed">{details.simplified}</p>
          </div>
        )}

        {activeTab === 'examples' && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Examples</h3>
            <ul className="space-y-2">
              {details.examples.map((example, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <p className="text-gray-700">{example}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'flashcards' && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Related Flashcards</h3>
            <div className="space-y-3">
              {details.flashcards.map((card, index) => (
                <div key={index} className="border rounded-lg p-4 bg-gray-50">
                  <div className="font-medium text-gray-900 mb-2">Q: {card.question}</div>
                  <div className="text-gray-700">A: {card.answer}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* References */}
      {details.references.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-2">Related Concepts</h3>
          <div className="flex flex-wrap gap-2">
            {details.references.map((ref, index) => (
              <span
                key={index}
                className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
              >
                {ref}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
