'use client';

import React from 'react';
import { MessageSquare, Users, FileText, Code2, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MobileTab, MobileTabConfig, MobileTabBarProps } from '@/types/mobile';

const TABS: MobileTabConfig[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'messages', label: 'Messages', icon: Users },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'canvas', label: 'Canvas', icon: Code2 },
  { id: 'files', label: 'Files', icon: FolderOpen },
];

/**
 * Mobile bottom tab navigation bar
 * Only visible on mobile (<768px)
 */
export function MobileTabBar({ activeTab, onTabChange, className }: MobileTabBarProps) {
  return (
    <nav
      className={cn(
        'md:hidden fixed bottom-0 left-0 right-0 z-[100]',
        'bg-background border-t border-border',
        'flex justify-around items-center',
        'shadow-lg',
        className
      )}
      style={{
        height: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      role="navigation"
      aria-label="Mobile navigation"
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              'flex flex-col items-center justify-center',
              'flex-1 h-full min-w-[64px]',
              'transition-colors duration-200',
              'active:scale-95',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            {/* Active indicator */}
            {isActive && (
              <span className="absolute top-0 w-12 h-0.5 bg-primary rounded-b" />
            )}
            <Icon className="h-6 w-6" />
            <span className="text-xs font-medium mt-1">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
