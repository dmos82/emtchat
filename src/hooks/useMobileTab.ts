'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MobileTab } from '@/types/mobile';

const STORAGE_KEY = 'emtchat_mobile_tab';
const DEFAULT_TAB: MobileTab = 'chat';

const VALID_TABS: MobileTab[] = ['chat', 'messages', 'notes', 'canvas', 'files'];

function isValidTab(tab: string): tab is MobileTab {
  return VALID_TABS.includes(tab as MobileTab);
}

/**
 * Hook to manage mobile tab state with localStorage persistence
 */
export function useMobileTab() {
  const [activeTab, setActiveTab] = useState<MobileTab>(DEFAULT_TAB);

  // Load saved tab on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && isValidTab(saved)) {
        setActiveTab(saved);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  // Switch tab and persist to localStorage
  const switchTab = useCallback((tab: MobileTab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem(STORAGE_KEY, tab);
    } catch {
      // localStorage not available
    }
  }, []);

  return {
    activeTab,
    switchTab,
    isChat: activeTab === 'chat',
    isMessages: activeTab === 'messages',
    isNotes: activeTab === 'notes',
    isCanvas: activeTab === 'canvas',
    isFiles: activeTab === 'files',
  };
}
