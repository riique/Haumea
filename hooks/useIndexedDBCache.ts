/**
 * useIndexedDBCache Hook
 * 
 * React hook for managing IndexedDB cache
 * Provides cache stats and management functions
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getMessagesCacheStats,
  clearAllData,
  clearStore,
  clearUserMessagesCache,
  invalidateModelsCache,
  invalidateMetadataCache,
  invalidateUserProfileCache,
} from '@/lib/db';
import { logger } from '@/lib/utils/logger';

interface CacheStats {
  messages: {
    totalChats: number;
    totalMessages: number;
    cacheSize: number;
  } | null;
  isLoading: boolean;
  error: string | null;
}

export function useIndexedDBCache(userId?: string) {
  const [stats, setStats] = useState<CacheStats>({
    messages: null,
    isLoading: false,
    error: null,
  });

  // Load cache statistics
  const loadStats = useCallback(async () => {
    if (!userId) return;

    setStats(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const messageStats = await getMessagesCacheStats(userId);
      setStats({
        messages: messageStats,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      logger.error('Error loading cache stats:', error);
      setStats(prev => ({
        ...prev,
        isLoading: false,
        error: 'Erro ao carregar estatísticas do cache',
      }));
    }
  }, [userId]);

  // Clear all cache
  const clearAll = useCallback(async () => {
    try {
      await clearAllData();
      await loadStats();
      logger.log('All cache cleared');
    } catch (error) {
      logger.error('Error clearing cache:', error);
      throw new Error('Erro ao limpar cache');
    }
  }, [loadStats]);

  // Clear specific store
  const clearStoreByName = useCallback(async (storeName: 'models' | 'messages' | 'chats' | 'folders' | 'userProfile' | 'metadata') => {
    try {
      await clearStore(storeName);
      await loadStats();
      logger.log(`${storeName} cache cleared`);
    } catch (error) {
      logger.error(`Error clearing ${storeName} cache:`, error);
      throw new Error(`Erro ao limpar cache de ${storeName}`);
    }
  }, [loadStats]);

  // Clear user-specific caches
  const clearUserCache = useCallback(async () => {
    if (!userId) return;

    try {
      await Promise.all([
        clearUserMessagesCache(userId),
        invalidateMetadataCache(userId),
        invalidateUserProfileCache(userId),
      ]);
      await loadStats();
      logger.log('User cache cleared');
    } catch (error) {
      logger.error('Error clearing user cache:', error);
      throw new Error('Erro ao limpar cache do usuário');
    }
  }, [userId, loadStats]);

  // Invalidate specific caches (force refresh on next request)
  const invalidateCache = useCallback(async (type: 'models' | 'metadata' | 'profile' | 'all') => {
    if (!userId) return;

    try {
      switch (type) {
        case 'models':
          await invalidateModelsCache();
          break;
        case 'metadata':
          await invalidateMetadataCache(userId);
          break;
        case 'profile':
          await invalidateUserProfileCache(userId);
          break;
        case 'all':
          await Promise.all([
            invalidateModelsCache(),
            invalidateMetadataCache(userId),
            invalidateUserProfileCache(userId),
          ]);
          break;
      }
      logger.log(`${type} cache invalidated`);
    } catch (error) {
      logger.error(`Error invalidating ${type} cache:`, error);
      throw new Error(`Erro ao invalidar cache de ${type}`);
    }
  }, [userId]);

  // Get formatted cache size
  const getFormattedCacheSize = useCallback(() => {
    if (!stats.messages) return '0 B';

    const bytes = stats.messages.cacheSize;
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }, [stats.messages]);

  // Auto-load stats when userId changes
  useEffect(() => {
    if (userId) {
      loadStats();
    }
  }, [userId, loadStats]);

  return {
    stats,
    loadStats,
    clearAll,
    clearStore: clearStoreByName,
    clearUserCache,
    invalidateCache,
    getFormattedCacheSize,
  };
}
