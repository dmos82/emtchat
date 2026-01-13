/**
 * Pricing Table Component
 * Displays all pricing tiers with billing interval toggle
 */

'use client';

import React, { useState } from 'react';
import { PricingCard } from './PricingCard';
import { useSubscription, TIER_LIMITS, type TierName, type BillingInterval } from '@/context/SubscriptionContext';
import { cn } from '@/lib/utils';

interface PricingTableProps {
  onSelectTier?: (tier: TierName, interval: BillingInterval) => void;
  showEnterprise?: boolean;
}

export function PricingTable({ onSelectTier, showEnterprise = true }: PricingTableProps) {
  const { tier: currentTier, createCheckout, isLoading } = useSubscription();
  const [interval, setInterval] = useState<BillingInterval>('monthly');

  const handleSelectTier = async (tier: TierName, billingInterval: BillingInterval) => {
    if (onSelectTier) {
      onSelectTier(tier, billingInterval);
      return;
    }

    if (tier === 'enterprise') {
      // Open contact form or redirect to sales page
      window.location.href = '/contact?plan=enterprise';
      return;
    }

    if (tier === 'free') {
      // Just redirect to signup/dashboard
      window.location.href = '/';
      return;
    }

    await createCheckout(tier, billingInterval);
  };

  const tiers: TierName[] = showEnterprise
    ? ['free', 'starter', 'pro', 'team', 'enterprise']
    : ['free', 'starter', 'pro', 'team'];

  return (
    <div className="w-full">
      {/* Billing interval toggle */}
      <div className="flex justify-center mb-8">
        <div className={cn(
          'inline-flex rounded-xl p-1',
          'backdrop-blur-xl backdrop-saturate-150',
          'bg-white/40 dark:bg-black/30',
          'border border-white/20 dark:border-white/10',
        )}>
          <button
            onClick={() => setInterval('monthly')}
            className={cn(
              'px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              interval === 'monthly'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setInterval('yearly')}
            className={cn(
              'px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              'flex items-center gap-2',
              interval === 'yearly'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
            )}
          >
            Yearly
            <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing cards grid */}
      <div className={cn(
        'grid gap-6',
        showEnterprise ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
        'max-w-7xl mx-auto px-4',
      )}>
        {tiers.map((tierName) => (
          <PricingCard
            key={tierName}
            tier={tierName}
            limits={TIER_LIMITS[tierName]}
            interval={interval}
            isCurrentTier={tierName === currentTier}
            isPopular={tierName === 'pro'}
            onSelect={handleSelectTier}
            isLoading={isLoading}
          />
        ))}
      </div>

      {/* Feature comparison link */}
      <div className="text-center mt-8">
        <a
          href="/features"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Compare all features →
        </a>
      </div>
    </div>
  );
}

export default PricingTable;
