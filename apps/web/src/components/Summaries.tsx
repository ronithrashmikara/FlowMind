'use client';

import { useState } from 'react';
import { FileText, Loader2, Download } from 'lucide-react';

interface UploadedFile {
  workspace_id: string;
  file_id: string;
  filename: string;
  topics: string[];
  sections: string[];
  concept_list: string[];
  raw_text: string;
}

interface SummariesProps {
  uploadedFile: UploadedFile;
}

type SummaryType = 'one_page' | 'five_page' | 'chapters';

interface Summary {
  one_page?: string;
  five_page?: string;
  chapters?: Array<{ title: string; content: string }>;
}

export default function Summaries({ uploadedFile }: SummariesProps) {
  const [selectedType, setSelectedType] = useState<SummaryType>('one_page');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const summaryTypes = [
    { id: 'one_page', label: '1-Page Summary', description: 'Concise overview of key points' },
    { id: 'five_page', label: '5-Page Summary', description: 'Detailed comprehensive summary' },
    { id: 'chapters', label: 'Chapter Summaries', description: 'Broken down by sections' },
  ];

  const generateSummary = async (type: SummaryType) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/generate/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: uploadedFile.raw_text,
          type: type,
          workspace_id: uploadedFile.workspace_id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeChange = (type: SummaryType) => {
    setSelectedType(type);
    setSummary(null);
  };

  const downloadSummary = () => {
    if (!summary) return;

    let content = '';
    if (summary.one_page) {
      content = summary.one_page;
    } else if (summary.five_page) {
      content = summary.five_page;
    } else if (summary.chapters) {
      content = summary.chapters.map(ch => `${ch.title}\n\n${ch.content}`).join('\n\n---\n\n');
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${uploadedFile.filename}-${selectedType}-summary.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Document Summaries</h2>
        <p className="text-gray-600">Generate different types of summaries from your document</p>
      </div>

      {/* Summary Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {summaryTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => handleTypeChange(type.id as SummaryType)}
            className={`p-4 border rounded-lg text-left transition-colors ${
              selectedType === type.id
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <h3 className="font-semibold text-gray-900 mb-1">{type.label}</h3>
            <p className="text-sm text-gray-600">{type.description}</p>
          </button>
        ))}
      </div>

      {/* Generate Button */}
      <div className="mb-6">
        <button
          onClick={() => generateSummary(selectedType)}
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {isLoading ? 'Generating...' : `Generate ${summaryTypes.find(t => t.id === selectedType)?.label}`}
        </button>
      </div>

      {/* Summary Display */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900">Generating summary...</p>
            <p className="text-sm text-gray-600">This may take a few moments</p>
          </div>
        </div>
      )}

      {summary && !isLoading && (
        <div className="bg-white border rounded-lg shadow-sm">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              {summaryTypes.find(t => t.id === selectedType)?.label}
            </h3>
            <button
              onClick={downloadSummary}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
          </div>

          <div className="p-6">
            {summary.one_page && (
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {summary.one_page}
                </div>
              </div>
            )}

            {summary.five_page && (
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {summary.five_page}
                </div>
              </div>
            )}

            {summary.chapters && (
              <div className="space-y-6">
                {summary.chapters.map((chapter, index) => (
                  <div key={index} className="border-l-4 border-indigo-500 pl-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      {chapter.title}
                    </h4>
                    <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                      {chapter.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
