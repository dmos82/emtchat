'use client';

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Hook to detect mobile viewport (<768px)
 * Uses window.matchMedia for efficient detection
 */
export function useMobileLayout() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check initial state
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsMobile(mediaQuery.matches);

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return {
    isMobile,
    isDesktop: !isMobile,
    MOBILE_BREAKPOINT,
  };
}
