'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const online = navigator.onLine;
    setIsOnline(online);

    // If already online when page loads, redirect immediately
    if (online) {
      window.location.href = '/';
      return;
    }

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-redirect when back online
      window.location.href = '/';
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500/20">
          <WifiOff className="h-10 w-10 text-yellow-500" />
        </div>

        <h1 className="mb-2 text-2xl font-bold text-foreground">
          You&apos;re Offline
        </h1>

        <p className="mb-6 text-muted-foreground">
          EMTChat requires an internet connection to sync your messages and documents.
        </p>

        {isOnline ? (
          <p className="mb-6 text-sm text-green-500">
            Connection restored! Redirecting...
          </p>
        ) : (
          <div className="space-y-4">
            <Button
              onClick={handleRetry}
              className="w-full bg-yellow-500 text-black hover:bg-yellow-600"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>

            <p className="text-xs text-muted-foreground">
              Your cached messages will be available when you reconnect.
            </p>
          </div>
        )}
      </div>

      {/* EMTChat branding */}
      <div className="absolute bottom-4 text-center text-xs text-muted-foreground">
        <p>EMTChat - EMTChat</p>
      </div>
    </div>
  );
}
