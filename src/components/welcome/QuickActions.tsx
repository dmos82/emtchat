'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, FileUp, CreditCard, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuickActionsProps {
  onOpenBilling?: () => void;
  showBilling?: boolean;
}

export function QuickActions({ onOpenBilling, showBilling = true }: QuickActionsProps) {
  const router = useRouter();

  const actions = [
    {
      icon: MessageSquare,
      label: 'Start Chatting',
      description: 'Ask questions about EMS protocols',
      onClick: () => router.push('/chat'),
      primary: true,
      color: 'text-blue-500',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      icon: FileUp,
      label: 'Upload Documents',
      description: 'Add your own study materials',
      onClick: () => router.push('/documents'),
      primary: false,
      color: 'text-purple-500',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
    ...(showBilling ? [{
      icon: CreditCard,
      label: 'Manage Billing',
      description: 'View invoices and update payment',
      onClick: onOpenBilling || (() => router.push('/subscription')),
      primary: false,
      color: 'text-green-500',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    }] : []),
    {
      icon: Settings,
      label: 'Account Settings',
      description: 'Customize your experience',
      onClick: () => router.push('/subscription'),
      primary: false,
      color: 'text-gray-500',
      bgColor: 'bg-gray-100 dark:bg-gray-800/50',
    },
  ];

  return (
    <div className={cn(
      'rounded-2xl p-6',
      'backdrop-blur-xl backdrop-saturate-150',
      'bg-white/60 dark:bg-black/40',
      'border border-white/20 dark:border-white/10',
      'shadow-lg shadow-black/5 dark:shadow-black/20',
    )}>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Quick Actions
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={cn(
              'p-4 rounded-xl text-left transition-all duration-200',
              'hover:scale-[1.02] active:scale-[0.98]',
              action.primary
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800',
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                action.primary ? 'bg-white/20' : action.bgColor,
              )}>
                <action.icon className={cn(
                  'h-5 w-5',
                  action.primary ? 'text-white' : action.color,
                )} />
              </div>
              <div>
                <p className={cn(
                  'font-semibold',
                  action.primary ? 'text-white' : 'text-gray-900 dark:text-white',
                )}>
                  {action.label}
                </p>
                <p className={cn(
                  'text-sm mt-0.5',
                  action.primary ? 'text-white/80' : 'text-gray-600 dark:text-gray-400',
                )}>
                  {action.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
