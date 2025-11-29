/**
 * Admin Service
 * 
 * Administrative functions for managing the application
 */

import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { logger } from '@/lib/utils/logger';

/**
 * Force clear cache for all users
 * Sets a timestamp that all users will check on login
 */
export async function forceClearCacheForAllUsers(): Promise<void> {
  try {
    const configRef = doc(firestore, 'config', 'app');
    
    await setDoc(configRef, {
      forceClearCacheTimestamp: Timestamp.now(),
      lastUpdated: Timestamp.now(),
      updatedBy: 'admin',
    }, { merge: true });
    
    logger.log('✅ Force cache clear flag set for all users');
  } catch (error) {
    logger.error('Error setting force cache clear flag:', error);
    throw new Error('Erro ao forçar limpeza de cache');
  }
}

/**
 * Get the force clear cache timestamp
 */
export async function getForceClearCacheTimestamp(): Promise<Date | null> {
  try {
    const configRef = doc(firestore, 'config', 'app');
    const configSnap = await getDoc(configRef);
    
    if (!configSnap.exists()) {
      return null;
    }
    
    const data = configSnap.data();
    return data?.forceClearCacheTimestamp?.toDate() || null;
  } catch (error) {
    logger.error('Error getting force cache clear timestamp:', error);
    return null;
  }
}

/**
 * Check if user needs to clear cache
 * Compares force clear timestamp with user's last clear
 */
export async function shouldClearCache(userId: string): Promise<boolean> {
  try {
    const forceTimestamp = await getForceClearCacheTimestamp();
    if (!forceTimestamp) return false;
    
    // Get user's last clear timestamp from localStorage
    const lastClearKey = `lastCacheClear_${userId}`;
    const lastClearStr = localStorage.getItem(lastClearKey);
    
    if (!lastClearStr) {
      // Never cleared before - should clear
      return true;
    }
    
    const lastClear = new Date(lastClearStr);
    
    // Should clear if force timestamp is newer than user's last clear
    return forceTimestamp > lastClear;
  } catch (error) {
    logger.error('Error checking if should clear cache:', error);
    return false;
  }
}

/**
 * Mark cache as cleared for user
 */
export function markCacheAsCleared(userId: string): void {
  const lastClearKey = `lastCacheClear_${userId}`;
  localStorage.setItem(lastClearKey, new Date().toISOString());
  logger.log(`✅ Marked cache as cleared for user ${userId}`);
}
