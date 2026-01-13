'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { MobileTabPanelProps } from '@/types/mobile';

/**
 * Full-screen panel wrapper for mobile tab content
 * Only renders children when active (performance optimization)
 */
export function MobileTabPanel({
  id,
  activeTab,
  children,
  className,
}: MobileTabPanelProps) {
  const isActive = id === activeTab;

  if (!isActive) {
    return null;
  }

  return (
    <div
      className={cn(
        'md:hidden', // Only visible on mobile
        'fixed inset-0 top-0 bottom-16',
        'overflow-y-auto',
        'bg-background',
        'animate-in fade-in-0 duration-200',
        'pb-safe',
        'z-30', // Below tab bar (z-40)
        className
      )}
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
    >
      {children}
    </div>
  );
}
