/**
 * Chat Service - Firebase Integration
 * 
 * Manages chats in Firestore and messages in Storage
 * Architecture:
 * - Chat metadata: Firestore at users/{userId}/chats/{chatId}
 * - Messages: Storage at users/{userId}/chats/{chatId}/messages.json
 * 
 * Uses IndexedDB cache for instant loading
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
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { Chat, Folder, ChatConfig, PersonaConfig } from '@/types/chat';

// Extended ChatConfig to support persona fields
type ChatConfigWithPersona = ChatConfig & {
  isPersona?: boolean;
  personaConfig?: PersonaConfig;
};
import * as messageService from './message-service';
import { deleteAllChatAttachments } from './upload-service';
import {
  loadMetadataWithCache,
  invalidateMetadataCache,
} from '@/lib/db/metadata-cache';
import { logger } from '@/lib/utils/logger';
import { getTemporaryChatName } from '@/lib/utils/chat-naming';

type FirestoreDateLike = Date | { toDate?: () => Date } | null | undefined | number | string;

/**
 * Resolve a Firestore date to a JavaScript Date object
 * @param value - The value to resolve
 * @param fallbackToNow - If true, returns current date for null/undefined values. If false, throws an error.
 * @returns Resolved Date object
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

  // If we reach here, the value is invalid
  if (fallbackToNow) {
    logger.warn('Invalid date value, falling back to current date:', value);
    return new Date();
  }
  
  throw new Error(`Invalid date value: ${value}`);
};

// ============================================
// CHAT OPERATIONS
// ============================================

/**
 * Create new chat with full configuration
 */
export async function createChat(
  userId: string,
  config: ChatConfig
): Promise<string> {
  const chatRef = doc(collection(firestore, `users/${userId}/chats`));
  
  const chatData = {
    name: config.name,
    systemPrompt: config.systemPrompt || '',
    context: config.context || '',
    password: config.password || null,
    latexEnabled: config.latexEnabled || false,
    latexLevel: config.latexLevel || 'medio',
    temperature: config.temperature || 0.7,
    frequencyPenalty: config.frequencyPenalty || 0,
    repetitionPenalty: config.repetitionPenalty || 1,
    maxTokens: config.maxTokens || 4096,
    memories: config.memories?.map(mem => ({
      id: mem.id,
      content: mem.content,
      color: mem.color,
      createdAt: mem.createdAt,
    })) || [],
    createdAt: Timestamp.now(),
    lastMessageAt: Timestamp.now(),
    lastMessage: '',
    messageCount: 0,
    isArchived: false,
    isFavorite: false,
    isProtected: !!config.password,
    folderId: null,
    order: Date.now(),
    // Debate mode fields
    isDebate: config.isDebate || false,
    debateConfig: config.debateConfig || null,
    // Persona mode fields
    isPersona: (config as ChatConfigWithPersona).isPersona || false,
    personaConfig: (config as ChatConfigWithPersona).personaConfig || null,
    // Auto-naming flags (manually created chats don't use auto-naming)
    isTemporary: false,
    createdManually: true,
    isFirstMessage: false,
  };

  await setDoc(chatRef, chatData);
  
  // Initialize empty messages file in Storage
  await messageService.initializeMessagesFile(userId, chatRef.id);
  
  // Invalidate metadata cache to refetch on next request
  await invalidateMetadataCache(userId);
  
  return chatRef.id;
}

/**
 * Create new chat with minimal configuration (for lazy creation)
 * Generates a default name based on first message preview
 */
export async function createChatLazy(
  userId: string,
  firstMessagePreview: string
): Promise<string> {
  const chatRef = doc(collection(firestore, `users/${userId}/chats`));
  
  // Generate name from first message (max 50 chars)
  const name = firstMessagePreview.substring(0, 50).trim() || 'Novo Chat';
  
  const chatData = {
    name,
    systemPrompt: '',
    context: '',
    password: null,
    latexEnabled: false,
    latexLevel: 'medio' as const,
    temperature: 1.0,
    frequencyPenalty: 0,
    repetitionPenalty: 0,
    maxTokens: 4096,
    createdAt: Timestamp.now(),
    lastMessageAt: Timestamp.now(),
    lastMessage: firstMessagePreview.substring(0, 100),
    messageCount: 0,
    isArchived: false,
    isFavorite: false,
    isProtected: false,
    folderId: null,
    order: Date.now(),
  };

  await setDoc(chatRef, chatData);
  
  // Initialize empty messages file in Storage
  await messageService.initializeMessagesFile(userId, chatRef.id);
  
  // Invalidate metadata cache to refetch on next request
  await invalidateMetadataCache(userId);
  
  return chatRef.id;
}

