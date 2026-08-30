'use client';

import { useState } from 'react';
import { Upload, FileText, Brain, MessageSquare, BookOpen, Moon, Sun } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import KnowledgeTree from '@/components/KnowledgeTree';
import Summaries from '@/components/Summaries';
import Flashcards from '@/components/Flashcards';
import Tutor from '@/components/Tutor';

interface UploadedFile {
  workspace_id: string;
  file_id: string;
  filename: string;
  topics: string[];
  sections: string[];
  concept_list: string[];
  raw_text: string;
  sources: Array<{ id: string; filename: string; file_type: string; word_count: number }>;
}

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'tree' | 'summaries' | 'flashcards' | 'tutor'>('upload');
  const [darkMode, setDarkMode] = useState(false);

  const tabs = [
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'tree', label: 'Knowledge Tree', icon: Brain },
    { id: 'summaries', label: 'Summaries', icon: FileText },
    { id: 'flashcards', label: 'Flashcards', icon: BookOpen },
    { id: 'tutor', label: 'AI Tutor', icon: MessageSquare },
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 to-gray-800' 
        : 'bg-gradient-to-br from-blue-50 to-indigo-100'
    }`}>
      {/* Dark Mode Toggle */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className={`fixed top-4 left-4 p-2 rounded-lg transition-colors z-50 ${
          darkMode 
            ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
        }`}
        title="Toggle Dark Mode"
      >
        {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <h1 className={`text-4xl font-bold ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>Flow Mind</h1>
          </div>
          <p className={`text-lg ${
            darkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Transform your documents into interactive knowledge trees, summaries, flashcards, and more
          </p>
          {uploadedFile && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {uploadedFile.sources.map((source) => (
                <span key={source.id} className="rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                  {source.filename} · {source.word_count.toLocaleString()} words
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className={`rounded-lg shadow-md p-1 flex space-x-1 ${
            darkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  disabled={tab.id !== 'upload' && !uploadedFile}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                    activeTab === tab.id
                      ? darkMode
                        ? 'bg-indigo-500 text-white'
                        : 'bg-indigo-600 text-white'
                      : uploadedFile || tab.id === 'upload'
                      ? darkMode
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-100'
                      : darkMode
                        ? 'text-gray-500 cursor-not-allowed'
                        : 'text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className={`rounded-lg shadow-lg p-6 ${
          darkMode ? 'bg-gray-800' : 'bg-white'
        }`}>
          {activeTab === 'upload' && (
            <FileUpload onFileUploaded={setUploadedFile} workspaceId={uploadedFile?.workspace_id} darkMode={darkMode} />
          )}
          
          {activeTab === 'tree' && uploadedFile && (
            <KnowledgeTree uploadedFile={uploadedFile} />
          )}
          
          {activeTab === 'summaries' && uploadedFile && (
            <Summaries uploadedFile={uploadedFile} />
          )}
          
          {activeTab === 'flashcards' && uploadedFile && (
            <Flashcards uploadedFile={uploadedFile} />
          )}
          
          {activeTab === 'tutor' && uploadedFile && (
            <Tutor uploadedFile={uploadedFile} />
          )}
        </div>
      </div>
    </div>
  );
}
