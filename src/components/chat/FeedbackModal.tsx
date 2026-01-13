'use client';

import React, { useState } from 'react';
import { X, Send, AlertCircle, HelpCircle, Crosshair, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  messageContent: string;
  userQuery: string;
  searchMode: string;
  ragSources?: string[];
  conversationId?: string;
}

type DislikeReason = 'inaccurate' | 'not_helpful' | 'off_topic' | 'other';

const REASON_OPTIONS: { value: DislikeReason; label: string; icon: React.ReactNode }[] = [
  { value: 'inaccurate', label: 'Inaccurate', icon: <AlertCircle size={16} /> },
  { value: 'not_helpful', label: 'Not helpful', icon: <HelpCircle size={16} /> },
  { value: 'off_topic', label: 'Off-topic', icon: <Crosshair size={16} /> },
  { value: 'other', label: 'Other', icon: <MoreHorizontal size={16} /> },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  messageId,
  messageContent,
  userQuery,
  searchMode,
  ragSources = [],
  conversationId,
}) => {
  const [selectedReasons, setSelectedReasons] = useState<DislikeReason[]>([]);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleReasonToggle = (reason: DislikeReason) => {
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetchWithAuth(`/api/feedback/vote/${messageId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voteType: 'dislike',
          reasons: selectedReasons,
          comment: comment.trim() || undefined,
          messageContent,
          userQuery,
          searchMode,
          ragSources,
          conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setSubmitStatus('success');
      setTimeout(() => {
        onClose();
        // Reset state
        setSelectedReasons([]);
        setComment('');
        setSubmitStatus('idle');
      }, 1000);
    } catch (error) {
      console.error('[FeedbackModal] Error submitting:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onClose();
    setSelectedReasons([]);
    setComment('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            What went wrong?
          </h3>
          <button
            onClick={handleSkip}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Reason checkboxes */}
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select all that apply (optional):
            </p>
            <div className="grid grid-cols-2 gap-2">
              {REASON_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleReasonToggle(option.value)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md border transition-colors text-sm',
                    selectedReasons.includes(option.value)
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                  )}
                >
                  {option.icon}
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Comment textarea */}
          <div className="space-y-2">
            <label
              htmlFor="feedback-comment"
              className="text-sm text-gray-600 dark:text-gray-400"
            >
              Additional details (optional):
            </label>
            <textarea
              id="feedback-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us more about what could be improved..."
              className={cn(
                'w-full px-3 py-2 rounded-md border text-sm resize-none',
                'border-gray-200 dark:border-gray-600',
                'bg-white dark:bg-gray-700',
                'text-gray-900 dark:text-gray-100',
                'placeholder-gray-400 dark:placeholder-gray-500',
                'focus:outline-none focus:ring-2 focus:ring-blue-500/50'
              )}
              rows={3}
              maxLength={1000}
            />
            <p className="text-xs text-gray-400 text-right">
              {comment.length}/1000
            </p>
          </div>

          {/* Status message */}
          {submitStatus === 'success' && (
            <p className="text-sm text-green-600 dark:text-green-400 text-center">
              Thanks for your feedback!
            </p>
          )}
          {submitStatus === 'error' && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">
              Failed to submit. Please try again.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || submitStatus === 'success'}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md',
              'bg-blue-600 hover:bg-blue-700 text-white',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Send size={14} />
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
