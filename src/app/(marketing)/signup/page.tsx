/**
 * Signup Page
 * Customer intake form with plan selection and Stripe checkout
 */

'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Loader2, ArrowRight, Building2, User, Mail, Lock, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/config';

const API_BASE_URL = getApiBaseUrl();

// Plan data
const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Get started with basic features',
    features: ['50 queries per month', '100MB storage', 'Basic document chat'],
    stripePriceId: null,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 19.99,
    description: 'For individuals getting serious',
    features: ['500 queries per month', '1GB storage', 'Full chat history', 'Priority email support'],
    stripePriceId: 'price_starter_monthly', // Replace with actual Stripe price ID
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 39.99,
    description: 'For power users and professionals',
    features: ['2,000 queries per month', '10GB storage', 'API access', 'Advanced analytics'],
    popular: true,
    stripePriceId: 'price_pro_monthly', // Replace with actual Stripe price ID
  },
  {
    id: 'team',
    name: 'Team',
    price: 99.99,
    description: 'For teams who need to collaborate',
    features: ['10,000 queries per month', '50GB storage', 'Up to 5 team members', 'Admin dashboard'],
    stripePriceId: 'price_team_monthly', // Replace with actual Stripe price ID
  },
];

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get('plan') || 'free';

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    organization: '',
    role: '',
    selectedPlan: initialPlan,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePlanSelect = (planId: string) => {
    setFormData(prev => ({ ...prev, selectedPlan: planId }));
  };

  const validateStep1 = () => {
    if (!formData.firstName || !formData.lastName) {
      setError('Please enter your full name');
      return false;
    }
    if (!formData.email || !formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.password || formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create user account
      const registerResponse = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.email.split('@')[0], // Use email prefix as username
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          organization: formData.organization,
          role: formData.role,
        }),
      });

      const registerData = await registerResponse.json();

      if (!registerResponse.ok) {
        throw new Error(registerData.error || 'Failed to create account');
      }

      // 2. If free plan, redirect to login
      if (formData.selectedPlan === 'free') {
        router.push('/auth?registered=true');
        return;
      }

      // 3. For paid plans, create Stripe checkout session
      const selectedPlanData = plans.find(p => p.id === formData.selectedPlan);
      if (!selectedPlanData?.stripePriceId) {
        // If no Stripe price ID, just redirect to login
        router.push('/auth?registered=true');
        return;
      }

      // Store token for authenticated request
      localStorage.setItem('accessToken', registerData.accessToken);

      const checkoutResponse = await fetch(`${API_BASE_URL}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${registerData.accessToken}`,
        },
        body: JSON.stringify({
          priceId: selectedPlanData.stripePriceId,
          successUrl: `${window.location.origin}/chat?subscription=success`,
          cancelUrl: `${window.location.origin}/pricing?canceled=true`,
        }),
      });

      const checkoutData = await checkoutResponse.json();

      if (checkoutData.url) {
        window.location.href = checkoutData.url;
      } else {
        // Fallback to login if checkout fails
        router.push('/auth?registered=true');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-12 md:py-20 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Create Your Account
          </h1>
          <p className="text-gray-400">
            Get started with EMTChat in minutes
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center font-semibold',
              step >= 1 ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400'
            )}>
              1
            </div>
            <div className={cn('w-16 h-1', step >= 2 ? 'bg-red-600' : 'bg-gray-700')} />
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center font-semibold',
              step >= 2 ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400'
            )}>
              2
            </div>
          </div>
        </div>

        {/* Step 1: Account Information */}
        {step === 1 && (
          <div className={cn(
            'rounded-2xl p-8',
            'bg-gray-900/80 backdrop-blur-sm',
            'border border-white/10',
          )}>
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <User className="h-5 w-5 text-red-500" />
              Account Information
            </h2>

            <form onSubmit={handleStep1Submit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="w-full h-11 px-4 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="w-full h-11 px-4 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Mail className="h-4 w-4 inline mr-1" />
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full h-11 px-4 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="john@example.com"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Lock className="h-4 w-4 inline mr-1" />
                    Password *
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    minLength={8}
                    className="w-full h-11 px-4 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
                    placeholder="Min 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    className="w-full h-11 px-4 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
                    placeholder="Confirm password"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Building2 className="h-4 w-4 inline mr-1" />
                    Organization
                  </label>
                  <input
                    type="text"
                    name="organization"
                    value={formData.organization}
                    onChange={handleInputChange}
                    className="w-full h-11 px-4 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
                    placeholder="EMS Department Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Your Role
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full h-11 px-4 bg-gray-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-red-500 transition-colors"
                  >
                    <option value="">Select your role</option>
                    <option value="emt-basic">EMT-Basic</option>
                    <option value="emt-advanced">EMT-Advanced</option>
                    <option value="paramedic">Paramedic</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="medical-director">Medical Director</option>
                    <option value="administrator">Administrator</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white text-base"
              >
                Continue to Plan Selection
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </form>
          </div>
        )}

        {/* Step 2: Plan Selection */}
        {step === 2 && (
          <div className={cn(
            'rounded-2xl p-8',
            'bg-gray-900/80 backdrop-blur-sm',
            'border border-white/10',
          )}>
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" />
              Choose Your Plan
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => handlePlanSelect(plan.id)}
                  className={cn(
                    'rounded-xl p-5 cursor-pointer transition-all',
                    'border-2',
                    formData.selectedPlan === plan.id
                      ? 'border-red-500 bg-red-500/10'
                      : 'border-white/10 hover:border-white/30',
                    plan.popular && 'relative',
                  )}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{plan.name}</h3>
                      <p className="text-sm text-gray-400">{plan.description}</p>
                    </div>
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                      formData.selectedPlan === plan.id
                        ? 'border-red-500 bg-red-500'
                        : 'border-gray-500',
                    )}>
                      {formData.selectedPlan === plan.id && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </div>
                  </div>
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-white">${plan.price}</span>
                    <span className="text-gray-400">/month</span>
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-gray-300">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-6">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1 h-12 border-white/20 text-white hover:bg-white/10"
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                onClick={handleFinalSubmit}
                className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Account...
                  </>
                ) : formData.selectedPlan === 'free' ? (
                  'Create Free Account'
                ) : (
                  <>
                    Continue to Payment
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>

            <p className="text-center text-sm text-gray-500 mt-6">
              By creating an account, you agree to our{' '}
              <a href="/terms" className="text-red-400 hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" className="text-red-400 hover:underline">Privacy Policy</a>
            </p>
          </div>
        )}

        {/* Already have an account */}
        <p className="text-center text-gray-400 mt-8">
          Already have an account?{' '}
          <a href="/auth" className="text-red-400 hover:underline font-medium">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}
