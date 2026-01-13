/**
 * Pricing Page
 * Displays all pricing tiers with Stripe checkout integration
 */

'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, X, AlertCircle } from 'lucide-react';
import { PricingTable } from '@/components/subscription';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { cn } from '@/lib/utils';

// Feature comparison data
const featureComparison = [
  { feature: 'Monthly Queries', free: '50', starter: '500', pro: '2,000', team: '10,000', enterprise: 'Unlimited' },
  { feature: 'Storage', free: '100 MB', starter: '1 GB', pro: '10 GB', team: '50 GB', enterprise: 'Custom' },
  { feature: 'Max File Size', free: '10 MB', starter: '25 MB', pro: '100 MB', team: '500 MB', enterprise: '1 GB' },
  { feature: 'Chat History', free: false, starter: true, pro: true, team: true, enterprise: true },
  { feature: 'Priority Support', free: false, starter: true, pro: true, team: true, enterprise: true },
  { feature: 'API Access', free: false, starter: false, pro: true, team: true, enterprise: true },
  { feature: 'Advanced Analytics', free: false, starter: false, pro: true, team: true, enterprise: true },
  { feature: 'Team Members', free: '1', starter: '1', pro: '1', team: '5', enterprise: 'Unlimited' },
  { feature: 'Team Collaboration', free: false, starter: false, pro: false, team: true, enterprise: true },
  { feature: 'Admin Dashboard', free: false, starter: false, pro: false, team: true, enterprise: true },
  { feature: 'SSO/SAML', free: false, starter: false, pro: false, team: false, enterprise: true },
  { feature: 'On-Premise Option', free: false, starter: false, pro: false, team: false, enterprise: true },
  { feature: 'SLA Guarantee', free: false, starter: false, pro: false, team: false, enterprise: true },
  { feature: '24/7 Support', free: false, starter: false, pro: false, team: false, enterprise: true },
];

function FeatureCell({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="h-5 w-5 text-green-500 mx-auto" />
    ) : (
      <X className="h-5 w-5 text-gray-300 dark:text-gray-600 mx-auto" />
    );
  }
  return <span className="text-gray-700 dark:text-gray-300">{value}</span>;
}

function CanceledBanner() {
  const searchParams = useSearchParams();
  const canceled = searchParams.get('canceled');

  if (!canceled) return null;

  return (
    <div className={cn(
      'mb-8 rounded-lg p-4',
      'bg-yellow-50 dark:bg-yellow-900/20',
      'border border-yellow-200 dark:border-yellow-800',
      'flex items-start gap-3',
    )}>
      <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
          Checkout Canceled
        </p>
        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
          Your checkout session was canceled. Feel free to explore our plans and try again when you&apos;re ready.
        </p>
      </div>
    </div>
  );
}

function PricingContent() {
  return (
    <div className="py-12 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Choose the plan that fits your needs. All plans include our core AI chat features.
          </p>
        </div>

        {/* Canceled banner */}
        <Suspense fallback={null}>
          <CanceledBanner />
        </Suspense>

        {/* Pricing cards */}
        <SubscriptionProvider>
          <PricingTable showEnterprise={true} />
        </SubscriptionProvider>

        {/* Feature comparison table */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
            Compare All Features
          </h2>

          <div className={cn(
            'rounded-2xl overflow-hidden',
            'backdrop-blur-xl backdrop-saturate-150',
            'bg-white/60 dark:bg-black/40',
            'border border-white/20 dark:border-white/10',
          )}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Feature
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                      Free
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                      Starter
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-blue-600 dark:text-blue-400">
                      Pro
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                      Team
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                      Enterprise
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {featureComparison.map((row, idx) => (
                    <tr
                      key={row.feature}
                      className={cn(
                        'border-b border-gray-100 dark:border-gray-800',
                        idx % 2 === 0 && 'bg-gray-50/50 dark:bg-gray-900/20',
                      )}
                    >
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {row.feature}
                      </td>
                      <td className="px-4 py-4 text-center text-sm">
                        <FeatureCell value={row.free} />
                      </td>
                      <td className="px-4 py-4 text-center text-sm">
                        <FeatureCell value={row.starter} />
                      </td>
                      <td className="px-4 py-4 text-center text-sm bg-blue-50/50 dark:bg-blue-900/10">
                        <FeatureCell value={row.pro} />
                      </td>
                      <td className="px-4 py-4 text-center text-sm">
                        <FeatureCell value={row.team} />
                      </td>
                      <td className="px-4 py-4 text-center text-sm">
                        <FeatureCell value={row.enterprise} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
            Frequently Asked Questions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                q: 'Can I change my plan later?',
                a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.',
              },
              {
                q: 'What happens if I exceed my limits?',
                a: 'You\'ll receive warnings as you approach your limits. Once exceeded, you can upgrade your plan or wait for the next billing period.',
              },
              {
                q: 'Is there a free trial?',
                a: 'The Free tier gives you 50 queries per month permanently. For paid tiers, we offer a 14-day money-back guarantee.',
              },
              {
                q: 'How does team billing work?',
                a: 'Team plans are billed per seat. You can add or remove team members anytime, with prorated billing adjustments.',
              },
            ].map((faq) => (
              <div
                key={faq.q}
                className={cn(
                  'rounded-xl p-6',
                  'backdrop-blur-xl backdrop-saturate-150',
                  'bg-white/60 dark:bg-black/40',
                  'border border-white/20 dark:border-white/10',
                )}
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {faq.q}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return <PricingContent />;
}
