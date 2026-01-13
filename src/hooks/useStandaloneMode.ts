'use client';
import { useState, useEffect } from 'react';

/**
 * Detects if the app is running in PWA standalone mode
 * Returns true when installed as PWA, false in browser
 *
 * Use cases:
 * - Hide "Install App" prompts when already installed
 * - Adjust UI for full-screen mode (no browser chrome)
 * - Add custom back button navigation (no browser back)
 */
export function useStandaloneMode() {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check display-mode media query
    const mediaQuery = window.matchMedia('(display-mode: standalone)');

    // Also check iOS Safari standalone mode
    const isIOSStandalone = 'standalone' in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsStandalone(mediaQuery.matches || isIOSStandalone);

    // Listen for changes (e.g., user installs PWA while using)
    const handleChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches || isIOSStandalone);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isStandalone;
}
