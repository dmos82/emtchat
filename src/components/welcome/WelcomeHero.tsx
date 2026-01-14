'use client';

import React from 'react';
import { CheckCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WelcomeHeroProps {
  tierName: string;
  userName?: string;
}

export function WelcomeHero({ tierName, userName }: WelcomeHeroProps) {
  return (
    <div className={cn(
      'rounded-2xl p-8 text-center relative overflow-hidden',
      'bg-gradient-to-br from-green-500/20 via-emerald-500/10 to-teal-500/20',
      'border border-green-500/30',
    )}>
      {/* Decorative sparkles */}
      <Sparkles className="absolute top-4 right-4 h-6 w-6 text-green-400/50 animate-pulse" />
      <Sparkles className="absolute bottom-4 left-4 h-5 w-5 text-emerald-400/40 animate-pulse delay-300" />

      <div className="relative z-10">
        {/* Success icon */}
        <div className="w-20 h-20 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </div>

        {/* Welcome message */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome{userName ? `, ${userName}` : ''}!
        </h1>

        <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
          Your <span className="font-semibold text-green-600 dark:text-green-400">{tierName}</span> plan is now active
        </p>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          You&apos;re all set to start using EMTChat. Here&apos;s what you can do now.
        </p>
      </div>
    </div>
  );
}
