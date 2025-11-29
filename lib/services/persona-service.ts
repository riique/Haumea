/**
 * Persona Service - Firebase Integration
 * 
 * Manages Personas in Firestore
 * Architecture:
 * - Persona data: Firestore at users/{userId}/personas/{personaId}
 * 
 * Personas are complete AI identity replacements (not personality add-ons)
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { Persona } from '@/types/chat';
import { logger } from '@/lib/utils/logger';

type FirestoreDateLike = Date | { toDate?: () => Date } | null | undefined | number | string;

/**
 * Resolve a Firestore date to a JavaScript Date object
 */
const resolveDate = (value: FirestoreDateLike, fallbackToNow = true): Date => {
  if (!value) {
    if (fallbackToNow) {
      return new Date();
    }
    throw new Error('Invalid date value: null or undefined');
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }

  if (typeof value === 'number' || typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (fallbackToNow) {
    logger.warn('Invalid date value, falling back to current date:', value);
    return new Date();
  }
  
  throw new Error(`Invalid date value: ${value}`);
};

// ============================================
// PERSONA OPERATIONS
// ============================================

/**
 * Create new Persona
 */
export async function createPersona(
  userId: string,
  data: {
    name: string;
    personality: string;
    description: string;
    dialogExamples?: string;
    firstMessage?: string;
    alwaysDo?: string;
    neverDo?: string;
    maxTokens?: number;
  }
): Promise<string> {
  const personaRef = doc(collection(firestore, `users/${userId}/personas`));
  
  const personaData = {
    name: data.name,
    personality: data.personality,
    description: data.description,
    dialogExamples: data.dialogExamples || null,
    firstMessage: data.firstMessage || null,
    alwaysDo: data.alwaysDo || null,
    neverDo: data.neverDo || null,
    maxTokens: data.maxTokens || null,
    isPinned: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(personaRef, personaData);
  
  logger.log('Persona created:', personaRef.id);
  return personaRef.id;
}

/**
 * Get all Personas for a user
 */
export async function getPersonas(userId: string): Promise<Persona[]> {
  const personasRef = collection(firestore, `users/${userId}/personas`);
  const q = query(personasRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  const personas: Persona[] = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || '',
      personality: data.personality || '',
      description: data.description || '',
      dialogExamples: data.dialogExamples || undefined,
      firstMessage: data.firstMessage || undefined,
      alwaysDo: data.alwaysDo || undefined,
      neverDo: data.neverDo || undefined,
      maxTokens: data.maxTokens || undefined,
      isPinned: data.isPinned || false,
      createdAt: resolveDate(data.createdAt),
      updatedAt: resolveDate(data.updatedAt),
    };
  });
  
  return personas;
}

/**
 * Get a specific Persona by ID
 */
export async function getPersona(userId: string, personaId: string): Promise<Persona | null> {
  const personaRef = doc(firestore, `users/${userId}/personas/${personaId}`);
  const snapshot = await getDoc(personaRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: data.name || '',
    personality: data.personality || '',
    description: data.description || '',
    dialogExamples: data.dialogExamples || undefined,
    firstMessage: data.firstMessage || undefined,
    alwaysDo: data.alwaysDo || undefined,
    neverDo: data.neverDo || undefined,
    maxTokens: data.maxTokens || undefined,
    isPinned: data.isPinned || false,
    createdAt: resolveDate(data.createdAt),
    updatedAt: resolveDate(data.updatedAt),
  };
}

/**
 * Update an existing Persona
 */
export async function updatePersona(
  userId: string,
  personaId: string,
  updates: {
    name?: string;
    personality?: string;
    description?: string;
    dialogExamples?: string;
    firstMessage?: string;
    alwaysDo?: string;
    neverDo?: string;
    maxTokens?: number;
  }
): Promise<void> {
  const personaRef = doc(firestore, `users/${userId}/personas/${personaId}`);
  
  // Filter out undefined values (Firestore doesn't accept undefined)
  const updateData: Record<string, string | number | Timestamp | null> = {
    updatedAt: Timestamp.now(),
  };
  
  // Only add fields that are not undefined
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.personality !== undefined) updateData.personality = updates.personality;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.dialogExamples !== undefined) updateData.dialogExamples = updates.dialogExamples || null;
  if (updates.firstMessage !== undefined) updateData.firstMessage = updates.firstMessage || null;
  if (updates.alwaysDo !== undefined) updateData.alwaysDo = updates.alwaysDo || null;
  if (updates.neverDo !== undefined) updateData.neverDo = updates.neverDo || null;
  if (updates.maxTokens !== undefined) updateData.maxTokens = updates.maxTokens || null;
  
  await updateDoc(personaRef, updateData);
  logger.log('Persona updated:', personaId);
}

/**
 * Delete a Persona
 * Note: This does NOT delete chats that use this Persona (they retain the snapshot)
 */
export async function deletePersona(userId: string, personaId: string): Promise<void> {
  const personaRef = doc(firestore, `users/${userId}/personas/${personaId}`);
  await deleteDoc(personaRef);
  logger.log('Persona deleted:', personaId);
}

/**
 * Toggle pin status of a Persona
 */
export async function togglePinPersona(
  userId: string,
  personaId: string,
  isPinned: boolean
): Promise<void> {
  const personaRef = doc(firestore, `users/${userId}/personas/${personaId}`);
  await updateDoc(personaRef, { 
    isPinned,
    updatedAt: Timestamp.now(),
  });
  logger.log('Persona pin toggled:', personaId, isPinned);
}