/**
 * Create new chat for automatic mode (no modal)
 * Creates with a temporary name that will be replaced after first message
 */
interface AutoChatOptions {
  selectedModel?: string;
  guidedStudyEnabled?: boolean;
  webSearchEnabled?: boolean;
  deepThinkingEnabled?: boolean;
  deepThinkingDepth?: 'Baixa' | 'Média' | 'Alta';
}

export async function createChatAuto(
  userId: string,
  options: AutoChatOptions = {}
): Promise<string> {
  const chatRef = doc(collection(firestore, `users/${userId}/chats`));
  
  const chatData = {
    name: getTemporaryChatName(),
    systemPrompt: '',
    context: '',
    password: null,
    latexEnabled: false,
    latexLevel: 'medio' as const,
    temperature: 1.0,
    frequencyPenalty: 0,
    repetitionPenalty: 0,
    maxTokens: 4096,
    memories: [],
    createdAt: Timestamp.now(),
    lastMessageAt: Timestamp.now(),
    lastMessage: '',
    messageCount: 0,
    isArchived: false,
    isFavorite: false,
    isProtected: false,
    folderId: null,
    order: Date.now(),
    guidedStudyEnabled: options.guidedStudyEnabled ?? false,
    webSearchEnabled: options.webSearchEnabled ?? false,
    deepThinkingEnabled: options.deepThinkingEnabled ?? false,
    deepThinkingDepth: options.deepThinkingDepth ?? 'Média',
    selectedModel: options.selectedModel || null,
    // Auto-naming flags
    isTemporary: true,
    createdManually: false,
    isFirstMessage: true,
  };

  await setDoc(chatRef, chatData);
  
  // Initialize empty messages file in Storage
  await messageService.initializeMessagesFile(userId, chatRef.id);
  
  // Invalidate metadata cache to refetch on next request
  await invalidateMetadataCache(userId);
  
  return chatRef.id;
}

/**
 * Update chat name after first message (for auto-naming system)
 * @param userId - User ID
 * @param chatId - Chat ID
 * @param newName - New chat name extracted from AI response
 */
export async function updateChatName(
  userId: string,
  chatId: string,
  newName: string
): Promise<void> {
  const chatRef = doc(firestore, `users/${userId}/chats/${chatId}`);
  
  await updateDoc(chatRef, {
    name: newName,
    isTemporary: false,
    isFirstMessage: false,
    updatedAt: Timestamp.now(),
  });
  
  // Invalidate metadata cache
  await invalidateMetadataCache(userId);
}

/**
 * Mark chat as no longer waiting for first message
 * (In case name extraction fails, we don't want to keep trying)
 */
