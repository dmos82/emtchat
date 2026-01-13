'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface FeedbackButtonsProps {
  messageId: string;
  messageContent: string;
  userQuery: string;
  searchMode: string;
  ragSources?: string[];
  conversationId?: string;
  onDislikeClick?: () => void;  // Opens detailed feedback modal
}

type VoteType = 'like' | 'dislike' | null;

export const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({
  messageId,
  messageContent,
  userQuery,
  searchMode,
  ragSources = [],
  conversationId,
  onDislikeClick,
}) => {
  const [currentVote, setCurrentVote] = useState<VoteType>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Fetch existing vote on mount
  useEffect(() => {
    const fetchVote = async () => {
      try {
        const response = await fetchWithAuth(`/api/feedback/vote/${messageId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.vote) {
            setCurrentVote(data.vote.voteType);
          }
        }
      } catch (error) {
        console.error('[FeedbackButtons] Error fetching vote:', error);
      } finally {
        setHasLoaded(true);
      }
    };

    fetchVote();
  }, [messageId]);

  const handleVote = useCallback(async (voteType: 'like' | 'dislike') => {
    if (isLoading) return;

    // If clicking the same vote, remove it
    const isRemoving = currentVote === voteType;
    const newVote = isRemoving ? null : voteType;

    // Optimistic update
    const previousVote = currentVote;
    setCurrentVote(newVote);
    setIsLoading(true);

    try {
      if (isRemoving) {
        // Remove vote
        const response = await fetchWithAuth(`/api/feedback/vote/${messageId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          throw new Error('Failed to remove vote');
        }
      } else {
        // Submit vote
        const response = await fetchWithAuth(`/api/feedback/vote/${messageId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voteType,
            messageContent,
            userQuery,
            searchMode,
            ragSources,
            conversationId,
          }),
        });
        if (!response.ok) {
          throw new Error('Failed to submit vote');
        }

        // If dislike, trigger modal for detailed feedback
        if (voteType === 'dislike' && onDislikeClick) {
          onDislikeClick();
        }
      }
    } catch (error) {
      console.error('[FeedbackButtons] Error handling vote:', error);
      // Revert on error
      setCurrentVote(previousVote);
    } finally {
      setIsLoading(false);
    }
  }, [currentVote, isLoading, messageId, messageContent, userQuery, searchMode, ragSources, conversationId, onDislikeClick]);

  // Don't render until we've checked for existing vote
  if (!hasLoaded) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <button
        onClick={() => handleVote('like')}
        disabled={isLoading}
        className={cn(
          'p-1.5 rounded-md transition-all duration-150',
          'hover:bg-green-100 dark:hover:bg-green-900/30',
          'focus:outline-none focus:ring-2 focus:ring-green-500/50',
          currentVote === 'like' && 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
          currentVote !== 'like' && 'text-gray-400 hover:text-green-600 dark:hover:text-green-400',
          isLoading && 'opacity-50 cursor-not-allowed'
        )}
        title="Like this response"
        aria-label="Like this response"
        aria-pressed={currentVote === 'like'}
      >
        <ThumbsUp size={14} strokeWidth={currentVote === 'like' ? 2.5 : 2} />
      </button>
      <button
        onClick={() => handleVote('dislike')}
        disabled={isLoading}
        className={cn(
          'p-1.5 rounded-md transition-all duration-150',
          'hover:bg-red-100 dark:hover:bg-red-900/30',
          'focus:outline-none focus:ring-2 focus:ring-red-500/50',
          currentVote === 'dislike' && 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
          currentVote !== 'dislike' && 'text-gray-400 hover:text-red-600 dark:hover:text-red-400',
          isLoading && 'opacity-50 cursor-not-allowed'
        )}
        title="Dislike this response"
        aria-label="Dislike this response"
        aria-pressed={currentVote === 'dislike'}
      >
        <ThumbsDown size={14} strokeWidth={currentVote === 'dislike' ? 2.5 : 2} />
      </button>
    </div>
  );
};

export default FeedbackButtons;
