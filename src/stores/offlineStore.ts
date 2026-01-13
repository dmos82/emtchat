import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// IndexedDB storage adapter for Zustand
const indexedDBStorage = {
  name: 'emtchat-offline-store',
  getItem: async (name: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('emtchat-pwa', 1);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('offline-store')) {
          db.createObjectStore('offline-store');
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('offline-store', 'readonly');
        const store = transaction.objectStore('offline-store');
        const getRequest = store.get(name);

        getRequest.onerror = () => {
          db.close();
          reject(getRequest.error);
        };

        getRequest.onsuccess = () => {
          db.close();
          resolve(getRequest.result || null);
        };
      };
    });
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('emtchat-pwa', 1);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('offline-store')) {
          db.createObjectStore('offline-store');
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('offline-store', 'readwrite');
        const store = transaction.objectStore('offline-store');
        const putRequest = store.put(value, name);

        putRequest.onerror = () => {
          db.close();
          reject(putRequest.error);
        };

        putRequest.onsuccess = () => {
          db.close();
          resolve();
        };
      };
    });
  },

  removeItem: async (name: string): Promise<void> => {
    if (typeof window === 'undefined') return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('emtchat-pwa', 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('offline-store', 'readwrite');
        const store = transaction.objectStore('offline-store');
        const deleteRequest = store.delete(name);

        deleteRequest.onerror = () => {
          db.close();
          reject(deleteRequest.error);
        };

        deleteRequest.onsuccess = () => {
          db.close();
          resolve();
        };
      };
    });
  },
};

export interface OfflineMessage {
  id: string;
  content: string;
  timestamp: number;
  conversationId: string;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  attachments?: string[];
}

interface OfflineStore {
  messages: OfflineMessage[];
  isSyncing: boolean;
  lastSyncTime: number | null;

  // Actions
  addMessage: (message: Omit<OfflineMessage, 'id' | 'status' | 'retryCount'>) => void;
  updateStatus: (id: string, status: OfflineMessage['status']) => void;
  removeMessage: (id: string) => void;
  incrementRetry: (id: string) => void;
  clearMessages: () => void;
  syncMessages: () => Promise<void>;
}

const MAX_RETRIES = 5;
const RETRY_DELAY_BASE = 1000; // 1 second

export const useOfflineStore = create<OfflineStore>()(
  persist(
    (set, get) => ({
      messages: [],
      isSyncing: false,
      lastSyncTime: null,

      addMessage: (message) => {
        const newMessage: OfflineMessage = {
          ...message,
          id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          status: 'pending',
          retryCount: 0,
        };

        set((state) => ({
          messages: [...state.messages, newMessage],
        }));
      },

      updateStatus: (id, status) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, status } : msg
          ),
        }));
      },

      removeMessage: (id) => {
        set((state) => ({
          messages: state.messages.filter((msg) => msg.id !== id),
        }));
      },

      incrementRetry: (id) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, retryCount: msg.retryCount + 1 } : msg
          ),
        }));
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      syncMessages: async () => {
        const { messages, updateStatus, removeMessage, incrementRetry } = get();

        if (!navigator.onLine) {
          console.log('[OfflineStore] No internet connection, skipping sync');
          return;
        }

        const pendingMessages = messages.filter(
          (msg) => msg.status === 'pending' || msg.status === 'failed'
        );

        if (pendingMessages.length === 0) {
          console.log('[OfflineStore] No messages to sync');
          return;
        }

        set({ isSyncing: true });

        for (const message of pendingMessages) {
          if (message.retryCount >= MAX_RETRIES) {
            console.log(`[OfflineStore] Max retries reached for ${message.id}`);
            continue;
          }

          try {
            updateStatus(message.id, 'syncing');

            // TODO: Replace with actual API call
            const response = await fetch('/api/chat/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: message.content,
                conversationId: message.conversationId,
              }),
            });

            if (response.ok) {
              removeMessage(message.id);
              console.log(`[OfflineStore] Synced message ${message.id}`);
            } else {
              throw new Error(`HTTP ${response.status}`);
            }
          } catch (error) {
            console.error(`[OfflineStore] Failed to sync ${message.id}:`, error);
            incrementRetry(message.id);
            updateStatus(message.id, 'failed');

            // Exponential backoff delay before next retry
            const delay = Math.min(
              RETRY_DELAY_BASE * Math.pow(2, message.retryCount),
              60000 // Max 1 minute
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        set({
          isSyncing: false,
          lastSyncTime: Date.now(),
        });
      },
    }),
    {
      name: 'emtchat-offline-messages',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({
        messages: state.messages,
        lastSyncTime: state.lastSyncTime,
      }),
    }
  )
);

// Auto-sync when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineStore] Back online, triggering sync');
    useOfflineStore.getState().syncMessages();
  });
}

export default useOfflineStore;
