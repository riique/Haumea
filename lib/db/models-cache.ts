/**
 * OpenRouter Models Cache
 * 
 * Caches OpenRouter models in IndexedDB to reduce API calls
 * and improve modal opening performance
 */

import { getItem, setItem, isStale, TTL } from './indexeddb';
import { logger } from '@/lib/utils/logger';

export interface OpenRouterModel {
  id: string;
  name: string;
  canonical_slug?: string | null;
  created: number;
  description: string;
  context_length: number | null;
  architecture: {
    input_modalities: string[];
    output_modalities: string[];
    tokenizer: string;
    instruct_type: string | null;
  };
  pricing: {
    prompt: string;
    completion: string;
    image: string;
    request: string;
    input_cache_read?: string | null;
    input_cache_write?: string | null;
    web_search: string;
    internal_reasoning: string;
  };
  top_provider: {
    context_length: number | null;
    max_completion_tokens: number | null;
    is_moderated: boolean;
  };
  supported_parameters: string[];
}

interface ModelsCacheEntry {
  id: string;
  data: OpenRouterModel[];
  timestamp: number;
  version: string;
}

const CACHE_KEY = 'openrouter-models';
const CACHE_VERSION = '1.1'; // Bump version to invalidate old cache

/**
 * Get cached models from IndexedDB
 */
export async function getCachedModels(): Promise<OpenRouterModel[] | null> {
  try {
    const cached = await getItem<ModelsCacheEntry>('models', CACHE_KEY);
    
    if (!cached) {
      logger.log('No cached models found');
      return null;
    }

    // Check if cache is stale
    if (isStale(cached.timestamp, TTL.MODELS)) {
      logger.log('Cached models are stale');
      return null;
    }

    // Check version compatibility
    if (cached.version !== CACHE_VERSION) {
      logger.log('Cached models version mismatch');
      return null;
    }

    logger.log(`Loaded ${cached.data.length} models from cache`);
    return cached.data;
  } catch (error) {
    logger.error('Error getting cached models:', error);
    return null;
  }
}

/**
 * Save models to IndexedDB cache
 */
export async function setCachedModels(models: OpenRouterModel[]): Promise<void> {
  try {
    const cacheEntry: ModelsCacheEntry = {
      id: CACHE_KEY,
      data: models,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };

    await setItem('models', cacheEntry);
    logger.log(`Cached ${models.length} models to IndexedDB`);
  } catch (error) {
    logger.error('Error caching models:', error);
    // Don't throw - caching is optional
  }
}

/**
 * Fetch models with caching strategy:
 * 1. Return cached data immediately if available and fresh (unless skipCache is true)
 * 2. Fetch from API if cache is stale or skipCache is true
 * 3. Update cache with fresh data
 */
export async function fetchModelsWithCache(
  fetchFn: () => Promise<OpenRouterModel[]>,
  skipCache = false
): Promise<{ models: OpenRouterModel[]; fromCache: boolean }> {
  // If skipCache is true, go directly to API
  if (skipCache) {
    try {
      const freshModels = await fetchFn();
      // Save to cache asynchronously (don't wait)
      setCachedModels(freshModels).catch((error) => {
        logger.error('Error saving models to cache:', error);
      });
      return { models: freshModels, fromCache: false };
    } catch (error) {
      logger.error('Error fetching models:', error);
      throw error;
    }
  }

  // Try to get from cache first (with timeout)
  let cachedModels: OpenRouterModel[] | null = null;
  
  try {
    const cachePromise = getCachedModels();
    const timeoutPromise = new Promise<null>((resolve) => 
      setTimeout(() => resolve(null), 3000)
    );
    
    cachedModels = await Promise.race([cachePromise, timeoutPromise]);
  } catch (error) {
    logger.error('Error getting cached models:', error);
    cachedModels = null;
  }
  
  if (cachedModels) {
    // Return cached data immediately
    // NO background refresh - cache is only updated on explicit invalidation
    // This prevents race conditions and unnecessary API calls
    return { models: cachedModels, fromCache: true };
  }

  // No cache or stale - fetch from API
  try {
    const freshModels = await fetchFn();
    // Save to cache asynchronously (don't wait)
    setCachedModels(freshModels).catch((error) => {
      logger.error('Error saving models to cache:', error);
    });
    return { models: freshModels, fromCache: false };
  } catch (error) {
    logger.error('Error fetching models:', error);
    throw error;
  }
}

/**
 * Invalidate models cache (force refresh on next request)
 */
export async function invalidateModelsCache(): Promise<void> {
  try {
    const { deleteItem } = await import('./indexeddb');
    await deleteItem('models', CACHE_KEY);
    logger.log('Models cache invalidated');
  } catch (error) {
    logger.error('Error invalidating models cache:', error);
  }
}
