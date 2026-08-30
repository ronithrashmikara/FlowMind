'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

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

interface FileUploadProps {
  onFileUploaded: (file: UploadedFile) => void;
  darkMode?: boolean;
  workspaceId?: string;
}

export default function FileUpload({ onFileUploaded, workspaceId, darkMode = false }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadStatus('idle');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (workspaceId) formData.append('workspace_id', workspaceId);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setUploadStatus('success');
      onFileUploaded(result);
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className={`text-2xl font-bold mb-2 ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}>Upload Your Document</h2>
        <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
          Upload a PDF, Word document, or text file to get started
        </p>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? darkMode
              ? 'border-indigo-400 bg-indigo-900/20'
              : 'border-indigo-500 bg-indigo-50'
            : darkMode
              ? 'border-gray-600 hover:border-gray-500'
              : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mb-4" />
            <p className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Processing your file...</p>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>This may take a few moments</p>
          </div>
        ) : uploadStatus === 'success' ? (
          <div className="flex flex-col items-center">
            <CheckCircle className="h-12 w-12 text-green-600 mb-4" />
            <p className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>File uploaded successfully!</p>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>You can now explore the knowledge tree and other features</p>
            <button onClick={() => setUploadStatus('idle')} className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
              Add another source
            </button>
          </div>
        ) : uploadStatus === 'error' ? (
          <div className="flex flex-col items-center">
            <AlertCircle className="h-12 w-12 text-red-600 mb-4" />
            <p className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Upload failed</p>
            <p className="text-sm text-red-600">{errorMessage}</p>
            <button
              onClick={() => setUploadStatus('idle')}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className={`h-12 w-12 mb-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            <p className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Drag and drop your file here
            </p>
            <p className={`text-sm mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>or</p>
            <label className="cursor-pointer">
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt"
                onChange={handleFileSelect}
              />
              <span className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
                <FileText className="h-4 w-4" />
                Choose File
              </span>
            </label>
            <p className={`text-xs mt-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Supported formats: PDF, PowerPoint, Word, Markdown, and Text · up to 25 MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
