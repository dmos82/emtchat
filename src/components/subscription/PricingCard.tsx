/**
 * Pricing Card Component
 * Displays a single pricing tier with liquid glass effect
 */

'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TierName, BillingInterval, TierLimits } from '@/context/SubscriptionContext';

interface PricingCardProps {
  tier: TierName;
  limits: TierLimits;
  interval: BillingInterval;
  isCurrentTier?: boolean;
  isPopular?: boolean;
  onSelect: (tier: TierName, interval: BillingInterval) => void;
  isLoading?: boolean;
}

// Feature list by tier
const TIER_FEATURES: Record<TierName, string[]> = {
  free: [
    '50 queries per month',
    '100MB storage',
    '10MB max file size',
    'Basic document chat',
    'Community support',
  ],
  starter: [
    '500 queries per month',
    '1GB storage',
    '25MB max file size',
    'Full chat history',
    'Priority email support',
    'Export conversations',
  ],
  pro: [
    '2,000 queries per month',
    '10GB storage',
    '100MB max file size',
    'Advanced analytics',
    'API access',
    'Priority support',
    'Custom integrations',
  ],
  team: [
    '10,000 queries per month',
    '50GB shared storage',
    '500MB max file size',
    'Up to 5 team members',
    'Team collaboration',
    'Admin dashboard',
    'SSO support',
    'Dedicated support',
  ],
  enterprise: [
    'Unlimited queries',
    'Custom storage',
    '1GB max file size',
    'Unlimited team members',
    'Custom integrations',
    'On-premise deployment',
    'SLA guarantee',
    '24/7 priority support',
  ],
};

export function PricingCard({
  tier,
  limits,
  interval,
  isCurrentTier = false,
  isPopular = false,
  onSelect,
  isLoading = false,
}: PricingCardProps) {
  const price = interval === 'monthly' ? limits.monthlyPrice : limits.yearlyPrice;
  const monthlyEquivalent = interval === 'yearly' && price > 0 ? price / 12 : price;
  const features = TIER_FEATURES[tier];
  const isEnterprise = tier === 'enterprise';

  return (
    <div
      className={cn(
        // Base card styling with liquid glass
        'relative flex flex-col rounded-2xl p-6 transition-all duration-300',
        'backdrop-blur-xl backdrop-saturate-150',
        'border border-white/20 dark:border-white/10',
        'bg-white/60 dark:bg-black/40',
        'shadow-lg shadow-black/5 dark:shadow-black/20',
        'hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/30',
        'hover:border-white/30 dark:hover:border-white/20',
        // Popular tier styling
        isPopular && [
          'ring-2 ring-blue-500 dark:ring-blue-400',
          'scale-105 z-10',
        ],
        // Current tier styling
        isCurrentTier && [
          'ring-2 ring-green-500 dark:ring-green-400',
        ],
      )}
    >
      {/* Popular badge */}
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className={cn(
            'px-3 py-1 rounded-full text-xs font-semibold',
            'bg-blue-500 text-white',
            'shadow-lg shadow-blue-500/30',
          )}>
            Most Popular
          </span>
        </div>
      )}

      {/* Current tier badge */}
      {isCurrentTier && !isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className={cn(
            'px-3 py-1 rounded-full text-xs font-semibold',
            'bg-green-500 text-white',
            'shadow-lg shadow-green-500/30',
          )}>
            Current Plan
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          {limits.displayName}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {limits.description}
        </p>
      </div>

      {/* Price */}
      <div className="mb-6">
        {isEnterprise ? (
          <div className="flex items-baseline">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              Custom
            </span>
          </div>
        ) : price === 0 ? (
          <div className="flex items-baseline">
            <span className="text-4xl font-bold text-gray-900 dark:text-white">
              $0
            </span>
            <span className="text-gray-600 dark:text-gray-400 ml-2">
              /month
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-baseline">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">
                ${monthlyEquivalent.toFixed(2)}
              </span>
              <span className="text-gray-600 dark:text-gray-400 ml-2">
                /month
              </span>
            </div>
            {interval === 'yearly' && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                ${price.toFixed(2)} billed annually (save 20%)
              </p>
            )}
          </>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-6 flex-grow">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <Check className="h-5 w-5 text-green-500 dark:text-green-400 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {feature}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <Button
        onClick={() => onSelect(tier, interval)}
        disabled={isLoading || isCurrentTier}
        variant={isPopular ? 'default' : 'outline'}
        className={cn(
          'w-full',
          isPopular && 'bg-blue-600 hover:bg-blue-700',
          isCurrentTier && 'opacity-50 cursor-not-allowed',
        )}
      >
        {isLoading ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </span>
        ) : isCurrentTier ? (
          'Current Plan'
        ) : isEnterprise ? (
          'Contact Sales'
        ) : tier === 'free' ? (
          'Get Started Free'
        ) : (
          `Upgrade to ${limits.displayName}`
        )}
      </Button>
    </div>
  );
}

export default PricingCard;
