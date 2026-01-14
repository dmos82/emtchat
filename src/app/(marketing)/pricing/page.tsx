/**
 * Pricing Page
 * Displays all pricing tiers with links to signup
 */

'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Check, X, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Plan data
const plans = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with basic features',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      '50 queries per month',
      '100MB storage',
      '10MB max file size',
      'Basic document chat',
      'Community support',
    ],
    notIncluded: ['Chat history', 'Priority support', 'API access'],
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'For individuals getting serious',
    monthlyPrice: 19.99,
    yearlyPrice: 15.99,
    features: [
      '500 queries per month',
      '1GB storage',
      '25MB max file size',
      'Full chat history',
      'Priority email support',
      'Export conversations',
    ],
    notIncluded: ['API access', 'Advanced analytics'],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For power users and professionals',
    monthlyPrice: 39.99,
    yearlyPrice: 31.99,
    popular: true,
    features: [
      '2,000 queries per month',
      '10GB storage',
      '100MB max file size',
      'Advanced analytics',
      'API access',
      'Priority support',
      'Custom integrations',
    ],
    notIncluded: [],
  },
  {
    id: 'team',
    name: 'Team',
    description: 'For teams who need to collaborate',
    monthlyPrice: 99.99,
    yearlyPrice: 79.99,
    features: [
      '10,000 queries per month',
      '50GB shared storage',
      '500MB max file size',
      'Up to 5 team members',
      'Team collaboration',
      'Admin dashboard',
      'SSO support',
      'Dedicated support',
    ],
    notIncluded: [],
  },
];

const enterprisePlan = {
  id: 'enterprise',
  name: 'Enterprise',
  description: 'Custom solutions for large organizations',
  features: [
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
];

function FeatureCell({ value, isDark }: { value: string | boolean; isDark: boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="h-5 w-5 text-green-500 mx-auto" />
    ) : (
      <X className={cn('h-5 w-5 mx-auto', isDark ? 'text-gray-600' : 'text-gray-400')} />
    );
  }
  return <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{value}</span>;
}

function CanceledBanner() {
  const searchParams = useSearchParams();
  const canceled = searchParams.get('canceled');

  if (!canceled) return null;

  return (
    <div className={cn(
      'mb-8 rounded-lg p-4',
      'bg-yellow-900/30',
      'border border-yellow-500/30',
      'flex items-start gap-3',
    )}>
      <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-yellow-200">
          Checkout Canceled
        </p>
        <p className="text-sm text-yellow-300/80 mt-1">
          Your checkout session was canceled. Feel free to explore our plans and try again when you&apos;re ready.
        </p>
      </div>
    </div>
  );
}

