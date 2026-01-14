/**
 * Welcome Dashboard Page
 * Post-purchase landing page showing plan summary and getting started guide
 */

'use client';

import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { SubscriptionProvider, useSubscription } from '@/context/SubscriptionContext';
import { useAuth } from '@/hooks/useAuth';
import { WelcomeHero, PlanSummaryCard, QuickActions, GettingStartedChecklist } from '@/components/welcome';
import { Loader2 } from 'lucide-react';

function WelcomeContent() {
  const { user } = useAuth();
  const {
    tier,
    limits,
    subscription,
    isLoading,
    getTierDisplayName,
    openPortal,
  } = useSubscription();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome hero */}
      <WelcomeHero
        tierName={getTierDisplayName()}
        userName={user?.username}
      />

      {/* Plan summary */}
      {limits && (
        <PlanSummaryCard
          tierName={getTierDisplayName()}
          tier={tier}
          queriesPerMonth={limits.queriesPerMonth}
          storageBytes={limits.storageBytes}
          maxFileSizeBytes={limits.maxFileSizeBytes}
          features={limits.features}
          billingInterval={subscription?.billingInterval}
          renewalDate={subscription?.currentPeriodEnd}
        />
      )}

      {/* Quick actions */}
      <QuickActions
        onOpenBilling={openPortal}
        showBilling={tier !== 'free'}
      />

      {/* Getting started checklist */}
      <GettingStartedChecklist
        tier={tier}
        hasDocuments={false} // TODO: Could fetch actual count
        hasChats={false}     // TODO: Could fetch actual count
      />
    </div>
  );
}

export default function WelcomePage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <SubscriptionProvider>
            <WelcomeContent />
          </SubscriptionProvider>
        </div>
      </div>
    </ProtectedRoute>
  );
}
