/**
 * Subscription Context
 * Manages subscription state and Stripe integration for EMTChat
 */

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { loadStripe } from '@stripe/stripe-js';

// Types
export type TierName = 'free' | 'starter' | 'pro' | 'team' | 'enterprise';
export type BillingInterval = 'monthly' | 'yearly';

export interface TierLimits {
  queriesPerMonth: number;
  storageBytes: number;
  maxFileSizeBytes: number;
  features: string[];
  displayName: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
}

export interface UsageData {
  queriesUsed: number;
  queriesLimit: number;
  storageUsed: number;
  storageLimit: number;
  percentQueriesUsed: number;
  percentStorageUsed: number;
}

export interface SubscriptionData {
  id?: string;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  billingInterval?: BillingInterval;
}

export interface SubscriptionState {
  tier: TierName;
  status: string;
  limits: TierLimits | null;
  subscription: SubscriptionData | null;
  usage: UsageData | null;
  isLoading: boolean;
  error: string | null;
}

interface SubscriptionContextType extends SubscriptionState {
  refreshStatus: () => Promise<void>;
  createCheckout: (tier: TierName, interval: BillingInterval) => Promise<void>;
  openPortal: () => Promise<void>;
  cancelSubscription: () => Promise<void>;
  resumeSubscription: () => Promise<void>;
  isFeatureEnabled: (feature: string) => boolean;
  getTierDisplayName: () => string;
  getUsageWarningLevel: () => 'none' | 'moderate' | 'high' | 'critical';
}

// Tier limits (duplicated for client-side use)
const TIER_LIMITS: Record<TierName, TierLimits> = {
  free: {
    queriesPerMonth: 50,
    storageBytes: 100 * 1024 * 1024, // 100MB
    maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
    features: ['basic-chat', 'document-upload'],
    displayName: 'Free',
    description: 'Get started with basic features',
    monthlyPrice: 0,
    yearlyPrice: 0,
  },
  starter: {
    queriesPerMonth: 500,
    storageBytes: 1024 * 1024 * 1024, // 1GB
    maxFileSizeBytes: 25 * 1024 * 1024, // 25MB
    features: ['basic-chat', 'document-upload', 'chat-history', 'priority-support'],
    displayName: 'Starter',
    description: 'For individuals getting serious',
    monthlyPrice: 19.99,
    yearlyPrice: 191.90,
  },
  pro: {
    queriesPerMonth: 2000,
    storageBytes: 10 * 1024 * 1024 * 1024, // 10GB
    maxFileSizeBytes: 100 * 1024 * 1024, // 100MB
    features: ['basic-chat', 'document-upload', 'chat-history', 'priority-support', 'advanced-analytics', 'api-access'],
    displayName: 'Pro',
    description: 'For power users and professionals',
    monthlyPrice: 39.99,
    yearlyPrice: 383.90,
  },
  team: {
    queriesPerMonth: 10000,
    storageBytes: 50 * 1024 * 1024 * 1024, // 50GB
    maxFileSizeBytes: 500 * 1024 * 1024, // 500MB
    features: ['basic-chat', 'document-upload', 'chat-history', 'priority-support', 'advanced-analytics', 'api-access', 'team-collaboration', 'admin-panel'],
    displayName: 'Team',
    description: 'For teams who need to collaborate',
    monthlyPrice: 99.99,
    yearlyPrice: 959.90,
  },
  enterprise: {
    queriesPerMonth: -1, // Unlimited
    storageBytes: -1, // Custom
    maxFileSizeBytes: 1024 * 1024 * 1024, // 1GB
    features: ['all'],
    displayName: 'Enterprise',
    description: 'Custom solutions for large organizations',
    monthlyPrice: -1, // Custom
    yearlyPrice: -1,
  },
};

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

// Create context
const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Provider component
export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SubscriptionState>({
    tier: 'free',
    status: 'active',
    limits: TIER_LIMITS.free,
    subscription: null,
    usage: null,
    isLoading: true,
    error: null,
  });

  // Fetch subscription status
  const refreshStatus = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/subscription/status', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription status');
      }

      const data = await response.json();

      setState({
        tier: data.tier || 'free',
        status: data.status || 'active',
        limits: TIER_LIMITS[data.tier as TierName] || TIER_LIMITS.free,
        subscription: data.subscription,
        usage: data.usage ? {
          queriesUsed: data.usage.queriesUsed,
          queriesLimit: data.usage.queriesLimit,
          storageUsed: data.usage.storageUsed,
          storageLimit: data.usage.storageLimit,
          percentQueriesUsed: data.usage.queriesLimit > 0
            ? (data.usage.queriesUsed / data.usage.queriesLimit) * 100
            : 0,
          percentStorageUsed: data.usage.storageLimit > 0
            ? (data.usage.storageUsed / data.usage.storageLimit) * 100
            : 0,
        } : null,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  // Create checkout session
  const createCheckout = useCallback(async (tier: TierName, interval: BillingInterval) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tier,
          interval,
          successUrl: `${window.location.origin}/subscription?success=true`,
          cancelUrl: `${window.location.origin}/pricing?canceled=true`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  // Open customer portal
  const openPortal = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/subscription/create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/subscription`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create portal session');
      }

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  // Cancel subscription
  const cancelSubscription = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }

      await refreshStatus();
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [refreshStatus]);

  // Resume subscription
  const resumeSubscription = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/subscription/resume', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resume subscription');
      }

      await refreshStatus();
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [refreshStatus]);

  // Check if feature is enabled for current tier
  const isFeatureEnabled = useCallback((feature: string): boolean => {
    if (!state.limits) return false;
    if (state.limits.features.includes('all')) return true;
    return state.limits.features.includes(feature);
  }, [state.limits]);

  // Get tier display name
  const getTierDisplayName = useCallback((): string => {
    return state.limits?.displayName || 'Free';
  }, [state.limits]);

  // Get usage warning level
  const getUsageWarningLevel = useCallback((): 'none' | 'moderate' | 'high' | 'critical' => {
    if (!state.usage) return 'none';

    const queryPercent = state.usage.percentQueriesUsed;
    const storagePercent = state.usage.percentStorageUsed;
    const maxPercent = Math.max(queryPercent, storagePercent);

    if (maxPercent >= 100) return 'critical';
    if (maxPercent >= 90) return 'high';
    if (maxPercent >= 75) return 'moderate';
    return 'none';
  }, [state.usage]);

  // Load status on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const value: SubscriptionContextType = {
    ...state,
    refreshStatus,
    createCheckout,
    openPortal,
    cancelSubscription,
    resumeSubscription,
    isFeatureEnabled,
    getTierDisplayName,
    getUsageWarningLevel,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// Hook to use subscription context
export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

// Export tier limits for components
export { TIER_LIMITS };

export default SubscriptionContext;
