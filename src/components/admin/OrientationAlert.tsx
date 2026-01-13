'use client';

import { useState, useEffect } from 'react';
import { RotateCw, X } from 'lucide-react';

export function OrientationAlert() {
  const [dismissed, setDismissed] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isPortrait = window.matchMedia('(orientation: portrait)').matches;
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      setIsPortraitMobile(isPortrait && isMobile);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (dismissed || !isPortraitMobile) return null;

  return (
    <div className="bg-muted border-b p-2 flex items-center justify-center gap-2 text-sm">
      <RotateCw className="h-4 w-4 animate-pulse" />
      <span>Rotate device for better view</span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 p-1 hover:bg-background rounded"
        aria-label="Dismiss orientation alert"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
