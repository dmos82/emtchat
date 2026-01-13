'use client';
import { useState, useEffect } from 'react';

/**
 * Detects keyboard height on mobile devices using visualViewport API
 * Returns 0 when keyboard is hidden, height in pixels when visible
 */
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Use visualViewport API for keyboard detection
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      // Calculate difference between window height and visual viewport height
      // If difference > 100px, assume keyboard is open
      const heightDiff = window.innerHeight - viewport.height;
      setKeyboardHeight(heightDiff > 100 ? heightDiff : 0);
    };

    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, []);

  return keyboardHeight;
}
