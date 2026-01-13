/**
 * Service Worker Registration Utility
 * Handles SW registration, updates, and lifecycle
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // Only register in browser environment
  if (typeof window === 'undefined') {
    return null;
  }

  // Check for service worker support
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers are not supported');
    return null;
  }

  // Only register in production (or allow in development with flag)
  const isDev = process.env.NODE_ENV === 'development';
  const forceSW = process.env.NEXT_PUBLIC_FORCE_SW === 'true';

  if (isDev && !forceSW) {
    console.log('[SW] Skipping service worker in development');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    console.log('[SW] Service worker registered successfully');

    // Check for updates immediately
    registration.update();

    // Check for updates every hour
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        console.log('[SW] New service worker installing...');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] New service worker installed, update available');
            // The UpdatePrompt component will handle showing the UI
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('[SW] Service worker registration failed:', error);
    return null;
  }
}

export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const result = await registration.unregister();
      console.log('[SW] Service worker unregistered:', result);
      return result;
    }
    return false;
  } catch (error) {
    console.error('[SW] Failed to unregister service worker:', error);
    return false;
  }
}

export async function checkForServiceWorkerUpdate(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
      console.log('[SW] Checked for updates');
    }
  } catch (error) {
    console.error('[SW] Failed to check for updates:', error);
  }
}
