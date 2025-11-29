/**
 * User Profile Cache
 * 
 * Caches user profile data in IndexedDB
 * for instant app loading and offline access to preferences
 */

import { getItem, setItem, deleteItem, isStale, TTL } from './indexeddb';
import { UserProfile } from '@/contexts/AuthContext';
import { logger } from '@/lib/utils/logger';

interface UserProfileCacheEntry {
  uid: string;
  profile: UserProfile;
  lastSync: number;
}

/**
 * Deserialize dates in user profile
 */
function deserializeProfile(profile: UserProfile): UserProfile {
  return {
    ...profile,
    createdAt: new Date(profile.createdAt),
    updatedAt: new Date(profile.updatedAt),
    globalMemories: profile.globalMemories?.map(mem => ({
      ...mem,
      createdAt: new Date(mem.createdAt),
    })),
  };
}

/**
 * Get cached user profile
 */
export async function getCachedUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const cached = await getItem<UserProfileCacheEntry>('userProfile', uid);
    
    if (!cached) {
      logger.log(`No cached profile for user ${uid}`);
      return null;
    }

    // Check if cache is stale
    if (isStale(cached.lastSync, TTL.USER_PROFILE)) {
      logger.log(`Cached profile for user ${uid} is stale`);
      return null;
    }

    // Deserialize dates
    const profile = deserializeProfile(cached.profile);

    logger.log(`Loaded cached profile for user ${uid}`);
    return profile;
  } catch (error) {
    logger.error('Error getting cached user profile:', error);
    return null;
  }
}

/**
 * Save user profile to cache
 */
export async function setCachedUserProfile(profile: UserProfile): Promise<void> {
  try {
    const cacheEntry: UserProfileCacheEntry = {
      uid: profile.uid,
      profile,
      lastSync: Date.now(),
    };

    await setItem('userProfile', cacheEntry);
    logger.log(`Cached profile for user ${profile.uid}`);
  } catch (error) {
    logger.error('Error caching user profile:', error);
    // Don't throw - caching is optional
  }
}

/**
 * Delete cached user profile
 */
export async function deleteCachedUserProfile(uid: string): Promise<void> {
  try {
    await deleteItem('userProfile', uid);
    logger.log(`Deleted cached profile for user ${uid}`);
  } catch (error) {
    logger.error('Error deleting cached user profile:', error);
  }
}

/**
 * Load user profile with caching strategy
 */
export async function loadUserProfileWithCache(
  uid: string,
  fetchFn: () => Promise<UserProfile | null>
): Promise<{ profile: UserProfile | null; fromCache: boolean }> {
  // Try cache first
  const cachedProfile = await getCachedUserProfile(uid);
  
  if (cachedProfile) {
    // Return cached data immediately
    // NO background refresh - cache is only updated on explicit updates
    // This prevents race conditions where user settings are overwritten by stale cache refreshes
    return { profile: cachedProfile, fromCache: true };
  }

  // No cache or stale - fetch from Firestore
  try {
    const freshProfile = await fetchFn();
    
    if (freshProfile) {
      // CRITICAL: Check if cache was updated while we were fetching
      // Only update cache if it hasn't been modified by another operation
      const currentCache = await getItem<UserProfileCacheEntry>('userProfile', uid);
      
      if (!currentCache || currentCache.lastSync <= Date.now() - 5000) {
        // Cache is still stale or doesn't exist - safe to update
        await setCachedUserProfile(freshProfile);
      } else {
        // Cache was updated during fetch (e.g., by updateCachedUserProfile)
        // Don't overwrite newer data with stale fetch results
        logger.log(`User profile cache was updated during fetch for ${uid} - keeping newer cache`);
      }
    }
    
    return { profile: freshProfile, fromCache: false };
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    throw error;
  }
}

/**
 * Update cached user profile
 */
export async function updateCachedUserProfile(
  uid: string,
  updates: Partial<UserProfile>
): Promise<void> {
  try {
    const cached = await getCachedUserProfile(uid);
    if (!cached) return;

    const updatedProfile = { ...cached, ...updates };
    await setCachedUserProfile(updatedProfile);
    logger.log(`Updated cached profile for user ${uid}`);
  } catch (error) {
    logger.error('Error updating cached user profile:', error);
  }
}

/**
 * Invalidate user profile cache (force refresh on next request)
 */
export async function invalidateUserProfileCache(uid: string): Promise<void> {
  await deleteCachedUserProfile(uid);
}
