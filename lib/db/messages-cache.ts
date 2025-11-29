/**
 * Messages Cache
 * 
 * Caches chat messages in IndexedDB for fast loading
 * and offline access
 */

import { getItem, setItem, deleteItem, getItemsByIndex, isStale, TTL } from './indexeddb';
import { Message } from '@/types/chat';
import { logger } from '@/lib/utils/logger';

interface MessagesCacheEntry {
  id: string; // `${userId}_${chatId}`
  userId: string;
  chatId: string;
  messages: Message[];
  lastSync: number;
  version: number;
}

const CACHE_VERSION = 1;

/**
 * Generate cache key for messages
 */
function getCacheKey(userId: string, chatId: string): string {
  return `${userId}_${chatId}`;
}

/**
 * Get cached messages for a chat
 */
export async function getCachedMessages(
  userId: string,
  chatId: string
): Promise<Message[] | null> {
  try {
    const cacheKey = getCacheKey(userId, chatId);
    const cached = await getItem<MessagesCacheEntry>('messages', cacheKey);
    
    if (!cached) {
      logger.log(`No cached messages for chat ${chatId}`);
      return null;
    }

    // Check if cache is stale
    if (isStale(cached.lastSync, TTL.MESSAGES)) {
      logger.log(`Cached messages for chat ${chatId} are stale`);
      return null;
    }

    // Deserialize dates
    const messages = cached.messages.map(msg => ({
      ...msg,
      createdAt: new Date(msg.createdAt),
    }));

    logger.log(`Loaded ${messages.length} cached messages for chat ${chatId}`);
    return messages;
  } catch (error) {
    logger.error('Error getting cached messages:', error);
    return null;
  }
}

/**
 * Save messages to cache
 */
export async function setCachedMessages(
  userId: string,
  chatId: string,
  messages: Message[]
): Promise<void> {
  try {
    const cacheKey = getCacheKey(userId, chatId);
    const cacheEntry: MessagesCacheEntry = {
      id: cacheKey,
      userId,
      chatId,
      messages,
      lastSync: Date.now(),
      version: CACHE_VERSION,
    };

    await setItem('messages', cacheEntry);
    logger.log(`Cached ${messages.length} messages for chat ${chatId}`);
  } catch (error) {
    logger.error('Error caching messages:', error);
    // Don't throw - caching is optional
  }
}

/**
 * Delete cached messages for a chat
 */
export async function deleteCachedMessages(
  userId: string,
  chatId: string
): Promise<void> {
  try {
    const cacheKey = getCacheKey(userId, chatId);
    await deleteItem('messages', cacheKey);
    logger.log(`Deleted cached messages for chat ${chatId}`);
  } catch (error) {
    logger.error('Error deleting cached messages:', error);
  }
}

/**
 * Load messages with caching strategy:
 * 1. Return cached data immediately if available and fresh
 * 2. If cache is stale, fetch from Firebase and update cache
 * 
 * CRITICAL: Background refresh was removed to prevent race conditions.
 * The cache is now only updated during explicit save operations (addMessage, updateMessage, etc.)
 * to ensure that new messages written to Storage are not overwritten by stale cache refreshes.
 */
export async function loadMessagesWithCache(
  userId: string,
  chatId: string,
  fetchFn: () => Promise<Message[]>
): Promise<{ messages: Message[]; fromCache: boolean }> {
  // Try cache first
  const cachedMessages = await getCachedMessages(userId, chatId);
  
  if (cachedMessages) {
    // Return cached data immediately
    // No background refresh - cache is only updated on explicit writes
    return { messages: cachedMessages, fromCache: true };
  }

  // No cache or stale - fetch from Firebase
  try {
    const freshMessages = await fetchFn();
    
    // CRITICAL: Check if cache was updated while we were fetching
    // Only update cache if it hasn't been modified by another operation
    const currentCache = await getItem<MessagesCacheEntry>('messages', getCacheKey(userId, chatId));
    
    if (!currentCache || currentCache.lastSync <= Date.now() - 5000) {
      // Cache is still stale or doesn't exist - safe to update
      await setCachedMessages(userId, chatId, freshMessages);
    } else {
      // Cache was updated during fetch (e.g., by updateCachedMessages)
      // Don't overwrite newer data with stale fetch results
      logger.log(`Cache was updated during fetch for chat ${chatId} - keeping newer cache`);
    }
    
    return { messages: freshMessages, fromCache: false };
  } catch (error) {
    logger.error('Error fetching messages:', error);
    throw error;
  }
}

/**
 * Update cached messages after adding/editing/deleting
 */
export async function updateCachedMessages(
  userId: string,
  chatId: string,
  messages: Message[]
): Promise<void> {
  await setCachedMessages(userId, chatId, messages);
}

/**
 * Clear all cached messages for a user
 */
export async function clearUserMessagesCache(userId: string): Promise<void> {
  try {
    const allCached = await getItemsByIndex<MessagesCacheEntry>('messages', 'userId', userId);
    
    for (const cached of allCached) {
      await deleteItem('messages', cached.id);
    }
    
    logger.log(`Cleared all cached messages for user ${userId}`);
  } catch (error) {
    logger.error('Error clearing user messages cache:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getMessagesCacheStats(userId: string): Promise<{
  totalChats: number;
  totalMessages: number;
  cacheSize: number;
}> {
  try {
    const allCached = await getItemsByIndex<MessagesCacheEntry>('messages', 'userId', userId);
    
    const totalMessages = allCached.reduce((sum, cached) => sum + cached.messages.length, 0);
    const cacheSize = JSON.stringify(allCached).length; // Approximate size in bytes
    
    return {
      totalChats: allCached.length,
      totalMessages,
      cacheSize,
    };
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    return { totalChats: 0, totalMessages: 0, cacheSize: 0 };
  }
}
