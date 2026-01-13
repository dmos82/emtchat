'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface AdvancedSearchSuggestionProps {
  suggestion: {
    suggest: boolean;
    reason?: 'broad_query' | 'few_sources' | 'topic_mismatch';
  };
  onTryAdvancedSearch: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
}

const REASON_MESSAGES: Record<string, string> = {
  broad_query: 'Your query seems broad. Advanced Search can find more comprehensive results.',
  few_sources: 'Only a few sources were found. Advanced Search may uncover additional relevant documents.',
  topic_mismatch: 'The results may not fully cover your topic. Try Advanced Search for deeper analysis.',
};

export default function AdvancedSearchSuggestion({
  suggestion,
  onTryAdvancedSearch,
  onDismiss,
  isLoading = false,
}: AdvancedSearchSuggestionProps) {
  if (!suggestion.suggest) return null;

  const message = suggestion.reason
    ? REASON_MESSAGES[suggestion.reason]
    : 'Try Advanced Search for more comprehensive results.';

  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg mx-4 mb-2">
      <Search className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
      <p className="text-sm text-blue-800 dark:text-blue-200 flex-1">
        {message}
      </p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="default"
          size="sm"
          onClick={onTryAdvancedSearch}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isLoading ? 'Searching...' : 'Try Advanced Search'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