export async function markChatAsStarted(
  userId: string,
  chatId: string
): Promise<void> {
  const chatRef = doc(firestore, `users/${userId}/chats/${chatId}`);
  
  await updateDoc(chatRef, {
    isTemporary: false,
    isFirstMessage: false,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Fetch chats from Firestore (raw fetch)
 */
async function fetchChatsFromFirestore(userId: string): Promise<Chat[]> {
  const chatsRef = collection(firestore, `users/${userId}/chats`);
  const q = query(chatsRef, orderBy('lastMessageAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      lastMessageAt: data.lastMessageAt.toDate(),
      memories: data.memories?.map((mem: { createdAt?: FirestoreDateLike } & Record<string, unknown>) => ({
        ...mem,
        createdAt: resolveDate(mem.createdAt ?? null),
      })) || [],
    };
  }) as Chat[];
}

/**
 * Listar todos os chats do usuário
 * Uses IndexedDB cache for instant loading
 */
export async function getUserChats(userId: string): Promise<Chat[]> {
  const { chats } = await loadMetadataWithCache(
    userId,
    () => fetchChatsFromFirestore(userId),
    () => fetchFoldersFromFirestore(userId)
  );
  return chats;
}

/**
 * Obter chat específico
 */
export async function getChat(userId: string, chatId: string): Promise<Chat | null> {
  const chatRef = doc(firestore, `users/${userId}/chats/${chatId}`);
  const chatSnap = await getDoc(chatRef);

  if (!chatSnap.exists()) {
    return null;
  }

  const data = chatSnap.data();
  return {
    id: chatSnap.id,
    ...data,
    createdAt: data.createdAt.toDate(),
    lastMessageAt: data.lastMessageAt.toDate(),
    memories: data.memories?.map((mem: { createdAt?: FirestoreDateLike } & Record<string, unknown>) => ({
      ...mem,
      createdAt: resolveDate(mem.createdAt ?? null),
    })) || [],
  } as Chat;
}

/**
 * Atualizar chat
 */
export async function updateChat(
  userId: string,
  chatId: string,
  data: Partial<Chat>
): Promise<void> {
  const chatRef = doc(firestore, `users/${userId}/chats/${chatId}`);
  
  // Preparar dados para atualização
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = { ...data };
  
  // Se houver memórias, garantir que estão no formato correto para o Firestore
  if (data.memories !== undefined) {
    updateData.memories = data.memories.map(mem => ({
      id: mem.id,
      content: mem.content,
      color: mem.color,
      createdAt: mem.createdAt,
    }));
  }
  
  try {
    await updateDoc(chatRef, {
      ...updateData,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    // Se o documento não existe, usar setDoc com merge
    if ((error as { code?: string }).code === 'not-found') {
      console.warn(`Chat ${chatId} não encontrado, tentando criar com merge...`);
      await setDoc(chatRef, {
        ...updateData,
        updatedAt: Timestamp.now(),
      }, { merge: true });
    } else {
      throw error;
    }
  }

  await invalidateMetadataCache(userId);
}

/**
 * Delete chat (deletes messages, attachments from Storage, and chat metadata from Firestore)
 */
export async function deleteChat(userId: string, chatId: string): Promise<void> {
  // Delete all attachments from Storage
  await deleteAllChatAttachments(userId, chatId);
  
  // Delete messages from Storage
  await messageService.deleteAllMessages(userId, chatId);
  
  // Delete chat document from Firestore
  const chatRef = doc(firestore, `users/${userId}/chats/${chatId}`);
  await deleteDoc(chatRef);
  
  // Invalidate metadata cache
  await invalidateMetadataCache(userId);
}

/**
 * Arquivar/Desarquivar chat
 */
export async function toggleArchiveChat(
  userId: string,
  chatId: string,
  isArchived: boolean
): Promise<void> {
  await updateChat(userId, chatId, { isArchived });
}

/**
 * Favoritar/Desfavoritar chat
 */
export async function toggleFavoriteChat(
  userId: string,
  chatId: string,
  isFavorite: boolean
): Promise<void> {
  await updateChat(userId, chatId, { isFavorite });
}

/**
 * Fixar/Desafixar chat
 */
export async function togglePinChat(
  userId: string,
  chatId: string,
  isPinned: boolean
): Promise<void> {
  await updateChat(userId, chatId, { isPinned });
}

// ============================================
// MESSAGE OPERATIONS (Delegated to message-service)
// ============================================

/**
 * Export message service functions for convenience
 */
export const {
  loadMessages,
  saveMessages,
  addMessage,
  updateMessage,
  deleteMessage,
  getMessageCount,
} = messageService;

/**
 * Update chat metadata after message changes
 */
export async function updateChatAfterMessage(
  userId: string,
  chatId: string,
  lastMessageContent: string
): Promise<void> {
  const messageCount = await messageService.getMessageCount(userId, chatId);
  
  await updateChat(userId, chatId, {
    lastMessageAt: new Date(),
    lastMessage: lastMessageContent.substring(0, 100), // Preview
    messageCount,
  });
}

// ============================================
// FOLDER OPERATIONS
// ============================================

/**
 * Criar nova pasta
 */
export async function createFolder(
  userId: string, 
  name: string, 
  color?: string, 
  password?: string,
  parentFolderId?: string | null
): Promise<string> {
  const folderRef = doc(collection(firestore, `users/${userId}/folders`));

  const folderData = {
    name,
    color: color || null,
    password: password || null,
    parentFolderId: parentFolderId || null,
    createdAt: Timestamp.now(),
    isExpanded: true,
  };

  await setDoc(folderRef, folderData);
  
  // Invalidate metadata cache
  await invalidateMetadataCache(userId);
  
  return folderRef.id;
}

/**
 * Fetch folders from Firestore (raw fetch)
 */
async function fetchFoldersFromFirestore(userId: string): Promise<Folder[]> {
  const foldersRef = collection(firestore, `users/${userId}/folders`);
  const q = query(foldersRef, orderBy('createdAt', 'asc'));
  const snapshot = await getDocs(q);

  const allFolders: Folder[] = [];
  const folderMap = new Map<string, Folder>();

  // First pass: Create all folder objects
  for (const folderDoc of snapshot.docs) {
    const data = folderDoc.data();
    const chatsRef = collection(firestore, `users/${userId}/chats`);
    const chatsQuery = query(chatsRef, where('folderId', '==', folderDoc.id));
    const chatsSnapshot = await getDocs(chatsQuery);

    const chats = chatsSnapshot.docs.map((doc) => {
      const chatData = doc.data();
      return {
        id: doc.id,
        ...chatData,
        createdAt: chatData.createdAt.toDate(),
        lastMessageAt: chatData.lastMessageAt.toDate(),
        memories: chatData.memories?.map((mem: { createdAt?: FirestoreDateLike } & Record<string, unknown>) => ({
          ...mem,
          createdAt: resolveDate(mem.createdAt ?? null),
        })) || [],
      };
    }) as Chat[];

    const folder: Folder = {
      id: folderDoc.id,
      name: data.name,
      color: data.color,
      password: data.password,
      isExpanded: data.isExpanded,
      createdAt: data.createdAt.toDate(),
      parentFolderId: data.parentFolderId || null,
      chats,
      subfolders: [],
    };

    folderMap.set(folderDoc.id, folder);
    allFolders.push(folder);
  }

  // Second pass: Build hierarchy
  const rootFolders: Folder[] = [];
  
  for (const folder of allFolders) {
    if (folder.parentFolderId) {
      // This is a subfolder, add it to parent's subfolders
      const parentFolder = folderMap.get(folder.parentFolderId);
      if (parentFolder) {
        parentFolder.subfolders = parentFolder.subfolders || [];
        parentFolder.subfolders.push(folder);
      } else {
        // Parent not found, treat as root folder
        rootFolders.push(folder);
      }
    } else {
      // This is a root folder
      rootFolders.push(folder);
    }
  }

  return rootFolders;
}

/**
 * Listar pastas do usuário (com hierarquia de subpastas)
 * Uses IndexedDB cache for instant loading
 */
export async function getUserFolders(userId: string): Promise<Folder[]> {
  const { folders } = await loadMetadataWithCache(
    userId,
    () => fetchChatsFromFirestore(userId),
    () => fetchFoldersFromFirestore(userId)
  );
  return folders;
}

/**
 * Atualizar pasta
 */
export async function updateFolder(
  userId: string,
  folderId: string,
  name: string,
  color?: string,
  password?: string
): Promise<void> {
  const folderRef = doc(firestore, `users/${userId}/folders/${folderId}`);
  await updateDoc(folderRef, {
    name,
    color: color || null,
    password: password || null,
  });
  
  // Invalidate metadata cache to reflect folder name/color changes
  await invalidateMetadataCache(userId);
}

/**
 * Deletar pasta (e recursivamente suas subpastas)
 */
export async function deleteFolder(userId: string, folderId: string): Promise<void> {
  // Get all subfolders recursively
  const foldersRef = collection(firestore, `users/${userId}/folders`);
  const subfoldersQuery = query(foldersRef, where('parentFolderId', '==', folderId));
  const subfoldersSnapshot = await getDocs(subfoldersQuery);
  
  // Delete all subfolders recursively
  for (const subfolderDoc of subfoldersSnapshot.docs) {
    await deleteFolder(userId, subfolderDoc.id);
  }
  
  // Remover folderId dos chats da pasta
  const chatsRef = collection(firestore, `users/${userId}/chats`);
  const q = query(chatsRef, where('folderId', '==', folderId));
  const snapshot = await getDocs(q);

  const updatePromises = snapshot.docs.map((doc) =>
    updateDoc(doc.ref, { folderId: null })
  );
  await Promise.all(updatePromises);

  // Deletar pasta
  const folderRef = doc(firestore, `users/${userId}/folders/${folderId}`);
  await deleteDoc(folderRef);
  
  // Invalidate metadata cache
  await invalidateMetadataCache(userId);
}

/**
 * Mover chat para pasta
 */
export async function moveChatToFolder(
  userId: string,
  chatId: string,
  folderId: string | null
): Promise<void> {
  const chatRef = doc(firestore, `users/${userId}/chats/${chatId}`);
  await updateDoc(chatRef, {
    folderId: folderId === null ? null : folderId,
    updatedAt: Timestamp.now(),
  });
  
  // Invalidate metadata cache to reflect changes in sidebar
  await invalidateMetadataCache(userId);
}

/**
 * Mover pasta para dentro de outra pasta (ou para raiz)
 */
export async function moveFolderToFolder(
  userId: string,
  folderId: string,
  targetParentFolderId: string | null
): Promise<void> {
  // Validação: não pode mover uma pasta para dentro de si mesma ou de suas subpastas
  if (targetParentFolderId && targetParentFolderId === folderId) {
    throw new Error('Não é possível mover uma pasta para dentro de si mesma');
  }
  
  // Verificar se o target é uma subpasta da pasta sendo movida
  if (targetParentFolderId) {
    const isDescendant = await checkIfDescendant(userId, folderId, targetParentFolderId);
    if (isDescendant) {
      throw new Error('Não é possível mover uma pasta para dentro de suas próprias subpastas');
    }
  }
  
  const folderRef = doc(firestore, `users/${userId}/folders/${folderId}`);
  await updateDoc(folderRef, {
    parentFolderId: targetParentFolderId === null ? null : targetParentFolderId,
  });
  
  // Invalidate metadata cache to reflect folder hierarchy changes
  await invalidateMetadataCache(userId);
}

/**
 * Verificar se targetFolderId é descendente de ancestorFolderId
 */
async function checkIfDescendant(
  userId: string,
  ancestorFolderId: string,
  targetFolderId: string
): Promise<boolean> {
  const folderRef = doc(firestore, `users/${userId}/folders/${targetFolderId}`);
  const folderDoc = await getDoc(folderRef);
  
  if (!folderDoc.exists()) return false;
  
  const data = folderDoc.data();
  const parentId = data.parentFolderId;
  
  if (!parentId) return false;
  if (parentId === ancestorFolderId) return true;
  
  // Recursivamente verificar o pai
  return checkIfDescendant(userId, ancestorFolderId, parentId);
}

// ============================================
// SEARCH AND FILTERS
// ============================================

/**
 * Buscar chats por texto
 */
export async function searchChats(userId: string, searchText: string): Promise<Chat[]> {
  const chats = await getUserChats(userId);
  
  const lowerSearch = searchText.toLowerCase();
  return chats.filter((chat) => chat.name.toLowerCase().includes(lowerSearch));
}

/**
 * Obter chats favoritos
 */
export async function getFavoriteChats(userId: string): Promise<Chat[]> {
  const chatsRef = collection(firestore, `users/${userId}/chats`);
  const q = query(chatsRef, where('isFavorite', '==', true), orderBy('lastMessageAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      lastMessageAt: data.lastMessageAt.toDate(),
      memories: data.memories?.map((mem: { createdAt?: FirestoreDateLike } & Record<string, unknown>) => ({
        ...mem,
        createdAt: resolveDate(mem.createdAt ?? null),
      })) || [],
    };
  }) as Chat[];
}

/**
 * Obter chats arquivados
 */
export async function getArchivedChats(userId: string): Promise<Chat[]> {
  const chatsRef = collection(firestore, `users/${userId}/chats`);
  const q = query(chatsRef, where('isArchived', '==', true), orderBy('lastMessageAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      lastMessageAt: data.lastMessageAt.toDate(),
      memories: data.memories?.map((mem: { createdAt?: unknown; [key: string]: unknown }) => {
        const createdAt = mem.createdAt;
        const dateValue = typeof createdAt === 'object' && createdAt !== null && 'toDate' in createdAt 
          ? (createdAt as { toDate: () => Date }).toDate()
          : createdAt instanceof Date 
            ? createdAt 
            : new Date();
        return {
          ...mem,
          createdAt: dateValue,
        };
      }) || [],
    };
  }) as Chat[];
}
