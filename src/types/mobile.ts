import type { LucideIcon } from 'lucide-react';

/**
 * Mobile tab navigation types
 */
export type MobileTab = 'chat' | 'messages' | 'notes' | 'canvas' | 'files';

export interface MobileTabConfig {
  id: MobileTab;
  label: string;
  icon: LucideIcon;
}

export interface MobileLayoutState {
  activeTab: MobileTab;
  isMobile: boolean;
}

export interface MobileTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  className?: string;
}

export interface MobileTabPanelProps {
  id: MobileTab;
  activeTab: MobileTab;
  children: React.ReactNode;
  className?: string;
}
