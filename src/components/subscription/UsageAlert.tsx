/**
 * Usage Alert Component
 * Shows inline warning when user is approaching or has exceeded limits
 */

'use client';

import React from 'react';
import { AlertTriangle, X, TrendingUp } from 'lucide-react';
import { useSubscription } from '@/context/SubscriptionContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface UsageAlertProps {
  onDismiss?: () => void;
  showUpgradeButton?: boolean;
  className?: string;
}

export function UsageAlert({
  onDismiss,
  showUpgradeButton = true,
  className,
}: UsageAlertProps) {
  const { usage, tier, getUsageWarningLevel, createCheckout } = useSubscription();
  const warningLevel = getUsageWarningLevel();

  // Don't show if no warning
  if (warningLevel === 'none' || !usage) {
    return null;
  }

  const getAlertConfig = () => {
    switch (warningLevel) {
      case 'critical':
        return {
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-800 dark:text-red-200',
          iconColor: 'text-red-500',
          title: 'Usage Limit Reached',
          message: 'You\'ve reached your plan limits. Upgrade now to continue using EMTChat.',
        };
      case 'high':
        return {
          bgColor: 'bg-orange-50 dark:bg-orange-900/20',
          borderColor: 'border-orange-200 dark:border-orange-800',
          textColor: 'text-orange-800 dark:text-orange-200',
          iconColor: 'text-orange-500',
          title: 'Almost at Limit',
          message: `You've used ${Math.round(Math.max(usage.percentQueriesUsed, usage.percentStorageUsed))}% of your plan. Consider upgrading for more capacity.`,
        };
      case 'moderate':
        return {
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          textColor: 'text-yellow-800 dark:text-yellow-200',
          iconColor: 'text-yellow-500',
          title: 'High Usage',
          message: `You've used ${Math.round(Math.max(usage.percentQueriesUsed, usage.percentStorageUsed))}% of your monthly allowance.`,
        };
      default:
        return null;
    }
  };

  const config = getAlertConfig();
  if (!config) return null;

  const handleUpgrade = async () => {
    const nextTier = tier === 'free' ? 'starter' : tier === 'starter' ? 'pro' : 'team';
    await createCheckout(nextTier, 'monthly');
  };

  return (
    <div
      className={cn(
        'rounded-lg p-4 border',
        config.bgColor,
        config.borderColor,
        className,
      )}
    >
      <div className="flex items-start">
        <AlertTriangle className={cn('h-5 w-5 mr-3 flex-shrink-0 mt-0.5', config.iconColor)} />
        <div className="flex-1 min-w-0">
          <h4 className={cn('text-sm font-medium', config.textColor)}>
            {config.title}
          </h4>
          <p className={cn('text-sm mt-1', config.textColor, 'opacity-90')}>
            {config.message}
          </p>
          {showUpgradeButton && tier !== 'enterprise' && (
            <div className="mt-3">
              <Button
                size="sm"
                variant={warningLevel === 'critical' ? 'default' : 'outline'}
                onClick={handleUpgrade}
                className={cn(
                  warningLevel === 'critical' && 'bg-red-600 hover:bg-red-700',
                )}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Upgrade Now
              </Button>
            </div>
          )}
        </div>
        {onDismiss && warningLevel !== 'critical' && (
          <button
            onClick={onDismiss}
            className={cn(
              'p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10',
              config.textColor,
            )}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default UsageAlert;
