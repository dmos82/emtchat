/**
 * Push Notification Infrastructure
 * STUB - Ready for future activation when backend support is added
 *
 * Requirements for full activation:
 * 1. Generate VAPID keys on backend
 * 2. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY environment variable
 * 3. Create /api/push/subscribe endpoint
 * 4. Implement push sending on backend
 */

// VAPID public key - set this when ready to enable push
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Check current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isPushSupported()) return 'unsupported';

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Subscribe to push notifications
 * STUB - Returns null until VAPID key is configured
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.log('[Push] Not supported');
    return null;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.log('[Push] VAPID public key not configured');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Create new subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Send subscription to backend
      await sendSubscriptionToServer(subscription);
    }

    return subscription;
  } catch (error) {
    console.error('[Push] Subscription failed:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await removeSubscriptionFromServer(subscription);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Push] Unsubscribe failed:', error);
    return false;
  }
}

/**
 * Get current push subscription
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('[Push] Failed to get subscription:', error);
    return null;
  }
}

/**
 * Send subscription to backend
 * STUB - Implement when backend endpoint is ready
 */
async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  // TODO: Implement when /api/push/subscribe endpoint is ready
  console.log('[Push] Would send subscription to server:', subscription.endpoint);

  // Example implementation:
  // const response = await fetch('/api/push/subscribe', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(subscription.toJSON()),
  // });
  // if (!response.ok) throw new Error('Failed to save subscription');
}

/**
 * Remove subscription from backend
 * STUB - Implement when backend endpoint is ready
 */
async function removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
  // TODO: Implement when /api/push/unsubscribe endpoint is ready
  console.log('[Push] Would remove subscription from server:', subscription.endpoint);

  // Example implementation:
  // await fetch('/api/push/unsubscribe', {
  //   method: 'DELETE',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ endpoint: subscription.endpoint }),
  // });
}

/**
 * Convert VAPID key from URL-safe base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Documentation for backend implementation:
 *
 * 1. Generate VAPID keys:
 *    npx web-push generate-vapid-keys
 *
 * 2. Environment variables:
 *    - VAPID_PUBLIC_KEY (backend + frontend as NEXT_PUBLIC_VAPID_PUBLIC_KEY)
 *    - VAPID_PRIVATE_KEY (backend only)
 *    - VAPID_SUBJECT (e.g., mailto:admin@goldkeyinsurance.com)
 *
 * 3. Backend endpoints needed:
 *    - POST /api/push/subscribe - Save push subscription
 *    - DELETE /api/push/unsubscribe - Remove subscription
 *    - POST /api/push/send - Send push to specific user (internal)
 *
 * 4. Database schema for subscriptions:
 *    {
 *      userId: ObjectId,
 *      endpoint: string,
 *      keys: {
 *        p256dh: string,
 *        auth: string
 *      },
 *      createdAt: Date,
 *      userAgent: string
 *    }
 */
