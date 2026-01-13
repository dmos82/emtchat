'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { IMContainer } from './IMContainer';

/**
 * Wrapper that only renders IMContainer for authenticated users on desktop.
 * On mobile (<768px), this returns null - mobile IM is handled by MobileTabPanel in page.tsx.
 *
 * CRITICAL: We must NOT mount IMContainer on mobile because:
 * 1. It has its own VoiceVideoCallProvider which would duplicate socket listeners
 * 2. Its IncomingCallModal would play ringtone even though it's visually hidden
 * 3. This caused the "dual ringtone" bug where audio continued after accepting calls
 */
export const AuthenticatedIMContainer: React.FC = () => {
  const { user, loading } = useAuth();
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  // Detect mobile on client side
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkMobile();

    // Listen for resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Don't render anything while checking auth or if not logged in
  if (loading || !user) {
    return null;
  }

  // Don't render on mobile - prevents duplicate VoiceVideoCallProvider/IncomingCallModal
  // Mobile IM is handled by page.tsx's MobileTabPanel with its own providers
  if (isMobile === null) {
    // Still determining - render nothing to avoid flash
    return null;
  }

  if (isMobile) {
    return null;
  }

  // Desktop only - render IMContainer
  return <IMContainer />;
};

export default AuthenticatedIMContainer;
