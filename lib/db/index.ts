/**
 * IndexedDB Cache - Main exports
 * 
 * Centralized exports for all cache modules
 */

// Core IndexedDB
export {
  getDB,
  initDB,
  getItem,
  setItem,
  deleteItem,
  getAllItems,
  getItemsByIndex,
  clearStore,
  clearAllData,
  isStale,
  TTL,
} from './indexeddb';

// Models Cache
export {
  getCachedModels,
  setCachedModels,
  fetchModelsWithCache,
  invalidateModelsCache,
} from './models-cache';

// Messages Cache
export {
  getCachedMessages,
  setCachedMessages,
  deleteCachedMessages,
  loadMessagesWithCache,
  updateCachedMessages,
  clearUserMessagesCache,
  getMessagesCacheStats,
} from './messages-cache';

// Metadata Cache (Chats & Folders)
export {
  getCachedMetadata,
  setCachedMetadata,
  deleteCachedMetadata,
  loadMetadataWithCache,
  updateCachedChat,
  updateCachedFolder,
  invalidateMetadataCache,
} from './metadata-cache';

// User Profile Cache
export {
  getCachedUserProfile,
  setCachedUserProfile,
  deleteCachedUserProfile,
  loadUserProfileWithCache,
  updateCachedUserProfile,
  invalidateUserProfileCache,
} from './user-cache';

// Re-export types
export type { DBSchema } from './indexeddb';
export type { OpenRouterModel } from './models-cache';
