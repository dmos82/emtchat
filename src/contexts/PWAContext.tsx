'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { registerServiceWorker } from '@/lib/service-worker/register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  isUpdateAvailable: boolean;
  isOnline: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  promptInstall: () => Promise<boolean>;
  dismissInstall: () => void;
  applyUpdate: () => void;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

const DISMISS_KEY = 'emtchat-pwa-install-dismissed';

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Set initial online state
    setIsOnline(navigator.onLine);

    // Check if already installed
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    // Online/offline handlers
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Install prompt handler
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // App installed handler
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    // Register service worker and listen for updates
    registerServiceWorker().then((registration) => {
      if (!registration) return;

      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setIsUpdateAvailable(true);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
              setIsUpdateAvailable(true);
            }
          });
        }
      });
    });

    // Handle controller change (page reload after update)
    const handleControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallable(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Install prompt error:', error);
      return false;
    }
  }, [deferredPrompt]);

  const dismissInstall = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsInstallable(false);
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [waitingWorker]);

  const value: PWAContextType = {
    isInstallable,
    isInstalled,
    isUpdateAvailable,
    isOnline,
    deferredPrompt,
    promptInstall,
    dismissInstall,
    applyUpdate,
  };

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
}

export function usePWA() {
  const context = useContext(PWAContext);
  if (context === undefined) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
}

export default PWAContext;
