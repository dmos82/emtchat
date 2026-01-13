'use client';

import React, { useEffect, useRef } from 'react';
import { useHelp } from '@/contexts/HelpContext';
import { Keyboard } from 'lucide-react';

/**
 * HelpPanel - A mouse-following tooltip like Logic Pro X Quick Help
 *
 * Displays contextual help information near the mouse cursor when hovering
 * over elements with data-help-id attributes.
 */
export const HelpPanel: React.FC = () => {
  const { isHelpModeEnabled, activeHelpId, getHelpContent, setActiveHelpId } = useHelp();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });

  // Get the current help content
  const helpItem = activeHelpId ? getHelpContent(activeHelpId) : null;

  // Update tooltip position directly via DOM (no state updates = no re-renders = no flicker)
  const updateTooltipPosition = (mouseX: number, mouseY: number) => {
    if (!tooltipRef.current) return;

    const padding = 16;
    const offsetX = 20;
    const offsetY = 20;
    const tooltipWidth = tooltipRef.current.offsetWidth || 280;
    const tooltipHeight = tooltipRef.current.offsetHeight || 100;

    let x = mouseX + offsetX;
    let y = mouseY + offsetY;

    if (x + tooltipWidth > window.innerWidth - padding) {
      x = mouseX - tooltipWidth - offsetX;
    }
    if (y + tooltipHeight > window.innerHeight - padding) {
      y = mouseY - tooltipHeight - offsetY;
    }

    x = Math.max(padding, x);
    y = Math.max(padding, y);

    tooltipRef.current.style.left = `${x}px`;
    tooltipRef.current.style.top = `${y}px`;
  };

  // Track mouse position
  useEffect(() => {
    if (!isHelpModeEnabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
      updateTooltipPosition(e.clientX, e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isHelpModeEnabled]);

  // Position tooltip when it becomes visible
  useEffect(() => {
    if (helpItem && tooltipRef.current) {
      // Position immediately at current mouse location
      updateTooltipPosition(mousePositionRef.current.x, mousePositionRef.current.y);
    }
  }, [helpItem]);

  // Set up global mouseover listener for help mode
  useEffect(() => {
    if (!isHelpModeEnabled) return;

    let currentHelpId: string | null = null;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      mousePositionRef.current = { x: e.clientX, y: e.clientY };

      const helpElement = target.closest('[data-help-id]') as HTMLElement;

      if (helpElement) {
        const helpId = helpElement.getAttribute('data-help-id');
        if (helpId && helpId !== currentHelpId) {
          currentHelpId = helpId;
          setActiveHelpId(helpId);
        }
      } else if (currentHelpId) {
        currentHelpId = null;
        setActiveHelpId(null);
      }
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    return () => document.removeEventListener('mouseover', handleMouseOver, true);
  }, [isHelpModeEnabled, setActiveHelpId]);

  // Category badge color (using Tailwind design system colors)
  const getCategoryBadge = (category?: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      chat: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Chat' },
      documents: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Documents' },
      navigation: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Navigation' },
      im: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Messaging' },
      admin: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Admin' },
      general: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: 'General' },
    };
    return badges[category || 'general'] || badges.general;
  };

  if (!isHelpModeEnabled || !helpItem) {
    return null;
  }

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        left: -1000,
        top: -1000,
        zIndex: 10000,
      }}
      className="pointer-events-none max-w-xs"
    >
      {/* Tooltip content - matches UI theme */}
      <div className="bg-card dark:bg-zinc-800 border border-border dark:border-zinc-700 rounded-lg shadow-xl overflow-hidden">
        {/* Category badge */}
        {helpItem.category && (
          <div className="px-3 pt-2">
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${getCategoryBadge(helpItem.category).bg} ${getCategoryBadge(helpItem.category).text}`}>
              {getCategoryBadge(helpItem.category).label}
            </span>
          </div>
        )}

        {/* Title and description */}
        <div className="px-3 py-2">
          <h3 className="text-sm font-semibold text-foreground dark:text-zinc-100 mb-1">
            {helpItem.title}
          </h3>
          <p className="text-xs text-muted-foreground dark:text-zinc-400 leading-relaxed">
            {helpItem.description}
          </p>

          {/* Keyboard shortcut */}
          {helpItem.shortcut && (
            <div className="mt-2 pt-2 border-t border-border dark:border-zinc-700 flex items-center gap-1.5 text-xs text-muted-foreground dark:text-zinc-500">
              <Keyboard className="w-3 h-3" />
              <span>{helpItem.shortcut}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HelpPanel;
