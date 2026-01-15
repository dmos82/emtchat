'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, XCircle, ChevronLeft, ChevronRight, RotateCcw, Trophy, Sparkles, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuizCanvasProps {
  content: string;
  isStreaming: boolean;
}

interface QuizQuestion {
  id: number;
  type: 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer';
  question: string;
  options?: string[];
  correctAnswer: number | boolean | string | string[];
  explanation?: string;
  sampleAnswer?: string;
  keywords?: string[];
}

interface QuizData {
  title: string;
  description?: string;
  passingScore?: number;
  questions: QuizQuestion[];
}

interface UserAnswer {
  questionId: number;
  answer: number | boolean | string;
  isCorrect: boolean;
}

// Quiz skeleton loader
const QuizSkeletonLoader: React.FC = () => (
  <div className="h-full w-full p-6 flex flex-col">
    <div className="flex items-center gap-3 mb-6">
      <div className="h-6 w-6 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" />
      <div className="h-5 w-48 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" />
    </div>
    <div className="flex-1 space-y-4">
      <div className="h-4 w-3/4 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div className="h-5 w-5 rounded-full bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" />
          <div className="h-4 flex-1 rounded bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer" style={{ animationDelay: `${i * 0.1}s` }} />
        </div>
      ))}
    </div>
  </div>
);

function parseQuizData(content: string): QuizData | null {
  if (!content || content.trim() === '') return null;

  try {
    const data = JSON.parse(content);
    if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
      return null;
    }
    return data as QuizData;
  } catch {
    return null;
  }
}

function checkAnswer(question: QuizQuestion, userAnswer: number | boolean | string): boolean {
  switch (question.type) {
    case 'multiple_choice':
      return userAnswer === question.correctAnswer;
    case 'true_false':
      return userAnswer === question.correctAnswer;
    case 'fill_blank':
      if (Array.isArray(question.correctAnswer)) {
        const answers = question.correctAnswer.map(a => a.toLowerCase().trim());
        const userAnswerLower = String(userAnswer).toLowerCase().trim();
        return answers.some(a => userAnswerLower.includes(a));
      }
      return String(userAnswer).toLowerCase().trim() === String(question.correctAnswer).toLowerCase().trim();
    case 'short_answer':
      if (question.keywords) {
        const userAnswerLower = String(userAnswer).toLowerCase();
        const matchedKeywords = question.keywords.filter(kw => userAnswerLower.includes(kw.toLowerCase()));
        return matchedKeywords.length >= 2; // At least 2 keywords must match
      }
      return true; // Short answer without keywords is always "correct" (subjective)
    default:
      return false;
  }
}

