'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, ChevronLeft, ChevronRight, RotateCcw, Sparkles, Layers, Shuffle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FlashcardCanvasProps {
  content: string;
  isStreaming: boolean;
}

interface Flashcard {
  id: number;
  front: string;
  back: string;
  tags?: string[];
}

interface FlashcardData {
  title: string;
  description?: string;
  category?: string;
  cards: Flashcard[];
}

// Flashcard skeleton loader
const FlashcardSkeletonLoader: React.FC = () => (
  <div className="h-full w-full p-6 flex flex-col items-center justify-center">
    <div className="w-full max-w-lg">
      <div className="flex items-center gap-3 mb-6 justify-center">
        <div className="h-6 w-6 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" />
        <div className="h-5 w-48 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" />
      </div>
      <div className="aspect-[4/3] bg-[#2a2a2a] border-[3px] border-[#444444] animate-shimmer flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <div className="h-6 w-48 mx-auto rounded bg-muted-foreground/10 animate-shimmer" />
          <div className="h-4 w-64 mx-auto rounded bg-muted-foreground/10 animate-shimmer" style={{ animationDelay: '0.1s' }} />
        </div>
      </div>
    </div>
  </div>
);

function parseFlashcardData(content: string): FlashcardData | null {
  if (!content || content.trim() === '') return null;

  try {
    const data = JSON.parse(content);
    if (!data.cards || !Array.isArray(data.cards) || data.cards.length === 0) {
      return null;
    }
    return data as FlashcardData;
  } catch {
    return null;
  }
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const FlashcardCanvas: React.FC<FlashcardCanvasProps> = ({ content, isStreaming }) => {
  const flashcardData = useMemo(() => parseFlashcardData(content), [content]);

  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewedCards, setViewedCards] = useState<Set<number>>(new Set());
  const [showAllAnswers, setShowAllAnswers] = useState(false);

  // Initialize cards when data loads
  React.useEffect(() => {
    if (flashcardData && cards.length === 0) {
      setCards(flashcardData.cards);
    }
  }, [flashcardData, cards.length]);

  const currentCard = cards[currentCardIndex];

  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev);
    if (currentCard && !isFlipped) {
      setViewedCards(prev => new Set(prev).add(currentCard.id));
    }
  }, [currentCard, isFlipped]);

  const handleNext = useCallback(() => {
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  }, [currentCardIndex, cards.length]);

  const handlePrevious = useCallback(() => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
      setIsFlipped(false);
    }
  }, [currentCardIndex]);

  const handleShuffle = useCallback(() => {
    setCards(shuffleArray(cards));
    setCurrentCardIndex(0);
    setIsFlipped(false);
  }, [cards]);

  const handleRestart = useCallback(() => {
    if (flashcardData) {
      setCards(flashcardData.cards);
    }
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setViewedCards(new Set());
  }, [flashcardData]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault();
        handleFlip();
        break;
      case 'ArrowRight':
        handleNext();
        break;
      case 'ArrowLeft':
        handlePrevious();
        break;
    }
  }, [handleFlip, handleNext, handlePrevious]);

  const showSkeleton = isStreaming && !flashcardData;
  const showError = !isStreaming && !flashcardData && content;
  const showFlashcards = !!flashcardData && cards.length > 0;

  return (
    <div
      className="h-full w-full bg-card relative focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Skeleton Layer */}
      <div className={cn(
        "absolute inset-0 bg-card transition-opacity duration-150 z-10",
        showSkeleton ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <div className="flex items-center gap-2 px-6 pt-4 text-muted-foreground justify-center">
          <Sparkles className="h-4 w-4 animate-pulse text-amber-500" />
          <span className="text-sm animate-pulse">AI is generating flashcards...</span>
        </div>
        <FlashcardSkeletonLoader />
      </div>

      {/* Error Layer */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center p-6 transition-opacity duration-100",
        showError ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <div className="text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
          <div className="mb-2 text-red-400">Invalid flashcard data</div>
          <div className="text-xs max-w-md">
            Flashcard content must be valid JSON with a &quot;cards&quot; array.
          </div>
        </div>
      </div>

      {/* Flashcards Layer */}
      <div className={cn(
        "absolute inset-0 flex flex-col transition-opacity duration-100",
        showFlashcards ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        {flashcardData && currentCard && (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-[#5AC8FA]" />
                  <h2 className="font-semibold text-foreground">{flashcardData.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllAnswers(!showAllAnswers)}
                    className="gap-1 text-xs"
                  >
                    {showAllAnswers ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showAllAnswers ? 'Hide' : 'Show'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleShuffle}
                    className="gap-1 text-xs"
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                    Shuffle
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRestart}
                    className="gap-1 text-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                </div>
              </div>
              {/* Progress */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-[#444444] overflow-hidden border border-[#5AC8FA]">
                  <div
                    className="h-full bg-[#5AC8FA] transition-all duration-300"
                    style={{ width: `${((currentCardIndex + 1) / cards.length) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground">
                  {currentCardIndex + 1} / {cards.length}
                </span>
              </div>
            </div>

            {/* Card Area */}
            <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
              <div className="w-full max-w-lg perspective-1000">
                <div
                  onClick={handleFlip}
                  className={cn(
                    "relative aspect-[4/3] cursor-pointer transition-transform duration-500 transform-style-preserve-3d",
                    (isFlipped || showAllAnswers) && "rotate-y-180"
                  )}
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: (isFlipped || showAllAnswers) ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  {/* Front of Card - Pixel Art Style */}
                  <div
                    className={cn(
                      "absolute inset-0 p-6 flex flex-col items-center justify-center text-center",
                      "bg-[#2a2a2a]",
                      "border-[3px] border-[#444444]",
                      "shadow-[4px_4px_0_#444444]",
                      "font-mono",
                      "backface-hidden"
                    )}
                    style={{ backfaceVisibility: 'hidden', borderRadius: 0 }}
                  >
                    <div className="text-xs text-[#5AC8FA] uppercase tracking-wider mb-4 font-mono">
                      QUESTION / TERM
                    </div>
                    <div className="text-xl font-semibold text-foreground leading-relaxed">
                      {currentCard.front}
                    </div>
                    {currentCard.tags && currentCard.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4 justify-center">
                        {currentCard.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 text-xs bg-[#444444] text-[#5AC8FA] border border-[#5AC8FA] font-mono"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="absolute bottom-4 text-xs text-muted-foreground">
                      Click or press Space to flip
                    </div>
                  </div>

                  {/* Back of Card - Pixel Art Style */}
                  <div
                    className={cn(
                      "absolute inset-0 p-6 flex flex-col items-center justify-center text-center",
                      "bg-[#2a2a2a]",
                      "border-[3px] border-[#5AC8FA]",
                      "shadow-[4px_4px_0_#5AC8FA]",
                      "font-mono",
                      "backface-hidden rotate-y-180"
                    )}
                    style={{
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      borderRadius: 0,
                    }}
                  >
                    <div className="text-xs text-[#5AC8FA] uppercase tracking-wider mb-4 font-mono">
                      ANSWER / DEFINITION
                    </div>
                    <div className="text-lg text-foreground leading-relaxed">
                      {currentCard.back}
                    </div>
                    <div className="absolute bottom-4 text-xs text-muted-foreground">
                      Click or press Space to flip back
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentCardIndex === 0}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="text-sm text-muted-foreground">
                {viewedCards.size} of {cards.length} viewed
              </div>

              <Button
                onClick={handleNext}
                disabled={currentCardIndex === cards.length - 1}
                className="gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Keyboard hints */}
            <div className="px-4 pb-2 flex justify-center gap-4 text-xs text-muted-foreground">
              <span><kbd className="px-1.5 py-0.5 rounded bg-muted">Space</kbd> Flip</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-muted">&larr;</kbd> Previous</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-muted">&rarr;</kbd> Next</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
