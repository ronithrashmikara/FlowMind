'use client';

import { useState, useEffect } from 'react';
import { RotateCcw, Shuffle, Filter, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface UploadedFile {
  workspace_id: string;
  file_id: string;
  filename: string;
  topics: string[];
  sections: string[];
  concept_list: string[];
  raw_text: string;
}

interface FlashcardsProps {
  uploadedFile: UploadedFile;
}

interface Flashcard {
  question: string;
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tag: string;
}

export default function Flashcards({ uploadedFile }: FlashcardsProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');

  const generateFlashcards = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/generate/flashcards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: uploadedFile.raw_text,
          concepts: uploadedFile.concept_list,
          workspace_id: uploadedFile.workspace_id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate flashcards');
      }

      const data = await response.json();
      setFlashcards(data);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (error) {
      console.error('Error generating flashcards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateFlashcards();
  }, [uploadedFile]);

  const filteredFlashcards = flashcards.filter(card => 
    filter === 'all' || card.difficulty === filter
  );

  const shuffleCards = () => {
    const shuffled = [...filteredFlashcards].sort(() => Math.random() - 0.5);
    setFlashcards(prev => {
      const newCards = [...prev];
      shuffled.forEach((card, index) => {
        const originalIndex = prev.findIndex(c => c.question === card.question);
        if (originalIndex !== -1) {
          newCards[originalIndex] = card;
        }
      });
      return newCards;
    });
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const nextCard = () => {
    setCurrentIndex((prev) => (prev + 1) % filteredFlashcards.length);
    setIsFlipped(false);
  };

  const prevCard = () => {
    setCurrentIndex((prev) => (prev - 1 + filteredFlashcards.length) % filteredFlashcards.length);
    setIsFlipped(false);
  };

  const flipCard = () => {
    setIsFlipped(!isFlipped);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900">Generating Flashcards...</p>
          <p className="text-sm text-gray-600">This may take a few moments</p>
        </div>
      </div>
    );
  }

  if (filteredFlashcards.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No flashcards available for the selected filter</p>
        <button
          onClick={generateFlashcards}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          Generate Flashcards
        </button>
      </div>
    );
  }

  const currentCard = filteredFlashcards[currentIndex];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Flashcards</h2>
        <p className="text-gray-600">Study with AI-generated flashcards from your document</p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={shuffleCards}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            <Shuffle className="h-4 w-4" />
            Shuffle
          </button>
          
          <button
            onClick={generateFlashcards}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Regenerate
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as any);
              setCurrentIndex(0);
              setIsFlipped(false);
            }}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Card Counter */}
      <div className="text-center mb-4">
        <span className="text-sm text-gray-600">
          {currentIndex + 1} of {filteredFlashcards.length}
        </span>
      </div>

      {/* Flashcard */}
      <div className="relative mb-6">
        <div
          className={`w-full h-64 bg-white border-2 border-gray-200 rounded-lg shadow-lg cursor-pointer transition-transform duration-300 ${
            isFlipped ? 'transform rotateY-180' : ''
          }`}
          onClick={flipCard}
        >
          <div className="absolute inset-0 flex items-center justify-center p-6">
            {!isFlipped ? (
              <div className="text-center">
                <div className="text-lg font-medium text-gray-900 mb-4">
                  {currentCard.question}
                </div>
                <div className="text-sm text-gray-500">Click to reveal answer</div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-lg text-gray-700 mb-4">
                  {currentCard.answer}
                </div>
                <div className="text-sm text-gray-500">Click to see question</div>
              </div>
            )}
          </div>
        </div>

        {/* Difficulty Badge */}
        <div className="absolute top-4 right-4">
          <span className={`px-2 py-1 text-xs rounded-full ${
            currentCard.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
            currentCard.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {currentCard.difficulty}
          </span>
        </div>

        {/* Tag */}
        <div className="absolute bottom-4 left-4">
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
            {currentCard.tag}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevCard}
          disabled={filteredFlashcards.length <= 1}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>

        <button
          onClick={flipCard}
          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
        >
          {isFlipped ? 'Show Question' : 'Show Answer'}
        </button>

        <button
          onClick={nextCard}
          disabled={filteredFlashcards.length <= 1}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mt-6">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / filteredFlashcards.length) * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
