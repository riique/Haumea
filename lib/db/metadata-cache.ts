/**
 * Metadata Cache (Chats and Folders)
 * 
 * Caches chat and folder metadata in IndexedDB
 * for instant dashboard loading
 */

import { getItem, setItem, deleteItem, isStale, TTL } from './indexeddb';
import { Chat, Folder } from '@/types/chat';
import { logger } from '@/lib/utils/logger';

interface MetadataCacheEntry {
  key: string; // `metadata_${userId}`
  userId: string;
  chats: Chat[];
  folders: Folder[];
  lastSync: number;
}

/**
 * Generate cache key for metadata
 */
function getCacheKey(userId: string): string {
  return `metadata_${userId}`;
}

/**
 * Deserialize dates in chats
 */
function deserializeChat(chat: Chat): Chat {
  return {
    ...chat,
    createdAt: new Date(chat.createdAt),
    lastMessageAt: new Date(chat.lastMessageAt),
    memories: chat.memories?.map(mem => ({
      ...mem,
      createdAt: new Date(mem.createdAt),
    })),
  };
}

/**
 * Deserialize dates in folders (recursive for subfolders)
 */
function deserializeFolder(folder: Folder): Folder {
  return {
    ...folder,
    createdAt: new Date(folder.createdAt),
    chats: folder.chats.map(deserializeChat),
    subfolders: folder.subfolders?.map(deserializeFolder),
  };
}

/**
 * Get cached metadata (chats and folders)
 */
export async function getCachedMetadata(userId: string): Promise<{
  chats: Chat[];
  folders: Folder[];
} | null> {
  try {
    const cacheKey = getCacheKey(userId);
    const cached = await getItem<MetadataCacheEntry>('metadata', cacheKey);
    
    if (!cached) {
      logger.log(`No cached metadata for user ${userId}`);
      return null;
    }

    // Check if cache is stale
    if (isStale(cached.lastSync, TTL.CHATS_METADATA)) {
      logger.log(`Cached metadata for user ${userId} is stale`);
      return null;
    }

    // Deserialize dates
    const chats = cached.chats.map(deserializeChat);
    const folders = cached.folders.map(deserializeFolder);

    logger.log(`Loaded cached metadata: ${chats.length} chats, ${folders.length} folders`);
    return { chats, folders };
  } catch (error) {
    logger.error('Error getting cached metadata:', error);
    return null;
  }
}

/**
 * Save metadata to cache
 */
export async function setCachedMetadata(
  userId: string,
  chats: Chat[],
  folders: Folder[]
): Promise<void> {
  try {
    const cacheKey = getCacheKey(userId);
    const cacheEntry: MetadataCacheEntry = {
      key: cacheKey,
      userId,
      chats,
      folders,
      lastSync: Date.now(),
    };

    await setItem('metadata', cacheEntry);
    logger.log(`Cached metadata: ${chats.length} chats, ${folders.length} folders`);
  } catch (error) {
    logger.error('Error caching metadata:', error);
    // Don't throw - caching is optional
  }
}

/**
 * Delete cached metadata
 */
export async function deleteCachedMetadata(userId: string): Promise<void> {
  try {
    const cacheKey = getCacheKey(userId);
    await deleteItem('metadata', cacheKey);
    logger.log(`Deleted cached metadata for user ${userId}`);
  } catch (error) {
    logger.error('Error deleting cached metadata:', error);
  }
}

/**
 * Load chats and folders with caching strategy
 */
export async function loadMetadataWithCache(
  userId: string,
  fetchChats: () => Promise<Chat[]>,
  fetchFolders: () => Promise<Folder[]>
): Promise<{
  chats: Chat[];
  folders: Folder[];
  fromCache: boolean;
}> {
  // Try cache first
  const cachedMetadata = await getCachedMetadata(userId);
  
  if (cachedMetadata) {
    // Return cached data immediately
    // NO background refresh - cache is only updated on explicit invalidation
    // This prevents race conditions where fresh data is overwritten by stale cache refreshes
    return { ...cachedMetadata, fromCache: true };
  }

  // No cache or stale - fetch from Firestore
  try {
    const [freshChats, freshFolders] = await Promise.all([
      fetchChats(),
      fetchFolders(),
    ]);
    
    // CRITICAL: Check if cache was updated while we were fetching
    // Only update cache if it hasn't been modified by another operation
    const currentCache = await getItem<MetadataCacheEntry>('metadata', getCacheKey(userId));
    
    if (!currentCache || currentCache.lastSync <= Date.now() - 5000) {
      // Cache is still stale or doesn't exist - safe to update
      await setCachedMetadata(userId, freshChats, freshFolders);
    } else {
      // Cache was updated during fetch (e.g., by updateCachedChat/updateCachedFolder)
      // Don't overwrite newer data with stale fetch results
      logger.log(`Metadata cache was updated during fetch for user ${userId} - keeping newer cache`);
    }
    
    return {
      chats: freshChats,
      folders: freshFolders,
      fromCache: false,
    };
  } catch (error) {
    logger.error('Error fetching metadata:', error);
    throw error;
  }
}

/**
 * Update a single chat in cache
 */
export async function updateCachedChat(
  userId: string,
  chatId: string,
  updates: Partial<Chat>
): Promise<void> {
  try {
    const cached = await getCachedMetadata(userId);
    if (!cached) return;

    const updatedChats = cached.chats.map(chat =>
      chat.id === chatId ? { ...chat, ...updates } : chat
    );

    await setCachedMetadata(userId, updatedChats, cached.folders);
    logger.log(`Updated cached chat ${chatId}`);
  } catch (error) {
    logger.error('Error updating cached chat:', error);
  }
}

/**
 * Update a single folder in cache
 */
export async function updateCachedFolder(
  userId: string,
  folderId: string,
  updates: Partial<Folder>
): Promise<void> {
  try {
    const cached = await getCachedMetadata(userId);
    if (!cached) return;

    const updateFolderRecursive = (folders: Folder[]): Folder[] => {
      return folders.map(folder => {
        if (folder.id === folderId) {
          return { ...folder, ...updates };
        }
        if (folder.subfolders) {
          return {
            ...folder,
            subfolders: updateFolderRecursive(folder.subfolders),
          };
        }
        return folder;
      });
    };

    const updatedFolders = updateFolderRecursive(cached.folders);
    await setCachedMetadata(userId, cached.chats, updatedFolders);
    logger.log(`Updated cached folder ${folderId}`);
  } catch (error) {
    logger.error('Error updating cached folder:', error);
  }
}

/**
 * Invalidate metadata cache (force refresh on next request)
 */
export async function invalidateMetadataCache(userId: string): Promise<void> {
  await deleteCachedMetadata(userId);
}
