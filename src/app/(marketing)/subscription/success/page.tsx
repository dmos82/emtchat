'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowRight, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className={cn(
        'max-w-lg w-full rounded-2xl p-8 text-center',
        'bg-gray-900/80 backdrop-blur-sm',
        'border border-white/10',
      )}>
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">
          Payment Successful!
        </h1>

        <p className="text-gray-400 mb-6">
          Thank you for subscribing to EMTChat. Your account has been created and you now have access to all premium features.
        </p>

        <div className="bg-gray-800/50 rounded-xl p-4 mb-6 text-left">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-500" />
            What&apos;s Next?
          </h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Sign in with the username you created during signup</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>A confirmation email has been sent to your inbox</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Start chatting with your AI-powered EMS knowledge assistant</span>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => router.push('/auth')}
            className="w-full h-12 bg-red-600 hover:bg-red-700 text-white"
          >
            Sign In to Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>

          <p className="text-xs text-gray-500">
            Click above when you&apos;re ready to sign in
          </p>
        </div>

        {sessionId && (
          <p className="mt-6 text-xs text-gray-600 break-all">
            Transaction ID: {sessionId.slice(0, 25)}...
          </p>
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className={cn(
        'max-w-lg w-full rounded-2xl p-8 text-center',
        'bg-gray-900/80 backdrop-blur-sm',
        'border border-white/10',
      )}>
        <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto" />
        <p className="text-gray-400 mt-4">Loading...</p>
      </div>
    </div>
  );
}

export default function SubscriptionSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SuccessContent />
    </Suspense>
  );
}