export const QuizCanvas: React.FC<QuizCanvasProps> = ({ content, isStreaming }) => {
  const quizData = useMemo(() => parseQuizData(content), [content]);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | boolean | string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [fillBlankAnswer, setFillBlankAnswer] = useState('');
  const [shortAnswer, setShortAnswer] = useState('');

  const currentQuestion = quizData?.questions[currentQuestionIndex];
  const isAnswered = userAnswers.some(a => a.questionId === currentQuestion?.id);
  const currentUserAnswer = userAnswers.find(a => a.questionId === currentQuestion?.id);

  const handleSelectAnswer = useCallback((answer: number | boolean | string) => {
    if (isAnswered) return;
    setSelectedAnswer(answer);
  }, [isAnswered]);

  const handleSubmitAnswer = useCallback(() => {
    if (!currentQuestion || selectedAnswer === null) return;

    const isCorrect = checkAnswer(currentQuestion, selectedAnswer);
    setUserAnswers(prev => [...prev, {
      questionId: currentQuestion.id,
      answer: selectedAnswer,
      isCorrect,
    }]);
    setShowExplanation(true);
  }, [currentQuestion, selectedAnswer]);

  const handleSubmitFillBlank = useCallback(() => {
    if (!currentQuestion || !fillBlankAnswer.trim()) return;

    const isCorrect = checkAnswer(currentQuestion, fillBlankAnswer);
    setUserAnswers(prev => [...prev, {
      questionId: currentQuestion.id,
      answer: fillBlankAnswer,
      isCorrect,
    }]);
    setShowExplanation(true);
  }, [currentQuestion, fillBlankAnswer]);

  const handleSubmitShortAnswer = useCallback(() => {
    if (!currentQuestion || !shortAnswer.trim()) return;

    const isCorrect = checkAnswer(currentQuestion, shortAnswer);
    setUserAnswers(prev => [...prev, {
      questionId: currentQuestion.id,
      answer: shortAnswer,
      isCorrect,
    }]);
    setShowExplanation(true);
  }, [currentQuestion, shortAnswer]);

  const handleNext = useCallback(() => {
    if (!quizData) return;

    if (currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setFillBlankAnswer('');
      setShortAnswer('');
    } else {
      setQuizCompleted(true);
    }
  }, [currentQuestionIndex, quizData]);

  const handlePrevious = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setFillBlankAnswer('');
      setShortAnswer('');
    }
  }, [currentQuestionIndex]);

  const handleRestart = useCallback(() => {
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setQuizCompleted(false);
    setFillBlankAnswer('');
    setShortAnswer('');
  }, []);

  const score = useMemo(() => {
    if (!quizData || userAnswers.length === 0) return 0;
    const correctCount = userAnswers.filter(a => a.isCorrect).length;
    return Math.round((correctCount / quizData.questions.length) * 100);
  }, [quizData, userAnswers]);

  const showSkeleton = isStreaming && !quizData;
  const showError = !isStreaming && !quizData && content;
  const showQuiz = !!quizData;

  // Results view
  if (quizCompleted && quizData) {
    const passingScore = quizData.passingScore || 70;
    const passed = score >= passingScore;

    return (
      <div className="h-full w-full bg-card p-6 overflow-auto">
        <div className="max-w-2xl mx-auto text-center">
          <div className={cn(
            "inline-flex items-center justify-center w-20 h-20 rounded-full mb-6",
            passed ? "bg-green-500/20" : "bg-red-500/20"
          )}>
            <Trophy className={cn("h-10 w-10", passed ? "text-green-500" : "text-red-500")} />
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-2">
            {passed ? 'Congratulations!' : 'Keep Practicing!'}
          </h2>

          <p className="text-muted-foreground mb-6">
            {passed
              ? `You passed with a score of ${score}%!`
              : `You scored ${score}%. You need ${passingScore}% to pass.`
            }
          </p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-muted rounded-lg p-4">
              <div className="text-2xl font-bold text-foreground">{quizData.questions.length}</div>
              <div className="text-sm text-muted-foreground">Questions</div>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <div className="text-2xl font-bold text-green-500">
                {userAnswers.filter(a => a.isCorrect).length}
              </div>
              <div className="text-sm text-muted-foreground">Correct</div>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <div className="text-2xl font-bold text-red-500">
                {userAnswers.filter(a => !a.isCorrect).length}
              </div>
              <div className="text-sm text-muted-foreground">Incorrect</div>
            </div>
          </div>

          <Button onClick={handleRestart} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-card relative">
      {/* Skeleton Layer */}
      <div className={cn(
        "absolute inset-0 bg-card transition-opacity duration-150 z-10",
        showSkeleton ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <div className="flex items-center gap-2 px-6 pt-4 text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse text-amber-500" />
          <span className="text-sm animate-pulse">AI is generating quiz...</span>
        </div>
        <QuizSkeletonLoader />
      </div>

      {/* Error Layer */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center p-6 transition-opacity duration-100",
        showError ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <div className="text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
          <div className="mb-2 text-red-400">Invalid quiz data</div>
          <div className="text-xs max-w-md">
            Quiz content must be valid JSON with a &quot;questions&quot; array.
          </div>
        </div>
      </div>

      {/* Quiz Layer */}
      <div className={cn(
        "absolute inset-0 flex flex-col transition-opacity duration-100",
        showQuiz ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        {quizData && currentQuestion && (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-blue-500" />
                  <h2 className="font-semibold text-foreground">{quizData.title}</h2>
                </div>
                <div className="text-sm text-muted-foreground">
                  Question {currentQuestionIndex + 1} of {quizData.questions.length}
                </div>
              </div>
              {/* Progress bar - Pixel Art Style */}
              <div className="h-3 bg-[#444444] overflow-hidden border border-[#5AC8FA]">
                <div
                  className="h-full bg-[#5AC8FA] transition-all duration-300"
                  style={{ width: `${((currentQuestionIndex + 1) / quizData.questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Question Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl mx-auto">
                <p className="text-lg font-medium text-foreground mb-6">
                  {currentQuestion.question}
                </p>

                {/* Multiple Choice */}
                {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
                  <div className="space-y-3">
                    {currentQuestion.options.map((option, index) => {
                      const isSelected = selectedAnswer === index || currentUserAnswer?.answer === index;
                      const isCorrectAnswer = index === currentQuestion.correctAnswer;
                      const showResult = showExplanation && isAnswered;

                      return (
                        <button
                          key={index}
                          onClick={() => handleSelectAnswer(index)}
                          disabled={isAnswered}
                          className={cn(
                            "w-full text-left p-4 border-[3px] transition-all font-mono",
                            !showResult && !isSelected && "border-[#444444] bg-[#2a2a2a] hover:border-[#5AC8FA] hover:shadow-[4px_4px_0_#5AC8FA]",
                            !showResult && isSelected && "border-[#5AC8FA] bg-[#2a2a2a] shadow-[4px_4px_0_#5AC8FA]",
                            showResult && isCorrectAnswer && "border-green-500 bg-[#2a2a2a] shadow-[4px_4px_0_#22c55e]",
                            showResult && isSelected && !isCorrectAnswer && "border-red-500 bg-[#2a2a2a] shadow-[4px_4px_0_#ef4444]",
                            isAnswered && !isSelected && !isCorrectAnswer && "opacity-50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-medium",
                              !showResult && !isSelected && "border-muted-foreground text-muted-foreground",
                              !showResult && isSelected && "border-blue-500 text-blue-500 bg-blue-500/20",
                              showResult && isCorrectAnswer && "border-green-500 text-green-500 bg-green-500/20",
                              showResult && isSelected && !isCorrectAnswer && "border-red-500 text-red-500 bg-red-500/20"
                            )}>
                              {showResult && isCorrectAnswer && <CheckCircle2 className="h-4 w-4" />}
                              {showResult && isSelected && !isCorrectAnswer && <XCircle className="h-4 w-4" />}
                              {!showResult && String.fromCharCode(65 + index)}
                            </div>
                            <span className="text-foreground">{option}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* True/False */}
                {currentQuestion.type === 'true_false' && (
                  <div className="flex gap-4">
                    {[true, false].map((value) => {
                      const isSelected = selectedAnswer === value || currentUserAnswer?.answer === value;
                      const isCorrectAnswer = value === currentQuestion.correctAnswer;
                      const showResult = showExplanation && isAnswered;

                      return (
                        <button
                          key={String(value)}
                          onClick={() => handleSelectAnswer(value)}
                          disabled={isAnswered}
                          className={cn(
                            "flex-1 p-4 border-[3px] transition-all font-mono font-medium",
                            !showResult && !isSelected && "border-[#444444] bg-[#2a2a2a] hover:border-[#5AC8FA] hover:shadow-[4px_4px_0_#5AC8FA]",
                            !showResult && isSelected && "border-[#5AC8FA] bg-[#2a2a2a] shadow-[4px_4px_0_#5AC8FA]",
                            showResult && isCorrectAnswer && "border-green-500 bg-[#2a2a2a] shadow-[4px_4px_0_#22c55e]",
                            showResult && isSelected && !isCorrectAnswer && "border-red-500 bg-[#2a2a2a] shadow-[4px_4px_0_#ef4444]"
                          )}
                        >
                          {value ? 'True' : 'False'}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Fill in the Blank */}
                {currentQuestion.type === 'fill_blank' && (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={isAnswered ? String(currentUserAnswer?.answer || '') : fillBlankAnswer}
                      onChange={(e) => setFillBlankAnswer(e.target.value)}
                      disabled={isAnswered}
                      placeholder="Type your answer..."
                      className={cn(
                        "w-full p-4 border-[3px] bg-[#2a2a2a] text-foreground font-mono",
                        !isAnswered && "border-[#444444] focus:border-[#5AC8FA] focus:shadow-[4px_4px_0_#5AC8FA] focus:outline-none",
                        isAnswered && currentUserAnswer?.isCorrect && "border-green-500 shadow-[4px_4px_0_#22c55e]",
                        isAnswered && !currentUserAnswer?.isCorrect && "border-red-500 shadow-[4px_4px_0_#ef4444]"
                      )}
                    />
                    {!isAnswered && (
                      <Button onClick={handleSubmitFillBlank} disabled={!fillBlankAnswer.trim()}>
                        Submit Answer
                      </Button>
                    )}
                  </div>
                )}

                {/* Short Answer */}
                {currentQuestion.type === 'short_answer' && (
                  <div className="space-y-4">
                    <textarea
                      value={isAnswered ? String(currentUserAnswer?.answer || '') : shortAnswer}
                      onChange={(e) => setShortAnswer(e.target.value)}
                      disabled={isAnswered}
                      placeholder="Type your answer..."
                      rows={4}
                      className={cn(
                        "w-full p-4 border-[3px] bg-[#2a2a2a] text-foreground resize-none font-mono",
                        !isAnswered && "border-[#444444] focus:border-[#5AC8FA] focus:shadow-[4px_4px_0_#5AC8FA] focus:outline-none",
                        isAnswered && currentUserAnswer?.isCorrect && "border-green-500 shadow-[4px_4px_0_#22c55e]",
                        isAnswered && !currentUserAnswer?.isCorrect && "border-yellow-500 shadow-[4px_4px_0_#eab308]"
                      )}
                    />
                    {!isAnswered && (
                      <Button onClick={handleSubmitShortAnswer} disabled={!shortAnswer.trim()}>
                        Submit Answer
                      </Button>
                    )}
                  </div>
                )}

                {/* Submit button for multiple choice and true/false */}
                {!isAnswered && (currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'true_false') && (
                  <div className="mt-6">
                    <Button onClick={handleSubmitAnswer} disabled={selectedAnswer === null}>
                      Submit Answer
                    </Button>
                  </div>
                )}

                {/* Explanation */}
                {showExplanation && currentQuestion.explanation && (
                  <div className={cn(
                    "mt-6 p-4 rounded-lg border-l-4",
                    currentUserAnswer?.isCorrect
                      ? "bg-green-500/10 border-green-500"
                      : "bg-yellow-500/10 border-yellow-500"
                  )}>
                    <div className="flex items-start gap-2">
                      {currentUserAnswer?.isCorrect
                        ? <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        : <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      }
                      <div>
                        <div className="font-medium text-foreground mb-1">
                          {currentUserAnswer?.isCorrect ? 'Correct!' : 'Explanation'}
                        </div>
                        <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                        {currentQuestion.type === 'short_answer' && currentQuestion.sampleAnswer && (
                          <p className="text-sm text-muted-foreground mt-2">
                            <strong>Sample answer:</strong> {currentQuestion.sampleAnswer}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="text-sm text-muted-foreground">
                Score: {userAnswers.filter(a => a.isCorrect).length}/{userAnswers.length} correct
              </div>

              <Button
                onClick={handleNext}
                disabled={!isAnswered}
                className="gap-2"
              >
                {currentQuestionIndex === quizData.questions.length - 1 ? 'Finish' : 'Next'}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