function PricingContent() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = !mounted || resolvedTheme === 'dark';

  return (
    <div className="py-12 md:py-20 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className={cn('text-4xl md:text-5xl font-bold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
            Simple, Transparent Pricing
          </h1>
          <p className={cn('text-xl max-w-2xl mx-auto', isDark ? 'text-gray-400' : 'text-gray-600')}>
            Choose the plan that fits your needs. All plans include our core AI chat features.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-10">
          <div className={cn(
            'p-1 rounded-lg inline-flex',
            isDark ? 'bg-gray-900/80 border border-white/10' : 'bg-gray-100 border border-gray-200'
          )}>
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={cn(
                'px-6 py-2 rounded-md text-sm font-medium transition-all',
                billingPeriod === 'monthly'
                  ? 'bg-red-600 text-white'
                  : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={cn(
                'px-6 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2',
                billingPeriod === 'yearly'
                  ? 'bg-red-600 text-white'
                  : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Yearly
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Canceled banner */}
        <Suspense fallback={null}>
          <CanceledBanner />
        </Suspense>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'rounded-2xl p-6 flex flex-col backdrop-blur-sm',
                'border-2',
                isDark ? 'bg-gray-900/80' : 'bg-white/80 shadow-sm',
                plan.popular
                  ? 'border-red-500 relative'
                  : isDark ? 'border-white/10' : 'border-gray-200',
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <h3 className={cn('text-xl font-semibold mb-1', isDark ? 'text-white' : 'text-gray-900')}>{plan.name}</h3>
              <p className={cn('text-sm mb-4', isDark ? 'text-gray-400' : 'text-gray-600')}>{plan.description}</p>

              <div className="mb-6">
                <span className={cn('text-4xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                  ${billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                </span>
                <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>/month</span>
                {billingPeriod === 'yearly' && plan.monthlyPrice > 0 && (
                  <p className={cn('text-sm mt-1', isDark ? 'text-gray-500' : 'text-gray-500')}>
                    Billed annually (${(plan.yearlyPrice * 12).toFixed(0)}/year)
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-6 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className={cn('flex items-start gap-2 text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link href={`/signup?plan=${plan.id}`}>
                <Button
                  className={cn(
                    'w-full h-11',
                    plan.popular
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  )}
                >
                  {plan.monthlyPrice === 0 ? 'Get Started Free' : 'Start Free Trial'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          ))}
        </div>

        {/* Enterprise CTA */}
        <div className={cn(
          'rounded-2xl p-8 mb-20',
          isDark
            ? 'bg-gradient-to-r from-gray-900 to-gray-800 border border-white/10'
            : 'bg-gradient-to-r from-gray-100 to-gray-50 border border-gray-200 shadow-sm',
        )}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className={cn('text-2xl font-bold mb-2', isDark ? 'text-white' : 'text-gray-900')}>{enterprisePlan.name}</h3>
              <p className={cn('mb-4', isDark ? 'text-gray-400' : 'text-gray-600')}>{enterprisePlan.description}</p>
              <div className="flex flex-wrap gap-4">
                {enterprisePlan.features.slice(0, 4).map((feature) => (
                  <span key={feature} className={cn('flex items-center gap-2 text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>
                    <Check className="h-4 w-4 text-green-500" />
                    {feature}
                  </span>
                ))}
              </div>
            </div>
            <Link href="/contact">
              <Button size="lg" className={cn(
                'px-8 whitespace-nowrap',
                isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-red-600 text-white hover:bg-red-700'
              )}>
                Contact Sales
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature comparison table */}
        <div>
          <h2 className={cn('text-2xl font-bold text-center mb-8', isDark ? 'text-white' : 'text-gray-900')}>
            Compare All Features
          </h2>

          <div className={cn(
            'rounded-2xl overflow-hidden backdrop-blur-sm',
            isDark ? 'bg-gray-900/80 border border-white/10' : 'bg-white/80 border border-gray-200 shadow-sm',
          )}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={isDark ? 'border-b border-white/10' : 'border-b border-gray-200'}>
                    <th className={cn('px-6 py-4 text-left text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                      Feature
                    </th>
                    <th className={cn('px-4 py-4 text-center text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                      Free
                    </th>
                    <th className={cn('px-4 py-4 text-center text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                      Starter
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-red-500">
                      Pro
                    </th>
                    <th className={cn('px-4 py-4 text-center text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                      Team
                    </th>
                    <th className={cn('px-4 py-4 text-center text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                      Enterprise
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {featureComparison.map((row, idx) => (
                    <tr
                      key={row.feature}
                      className={cn(
                        isDark ? 'border-b border-white/5' : 'border-b border-gray-100',
                        idx % 2 === 0 && (isDark ? 'bg-white/5' : 'bg-gray-50/50'),
                      )}
                    >
                      <td className={cn('px-6 py-4 text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>
                        {row.feature}
                      </td>
                      <td className="px-4 py-4 text-center text-sm">
                        <FeatureCell value={row.free} isDark={isDark} />
                      </td>
                      <td className="px-4 py-4 text-center text-sm">
                        <FeatureCell value={row.starter} isDark={isDark} />
                      </td>
                      <td className={cn('px-4 py-4 text-center text-sm', isDark ? 'bg-red-500/5' : 'bg-red-50')}>
                        <FeatureCell value={row.pro} isDark={isDark} />
                      </td>
                      <td className="px-4 py-4 text-center text-sm">
                        <FeatureCell value={row.team} isDark={isDark} />
                      </td>
                      <td className="px-4 py-4 text-center text-sm">
                        <FeatureCell value={row.enterprise} isDark={isDark} />
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
          <h2 className={cn('text-2xl font-bold text-center mb-8', isDark ? 'text-white' : 'text-gray-900')}>
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
                  'rounded-xl p-6 backdrop-blur-sm',
                  isDark
                    ? 'bg-gray-900/80 border border-white/10'
                    : 'bg-white/80 border border-gray-200 shadow-sm',
                )}
              >
                <h3 className={cn('font-semibold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
                  {faq.q}
                </h3>
                <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
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
