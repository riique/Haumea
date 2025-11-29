/**
 * User Preferences Service - Firebase Integration
 * 
 * Manages user preferences in Firestore
 * Architecture:
 * - Preferences: Firestore at users/{userId}/preferences/ui
 */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { logger } from '@/lib/utils/logger';

export interface UserPreferences {
  expandedFolders: Record<string, boolean>;
  sidebarOpen?: boolean;
  regularChatsExpanded?: boolean;
  debatesExpanded?: boolean;
  personasExpanded?: boolean;
  sharedChatsExpanded?: boolean;
  lastUpdated: Date;
}

/**
 * Get user preferences from Firestore
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    const prefsRef = doc(firestore, `users/${userId}/preferences/ui`);
    const prefsSnap = await getDoc(prefsRef);
    
    if (!prefsSnap.exists()) {
      return null;
    }
    
    const data = prefsSnap.data();
    return {
      expandedFolders: data.expandedFolders || {},
      sidebarOpen: data.sidebarOpen,
      regularChatsExpanded: data.regularChatsExpanded ?? true,
      debatesExpanded: data.debatesExpanded ?? true,
      personasExpanded: data.personasExpanded ?? true,
      sharedChatsExpanded: data.sharedChatsExpanded ?? true,
      lastUpdated: data.lastUpdated?.toDate() || new Date(),
    };
  } catch (error) {
    logger.error('Error loading user preferences:', error);
    return null;
  }
}

/**
 * Update expanded folders state in Firestore
 */
export async function updateExpandedFolders(
  userId: string,
  expandedFolders: Record<string, boolean>
): Promise<void> {
  try {
    const prefsRef = doc(firestore, `users/${userId}/preferences/ui`);
    
    // Check if document exists
    const prefsSnap = await getDoc(prefsRef);
    
    if (prefsSnap.exists()) {
      // Update existing document
      await updateDoc(prefsRef, {
        expandedFolders,
        lastUpdated: new Date(),
      });
    } else {
      // Create new document
      await setDoc(prefsRef, {
        expandedFolders,
        lastUpdated: new Date(),
      });
    }
  } catch (error) {
    logger.error('Error updating expanded folders:', error);
    throw error;
  }
}

/**
 * Update a single folder's expanded state
 */
export async function updateFolderExpandedState(
  userId: string,
  folderId: string,
  isExpanded: boolean
): Promise<void> {
  try {
    const prefsRef = doc(firestore, `users/${userId}/preferences/ui`);
    
    // Check if document exists
    const prefsSnap = await getDoc(prefsRef);
    
    if (prefsSnap.exists()) {
      const currentFolders = prefsSnap.data().expandedFolders || {};
      await updateDoc(prefsRef, {
        expandedFolders: {
          ...currentFolders,
          [folderId]: isExpanded,
        },
        lastUpdated: new Date(),
      });
    } else {
      // Create new document
      await setDoc(prefsRef, {
        expandedFolders: {
          [folderId]: isExpanded,
        },
        lastUpdated: new Date(),
      });
    }
  } catch (error) {
    logger.error('Error updating folder expanded state:', error);
    throw error;
  }
}

/**
 * Update sidebar open state
 */
export async function updateSidebarState(
  userId: string,
  isOpen: boolean
): Promise<void> {
  try {
    const prefsRef = doc(firestore, `users/${userId}/preferences/ui`);
    
    // Check if document exists
    const prefsSnap = await getDoc(prefsRef);
    
    if (prefsSnap.exists()) {
      await updateDoc(prefsRef, {
        sidebarOpen: isOpen,
        lastUpdated: new Date(),
      });
    } else {
      await setDoc(prefsRef, {
        sidebarOpen: isOpen,
        expandedFolders: {},
        lastUpdated: new Date(),
      });
    }
  } catch (error) {
    logger.error('Error updating sidebar state:', error);
    throw error;
  }
}

/**
 * Update section expanded states (Chats Sem Pasta, Debates, Personas)
 */
export async function updateSectionExpandedState(
  userId: string,
  section: 'regularChats' | 'debates' | 'personas' | 'sharedChats',
  isExpanded: boolean
): Promise<void> {
  try {
    const prefsRef = doc(firestore, `users/${userId}/preferences/ui`);
    const fieldName = `${section}Expanded`;
    
    // Check if document exists
    const prefsSnap = await getDoc(prefsRef);
    
    if (prefsSnap.exists()) {
      await updateDoc(prefsRef, {
        [fieldName]: isExpanded,
        lastUpdated: new Date(),
      });
    } else {
      await setDoc(prefsRef, {
        [fieldName]: isExpanded,
        expandedFolders: {},
        lastUpdated: new Date(),
      });
    }
  } catch (error) {
    logger.error(`Error updating ${section} expanded state:`, error);
    throw error;
  }
}
