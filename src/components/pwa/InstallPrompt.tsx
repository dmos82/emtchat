'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'emtchat-pwa-install-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function InstallPrompt() {
  // Disabled - user requested no install prompts
  return null;

  /* Original implementation preserved for future use:
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Check if iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < DISMISS_DURATION) {
        return; // Still within dismiss period
      }
      localStorage.removeItem(DISMISS_KEY);
    }

    // Listen for beforeinstallprompt (Chrome, Edge, etc.)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Delay showing prompt for better UX (show after 5s of engagement)
      setTimeout(() => setShowPrompt(true), 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, show instructions after delay
    if (ios && !standalone) {
      setTimeout(() => setShowPrompt(true), 5000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setShowPrompt(false);
        setDeferredPrompt(null);
      }
    } catch (error) {
      console.error('Install prompt error:', error);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }, []);

  // Don't show if already installed or no prompt available (and not iOS)
  if (isStandalone || (!showPrompt)) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md',
        'rounded-lg border border-yellow-500/30 bg-background/95 backdrop-blur-sm',
        'shadow-lg shadow-yellow-500/10',
        'animate-in slide-in-from-bottom-4 duration-300'
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-500/20">
            <Download className="h-5 w-5 text-yellow-500" />
          </div>

          <div className="flex-1 space-y-2">
            <h3 className="font-semibold text-foreground">Install EMTChat App</h3>

            {isIOS ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Add to your home screen for the best experience:
                </p>
                <ol className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li className="flex items-center gap-2">
                    <span className="font-medium text-yellow-500">1.</span>
                    Tap the Share button <Share className="inline h-4 w-4 text-yellow-500" /> below
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-medium text-yellow-500">2.</span>
                    Scroll and tap <Plus className="inline h-4 w-4" /> <span className="font-medium">Add to Home Screen</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-medium text-yellow-500">3.</span>
                    Tap <span className="font-medium">Add</span> in the top right
                  </li>
                </ol>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Install for quick access from your home screen
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>

        {!isIOS && deferredPrompt && (
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleDismiss}
            >
              Not now
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-yellow-500 text-black hover:bg-yellow-600"
              onClick={handleInstall}
            >
              Install
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

*/
}

export default InstallPrompt;
