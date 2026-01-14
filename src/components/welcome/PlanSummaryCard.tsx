'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { MessageSquare, HardDrive, FileText, Zap } from 'lucide-react';

interface PlanSummaryCardProps {
  tierName: string;
  tier: string;
  queriesPerMonth: number;
  storageBytes: number;
  maxFileSizeBytes: number;
  features: string[];
  billingInterval?: string;
  renewalDate?: Date;
}

export function PlanSummaryCard({
  tierName,
  tier,
  queriesPerMonth,
  storageBytes,
  maxFileSizeBytes,
  features,
  billingInterval,
  renewalDate,
}: PlanSummaryCardProps) {
  // Format storage for display
  const formatStorage = (bytes: number): string => {
    if (bytes < 0) return 'Unlimited';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${Math.round(gb)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${Math.round(mb)} MB`;
  };

  // Get tier badge color
  const getTierColor = () => {
    switch (tier) {
      case 'starter': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'pro': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'team': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'enterprise': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className={cn(
      'rounded-2xl p-6',
      'backdrop-blur-xl backdrop-saturate-150',
      'bg-white/60 dark:bg-black/40',
      'border border-white/20 dark:border-white/10',
      'shadow-lg shadow-black/5 dark:shadow-black/20',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Your Plan
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {billingInterval ? `Billed ${billingInterval}` : 'Active subscription'}
          </p>
        </div>
        <span className={cn('px-4 py-2 rounded-full text-sm font-medium', getTierColor())}>
          {tierName}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
          <MessageSquare className="h-5 w-5 mx-auto mb-2 text-blue-500" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {queriesPerMonth < 0 ? '∞' : queriesPerMonth.toLocaleString()}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Queries/Month</p>
        </div>
        <div className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
          <HardDrive className="h-5 w-5 mx-auto mb-2 text-purple-500" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatStorage(storageBytes)}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Storage</p>
        </div>
        <div className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
          <FileText className="h-5 w-5 mx-auto mb-2 text-green-500" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatStorage(maxFileSizeBytes)}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Max File Size</p>
        </div>
        <div className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
          <Zap className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {features.length}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Features</p>
        </div>
      </div>

      {/* Renewal info */}
      {renewalDate && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Next billing: <span className="text-gray-900 dark:text-white font-medium">
              {new Date(renewalDate).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
