/**
 * Usage Dashboard Component
 * Displays current subscription usage with progress bars
 */

'use client';

import React from 'react';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { useSubscription } from '@/context/SubscriptionContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface UsageBarProps {
  label: string;
  used: number;
  limit: number;
  unit: string;
  formatValue?: (value: number) => string;
}

function UsageBar({ label, used, limit, unit, formatValue }: UsageBarProps) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isUnlimited = limit < 0;
  const displayUsed = formatValue ? formatValue(used) : used.toLocaleString();
  const displayLimit = isUnlimited ? 'Unlimited' : (formatValue ? formatValue(limit) : limit.toLocaleString());

  const getBarColor = () => {
    if (isUnlimited) return 'bg-green-500';
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 90) return 'bg-orange-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-gray-600 dark:text-gray-400">
          {displayUsed} {unit} / {displayLimit} {!isUnlimited && unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            getBarColor(),
          )}
          style={{ width: isUnlimited ? '100%' : `${percentage}%` }}
        />
      </div>
      {!isUnlimited && percentage >= 75 && (
        <p className={cn(
          'text-xs flex items-center gap-1',
          percentage >= 100 ? 'text-red-600 dark:text-red-400' :
          percentage >= 90 ? 'text-orange-600 dark:text-orange-400' :
          'text-yellow-600 dark:text-yellow-400',
        )}>
          <AlertTriangle className="h-3 w-3" />
          {percentage >= 100 ? 'Limit reached' : `${Math.round(percentage)}% used`}
        </p>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function UsageDashboard() {
  const {
    tier,
    limits,
    usage,
    subscription,
    isLoading,
    getTierDisplayName,
    getUsageWarningLevel,
    openPortal,
  } = useSubscription();

  const warningLevel = getUsageWarningLevel();

  if (isLoading) {
    return (
      <div className={cn(
        'rounded-2xl p-6',
        'backdrop-blur-xl backdrop-saturate-150',
        'bg-white/60 dark:bg-black/40',
        'border border-white/20 dark:border-white/10',
        'animate-pulse',
      )}>
        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Usage This Period
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {getTierDisplayName()} Plan
          </p>
        </div>
        {warningLevel !== 'none' && (
          <div className={cn(
            'px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1',
            warningLevel === 'critical' && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
            warningLevel === 'high' && 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
            warningLevel === 'moderate' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
          )}>
            <AlertTriangle className="h-3 w-3" />
            {warningLevel === 'critical' ? 'Limit Reached' :
             warningLevel === 'high' ? 'Almost at Limit' : 'High Usage'}
          </div>
        )}
      </div>

      {/* Usage bars */}
      <div className="space-y-6">
        {usage && limits && (
          <>
            <UsageBar
              label="Queries"
              used={usage.queriesUsed}
              limit={limits.queriesPerMonth}
              unit="queries"
            />
            <UsageBar
              label="Storage"
              used={usage.storageUsed}
              limit={limits.storageBytes}
              unit=""
              formatValue={formatBytes}
            />
          </>
        )}
      </div>

      {/* Subscription details */}
      {subscription && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Billing Period Ends
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {subscription.currentPeriodEnd
                ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                : 'N/A'}
            </span>
          </div>
          {subscription.cancelAtPeriodEnd && (
            <p className="mt-2 text-sm text-orange-600 dark:text-orange-400 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Subscription will cancel at period end
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        {tier !== 'free' && (
          <Button
            variant="outline"
            size="sm"
            onClick={openPortal}
            className="flex-1"
          >
            Manage Billing
          </Button>
        )}
        {tier !== 'enterprise' && (
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() => window.location.href = '/pricing'}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            {tier === 'free' ? 'Upgrade Plan' : 'Change Plan'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default UsageDashboard;
