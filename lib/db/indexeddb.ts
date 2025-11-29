/**
 * IndexedDB Core Setup
 * 
 * Database structure for caching data locally
 * Improves performance and enables offline functionality
 */

import { logger } from '@/lib/utils/logger';

const DB_NAME = 'haumea-db';
const DB_VERSION = 1;

let cachedDB: IDBDatabase | null = null;

export interface DBSchema {
  models: {
    key: string;
    value: {
      id: string;
      data: unknown[];
      timestamp: number;
      version: string;
    };
  };
  messages: {
    key: string; // `${userId}_${chatId}`
    value: {
      userId: string;
      chatId: string;
      messages: unknown[];
      lastSync: number;
      version: number;
    };
  };
  chats: {
    key: string; // `${userId}_${chatId}`
    value: {
      userId: string;
      chatId: string;
      data: unknown;
      lastSync: number;
    };
  };
  folders: {
    key: string; // `${userId}_${folderId}`
    value: {
      userId: string;
      folderId: string;
      data: unknown;
      lastSync: number;
    };
  };
  userProfile: {
    key: string; // userId
    value: {
      uid: string;
      profile: unknown;
      lastSync: number;
    };
  };
  metadata: {
    key: string;
    value: {
      key: string;
      userId: string;
      chats: unknown[];
      folders: unknown[];
      lastSync: number;
    };
  };
}

/**
 * Delete and recreate the database (use when corrupted)
 */
function resetCachedConnection() {
  if (cachedDB) {
    try {
      cachedDB.close();
    } catch {
      // Connection may already be closed
    }
  }
  cachedDB = null;
  dbPromise = null;
}

export async function resetDB(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is not available in this environment');
  }

  return new Promise((resolve, reject) => {
    logger.log('Resetting IndexedDB...');
    const request = indexedDB.deleteDatabase(DB_NAME);
    
    request.onsuccess = () => {
      logger.log('Database deleted successfully');
      // Reset state
      resetCachedConnection();
      isDBCorrupted = false;
      resolve();
    };
    
    request.onerror = () => {
      logger.error('Error deleting database:', request.error);
      reject(request.error);
    };
    
    request.onblocked = () => {
      logger.warn('Database deletion blocked - please close all tabs');
      reject(new Error('Database deletion blocked'));
    };
  });
}

/**
 * Initialize IndexedDB database
 */
function attachDBEventHandlers(db: IDBDatabase) {
  db.onclose = () => {
    logger.warn('IndexedDB connection closed');
    resetCachedConnection();
  };

  db.onversionchange = () => {
    logger.warn('IndexedDB version change detected. Closing existing connection.');
    resetCachedConnection();
  };

  db.onabort = (event) => {
    logger.error('IndexedDB transaction aborted. Resetting connection.', event);
    resetCachedConnection();
  };

  db.onerror = (event) => {
    logger.error('IndexedDB connection error detected:', event);
  };
}

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      const error = request.error;
      logger.error('IndexedDB error:', error);
      
      // Check if it's a backing store error
      if (error?.message?.includes('backing store')) {
        logger.error('Backing store error detected - database may be corrupted');
        // Emit custom event for UI to catch
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('indexeddb-error', { 
            detail: { error, message: 'backing store error' } 
          }));
        }
      }
      
      reject(error);
    };

    request.onsuccess = () => {
      logger.log('IndexedDB initialized successfully');
      const db = request.result;
      cachedDB = db;
      attachDBEventHandlers(db);
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      
      // 1. Models store (OpenRouter models cache)
      if (!db.objectStoreNames.contains('models')) {
        const modelsStore = db.createObjectStore('models', { keyPath: 'id' });
        modelsStore.createIndex('timestamp', 'timestamp', { unique: false });
        logger.log('Created models object store');
      }

      // 2. Messages store (chat messages cache)
      if (!db.objectStoreNames.contains('messages')) {
        const messagesStore = db.createObjectStore('messages', { keyPath: 'id' });
        messagesStore.createIndex('userId', 'userId', { unique: false });
        messagesStore.createIndex('chatId', 'chatId', { unique: false });
        messagesStore.createIndex('lastSync', 'lastSync', { unique: false });
        logger.log('Created messages object store');
      }

      // 3. Chats store (individual chat metadata)
      if (!db.objectStoreNames.contains('chats')) {
        const chatsStore = db.createObjectStore('chats', { keyPath: 'id' });
        chatsStore.createIndex('userId', 'userId', { unique: false });
        chatsStore.createIndex('lastSync', 'lastSync', { unique: false });
        logger.log('Created chats object store');
      }

      // 4. Folders store (individual folder metadata)
      if (!db.objectStoreNames.contains('folders')) {
        const foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
        foldersStore.createIndex('userId', 'userId', { unique: false });
        foldersStore.createIndex('lastSync', 'lastSync', { unique: false });
        logger.log('Created folders object store');
      }

      // 5. User profile store
      if (!db.objectStoreNames.contains('userProfile')) {
        db.createObjectStore('userProfile', { keyPath: 'uid' });
        logger.log('Created userProfile object store');
      }

      // 6. Metadata store (combined chats and folders lists)
      if (!db.objectStoreNames.contains('metadata')) {
        const metadataStore = db.createObjectStore('metadata', { keyPath: 'key' });
        metadataStore.createIndex('userId', 'userId', { unique: false });
        metadataStore.createIndex('lastSync', 'lastSync', { unique: false });
        logger.log('Created metadata object store');
      }
    };
  });
}

