/**
 * Subscription Management Page
 * Shows current subscription status, usage, and management options
 */

'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Settings, CreditCard, TrendingUp } from 'lucide-react';
import { SubscriptionProvider, useSubscription } from '@/context/SubscriptionContext';
import { UsageDashboard, UsageAlert } from '@/components/subscription';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function SuccessBanner() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');

  if (!success) return null;

  return (
    <div className={cn(
      'mb-8 rounded-lg p-4',
      'bg-green-50 dark:bg-green-900/20',
      'border border-green-200 dark:border-green-800',
      'flex items-start gap-3',
    )}>
      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-green-800 dark:text-green-200">
          Subscription Updated Successfully!
        </p>
        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
          Your subscription has been updated. You now have access to your new plan features.
        </p>
      </div>
    </div>
  );
}

function SubscriptionContent() {
  const {
    tier,
    status,
    subscription,
    limits,
    isLoading,
    getTierDisplayName,
    openPortal,
  } = useSubscription();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current plan card */}
      <div className={cn(
        'rounded-2xl p-6',
        'backdrop-blur-xl backdrop-saturate-150',
        'bg-white/60 dark:bg-black/40',
        'border border-white/20 dark:border-white/10',
        'shadow-lg shadow-black/5 dark:shadow-black/20',
      )}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Current Plan
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {getTierDisplayName()} • {status === 'active' ? 'Active' : status}
            </p>
          </div>
          <div className={cn(
            'px-4 py-2 rounded-full text-sm font-medium',
            tier === 'free' && 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
            tier === 'starter' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            tier === 'pro' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
            tier === 'team' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            tier === 'enterprise' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
          )}>
            {getTierDisplayName()}
          </div>
        </div>

        {/* Plan details */}
        {limits && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {limits.queriesPerMonth < 0 ? '∞' : limits.queriesPerMonth.toLocaleString()}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Queries/Month</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {limits.storageBytes < 0 ? 'Custom' : `${Math.round(limits.storageBytes / 1024 / 1024 / 1024)} GB`}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Storage</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(limits.maxFileSizeBytes / 1024 / 1024)} MB
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Max File Size</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {limits.features.length}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Features</p>
            </div>
          </div>
        )}

        {/* Subscription info */}
        {subscription && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex flex-wrap gap-4 text-sm">
              {subscription.billingInterval && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Billing: </span>
                  <span className="text-gray-900 dark:text-white capitalize">{subscription.billingInterval}</span>
                </div>
              )}
              {subscription.currentPeriodEnd && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Renews: </span>
                  <span className="text-gray-900 dark:text-white">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
              )}
              {subscription.cancelAtPeriodEnd && (
                <div className="text-orange-600 dark:text-orange-400">
                  Cancels at period end
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mt-6">
          {tier !== 'free' && (
            <Button variant="outline" onClick={openPortal}>
              <CreditCard className="h-4 w-4 mr-2" />
              Manage Billing
            </Button>
          )}
          {tier !== 'enterprise' && (
            <Button onClick={() => window.location.href = '/pricing'}>
              <TrendingUp className="h-4 w-4 mr-2" />
              {tier === 'free' ? 'Upgrade Plan' : 'Change Plan'}
            </Button>
          )}
        </div>
      </div>

      {/* Usage alert */}
      <UsageAlert showUpgradeButton={tier !== 'enterprise'} />

      {/* Usage dashboard */}
      <UsageDashboard />
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Subscription
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your subscription and view usage statistics.
          </p>
        </div>

        {/* Success banner */}
        <Suspense fallback={null}>
          <SuccessBanner />
        </Suspense>

        {/* Content */}
        <SubscriptionProvider>
          <SubscriptionContent />
        </SubscriptionProvider>
      </div>
    </div>
  );
}
