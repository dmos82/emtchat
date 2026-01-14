'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Circle, FileUp, MessageSquare, Sparkles, Users, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  href: string;
  tierRequired?: string[];
}

interface GettingStartedChecklistProps {
  tier: string;
  hasDocuments?: boolean;
  hasChats?: boolean;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'first-chat',
    label: 'Ask your first question',
    description: 'Try asking about EMS protocols or medical terminology',
    icon: MessageSquare,
    href: '/chat',
  },
  {
    id: 'upload-document',
    label: 'Upload a document',
    description: 'Add your study materials for personalized responses',
    icon: FileUp,
    href: '/documents',
  },
  {
    id: 'try-personas',
    label: 'Explore AI personas',
    description: 'Chat with specialized medical experts',
    icon: Sparkles,
    href: '/chat',
    tierRequired: ['pro', 'team', 'enterprise'],
  },
  {
    id: 'invite-team',
    label: 'Invite team members',
    description: 'Collaborate with your study group or department',
    icon: Users,
    href: '/subscription',
    tierRequired: ['team', 'enterprise'],
  },
];

export function GettingStartedChecklist({ tier, hasDocuments = false, hasChats = false }: GettingStartedChecklistProps) {
  const router = useRouter();
  const [completedItems, setCompletedItems] = useState<string[]>([]);

  // Load completed items from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('emtchat_onboarding_completed');
    if (saved) {
      setCompletedItems(JSON.parse(saved));
    }

    // Auto-complete based on actual usage
    const autoCompleted: string[] = [];
    if (hasChats) autoCompleted.push('first-chat');
    if (hasDocuments) autoCompleted.push('upload-document');

    if (autoCompleted.length > 0) {
      setCompletedItems(prev => {
        const newItems = [...new Set([...prev, ...autoCompleted])];
        localStorage.setItem('emtchat_onboarding_completed', JSON.stringify(newItems));
        return newItems;
      });
    }
  }, [hasDocuments, hasChats]);

  // Filter items based on tier
  const visibleItems = CHECKLIST_ITEMS.filter(item => {
    if (!item.tierRequired) return true;
    return item.tierRequired.includes(tier);
  });

  const completedCount = visibleItems.filter(item => completedItems.includes(item.id)).length;
  const progress = (completedCount / visibleItems.length) * 100;

  const handleItemClick = (item: ChecklistItem) => {
    router.push(item.href);
  };

  // Don't show if all items completed
  if (completedCount === visibleItems.length) {
    return null;
  }

  return (
    <div className={cn(
      'rounded-2xl p-6',
      'backdrop-blur-xl backdrop-saturate-150',
      'bg-white/60 dark:bg-black/40',
      'border border-white/20 dark:border-white/10',
      'shadow-lg shadow-black/5 dark:shadow-black/20',
    )}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Getting Started
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {completedCount} of {visibleItems.length} completed
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-green-600 dark:text-green-400">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 mb-6 overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Checklist items */}
      <div className="space-y-3">
        {visibleItems.map((item) => {
          const isCompleted = completedItems.includes(item.id);

          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              disabled={isCompleted}
              className={cn(
                'w-full p-4 rounded-xl text-left transition-all duration-200',
                'flex items-center gap-4',
                isCompleted
                  ? 'bg-green-50 dark:bg-green-900/20 opacity-60 cursor-default'
                  : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer',
              )}
            >
              {/* Status icon */}
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                isCompleted
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
              )}>
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'font-medium',
                  isCompleted
                    ? 'text-green-700 dark:text-green-400 line-through'
                    : 'text-gray-900 dark:text-white',
                )}>
                  {item.label}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {item.description}
                </p>
              </div>

              {/* Arrow */}
              {!isCompleted && (
                <ArrowRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
