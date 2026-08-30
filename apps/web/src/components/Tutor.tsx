'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Lightbulb, BookOpen, Target } from 'lucide-react';

interface UploadedFile {
  workspace_id: string;
  file_id: string;
  filename: string;
  topics: string[];
  sections: string[];
  concept_list: string[];
  raw_text: string;
  sources: Array<{ id: string; filename: string }>;
}

interface TutorProps {
  uploadedFile: UploadedFile;
}

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

interface TutorResponse {
  explanation: string;
  simplified: string;
  diagram_desc: string;
  practice: Array<{ question: string; answer: string }>;
  tips: string[];
  citations?: Array<{ index: number; filename: string; locator: string; excerpt: string }>;
}

export default function Tutor({ uploadedFile }: TutorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<TutorResponse | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Welcome message
    const welcomeMessage: Message = {
      id: '1',
      type: 'bot',
      content: `Your source-grounded tutor is ready. I can reason across ${uploadedFile.sources.length} source${uploadedFile.sources.length === 1 ? '' : 's'} and show the passages behind each answer.`,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, [uploadedFile]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: inputValue,
          content: uploadedFile.raw_text,
          workspace_id: uploadedFile.workspace_id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get tutor response');
      }

      const data: TutorResponse = await response.json();
      setCurrentResponse(data);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: data.explanation,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error getting tutor response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: 'Sorry, I encountered an error while processing your question. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedQuestions = [
    "What are the main concepts in this document?",
    "Can you explain this in simpler terms?",
    "What are some practical examples?",
    "How does this relate to other topics?",
  ];

  return (
    <div className="max-w-4xl mx-auto h-[600px] flex flex-col">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Tutor</h2>
        <p className="text-gray-600">Ask questions and get personalized explanations about your document</p>
      </div>

      <div className="flex-1 flex gap-6">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white border rounded-lg shadow-sm">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.type === 'bot' && <Bot className="h-5 w-5 mt-0.5 flex-shrink-0" />}
                    {message.type === 'user' && <User className="h-5 w-5 mt-0.5 flex-shrink-0" />}
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {messages.length === 1 && (
            <div className="p-4 border-t bg-gray-50">
              <p className="text-sm text-gray-600 mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => setInputValue(question)}
                    className="text-sm px-3 py-1 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a question about your document..."
                className="flex-1 resize-none border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={2}
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Response Details Panel */}
        {currentResponse && (
          <div className="w-80 bg-white border rounded-lg shadow-sm p-4 space-y-4">
            <h3 className="font-semibold text-gray-900">Additional Details</h3>

            {/* Simplified Explanation */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <span className="font-medium text-sm">Simplified</span>
              </div>
              <p className="text-sm text-gray-700">{currentResponse.simplified}</p>
            </div>

            {/* Diagram Description */}
            {currentResponse.diagram_desc && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-sm">Visual Aid</span>
                </div>
                <p className="text-sm text-gray-700">{currentResponse.diagram_desc}</p>
              </div>
            )}

            {/* Practice Questions */}
            {currentResponse.practice.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-sm">Practice</span>
                </div>
                <div className="space-y-2">
                  {currentResponse.practice.map((item, index) => (
                    <div key={index} className="text-sm">
                      <div className="font-medium text-gray-900">Q: {item.question}</div>
                      <div className="text-gray-600 ml-2">A: {item.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tips */}
            {currentResponse.tips.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-purple-500" />
                  <span className="font-medium text-sm">Tips</span>
                </div>
                <ul className="text-sm text-gray-700 space-y-1">
                  {currentResponse.tips.map((tip, index) => (
                    <li key={index} className="flex items-start gap-1">
                      <span className="text-purple-500 mt-1">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {currentResponse.citations && currentResponse.citations.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2"><BookOpen className="h-4 w-4 text-indigo-500" /><span className="text-sm font-medium">Sources</span></div>
                <div className="space-y-2">
                  {currentResponse.citations.map((citation) => (
                    <div key={`${citation.filename}-${citation.index}`} className="rounded-md border bg-indigo-50 p-2 text-xs text-gray-700">
                      <div className="font-semibold text-indigo-700">[{citation.index}] {citation.filename} · {citation.locator}</div>
                      <p className="mt-1 line-clamp-3">{citation.excerpt}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