/**
 * Get a database connection
 */
let dbPromise: Promise<IDBDatabase> | null = null;
let isDBCorrupted = false;
let isInitializing = false;

export async function getDB(): Promise<IDBDatabase> {
  if (isDBCorrupted) {
    return Promise.reject(new Error('IndexedDB is corrupted or unavailable'));
  }

  // Wait for ongoing initialization to prevent race conditions
  while (isInitializing) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  if (!dbPromise) {
    isInitializing = true;
    dbPromise = initDB()
      .catch((error) => {
        logger.error('Failed to initialize IndexedDB:', error);
        // Reset promise so we can try again
        dbPromise = null;
        
        // If it's a quota or backing store error, mark DB as corrupted
        if (error.name === 'UnknownError' || 
            error.message?.includes('backing store') ||
            error.message?.includes('quota')) {
          isDBCorrupted = true;
          logger.error('IndexedDB marked as corrupted - falling back to memory-only mode');
          
          // Emit custom event for UI to catch
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('indexeddb-error', { 
              detail: { error, message: 'Database corrupted' } 
            }));
          }
        }
        
        throw error;
      })
      .finally(() => {
        isInitializing = false;
      });
  }
  
  return dbPromise;
}

/**
 * Generic get operation
 */
export async function getItem<T>(
  storeName: keyof DBSchema,
  key: string
): Promise<T | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        logger.error(`Error getting item from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('getItem error:', error);
    return null;
  }
}

/**
 * Generic set operation
 */
export async function setItem<T>(
  storeName: keyof DBSchema,
  value: T
): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        logger.error(`Error setting item in ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('setItem error:', error);
    throw error;
  }
}

/**
 * Generic delete operation
 */
export async function deleteItem(
  storeName: keyof DBSchema,
  key: string
): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        logger.error(`Error deleting item from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('deleteItem error:', error);
    throw error;
  }
}

/**
 * Get all items from a store
 */
export async function getAllItems<T>(
  storeName: keyof DBSchema
): Promise<T[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        logger.error(`Error getting all items from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('getAllItems error:', error);
    return [];
  }
}

/**
 * Get items by index
 */
export async function getItemsByIndex<T>(
  storeName: keyof DBSchema,
  indexName: string,
  value: string | number
): Promise<T[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        logger.error(`Error getting items by index from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('getItemsByIndex error:', error);
    return [];
  }
}

/**
 * Clear all data from a store
 */
export async function clearStore(storeName: keyof DBSchema): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        logger.log(`Cleared ${storeName} store`);
        resolve();
      };

      request.onerror = () => {
        logger.error(`Error clearing ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('clearStore error:', error);
    throw error;
  }
}

/**
 * Clear all data from the database
 */
export async function clearAllData(): Promise<void> {
  try {
    const stores: (keyof DBSchema)[] = [
      'models',
      'messages',
      'chats',
      'folders',
      'userProfile',
      'metadata',
    ];

    for (const store of stores) {
      await clearStore(store);
    }

    logger.log('All IndexedDB data cleared');
  } catch (error) {
    logger.error('Error clearing all data:', error);
    throw error;
  }
}

/**
 * Check if data is stale based on TTL
 */
export function isStale(timestamp: number, ttlMs: number): boolean {
  return Date.now() - timestamp > ttlMs;
}

/**
 * TTL constants (in milliseconds)
 * Otimizado: TTLs mais longos para reduzir queries ao Firestore
 */
export const TTL = {
  MODELS: 2 * 60 * 60 * 1000,      // 2 horas (reduzido para capturar novos modelos mais rapidamente)
  MESSAGES: 15 * 60 * 1000,        // 15 minutos (era 30 min, mas com invalidação inteligente)
  CHATS_METADATA: 30 * 60 * 1000,  // 30 minutos (era 5 min - muito curto!)
  USER_PROFILE: 60 * 60 * 1000,    // 1 hora (era 15 min)
} as const;
