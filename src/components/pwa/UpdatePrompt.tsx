'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function UpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleControllerChange = () => {
      // New service worker has taken control, reload the page
      window.location.reload();
    };

    const checkForUpdate = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdate(true);
        }

        // Listen for new service worker waiting
        registration?.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setShowUpdate(true);
              }
            });
          }
        });
      } catch (error) {
        console.error('Service worker check failed:', error);
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    checkForUpdate();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      // Tell the waiting service worker to skip waiting and take control
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md',
        'rounded-lg border border-blue-500/30 bg-background/95 backdrop-blur-sm',
        'shadow-lg shadow-blue-500/10',
        'animate-in slide-in-from-bottom-4 duration-300'
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/20">
            <RefreshCw className="h-5 w-5 text-blue-500" />
          </div>

          <div className="flex-1 space-y-1">
            <h3 className="font-semibold text-foreground">Update Available</h3>
            <p className="text-sm text-muted-foreground">
              A new version of EMTChat is ready
            </p>
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

        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleDismiss}
          >
            Later
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-blue-500 text-white hover:bg-blue-600"
            onClick={handleUpdate}
          >
            Update now
          </Button>
        </div>
      </div>
    </div>
  );
}

export default UpdatePrompt;
