/**
 * Message Service - Firebase Storage Integration
 * 
 * Manages chat messages stored in Firebase Storage as JSON files
 * According to Haumea_Frontend.md architecture:
 * - Messages are stored at: users/{userId}/chats/{chatId}/messages.json
 * 
 * Uses IndexedDB cache for instant loading and offline access
 */

import { ref, uploadString, getDownloadURL, deleteObject, getMetadata } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { Message } from '@/types/chat';
import {
  loadMessagesWithCache,
  deleteCachedMessages as deleteCachedMessagesDB,
  updateCachedMessages,
} from '@/lib/db/messages-cache';

interface MessagesFile {
  chatId: string;
  messages: Message[];
  lastUpdated: string;
}

/**
 * Get storage reference for messages file
 */
function getMessagesRef(userId: string, chatId: string) {
  return ref(storage, `users/${userId}/chats/${chatId}/messages.json`);
}

/**
 * Load messages from Firebase Storage (raw fetch)
 * Exported to allow direct Storage access when cache must be bypassed
 */
export async function loadMessagesFromStorage(userId: string, chatId: string): Promise<Message[]> {
  try {
    const messagesRef = getMessagesRef(userId, chatId);
    const url = await getDownloadURL(messagesRef);
    
    const response = await fetch(url);
    const data: MessagesFile = await response.json();
    
    // Convert timestamp strings back to Date objects and ensure attachments preserve isActive
    return data.messages.map(msg => ({
      ...msg,
      createdAt: new Date(msg.createdAt),
      attachments: msg.attachments?.map(att => ({
        ...att,
        isActive: att.isActive !== undefined ? att.isActive : true, // Preserve isActive state, default to true
      })),
      generatedImages: msg.generatedImages?.map(img => ({
        ...img,
        createdAt: new Date(img.createdAt), // Convert timestamp string to Date
      })),
    }));
  } catch (error) {
    // File doesn't exist yet (new chat)
    const storageError = error as { code?: string };
    if (storageError.code === 'storage/object-not-found') {
      return [];
    }
    throw error;
  }
}

/**
 * Load all messages from a chat
 * Uses IndexedDB cache for instant loading
 */
export async function loadMessages(userId: string, chatId: string): Promise<Message[]> {
  const { messages } = await loadMessagesWithCache(
    userId,
    chatId,
    () => loadMessagesFromStorage(userId, chatId)
  );
  return messages;
}

/**
 * Save messages to storage
 * Also updates IndexedDB cache
 */
export async function saveMessages(
  userId: string,
  chatId: string,
  messages: Message[]
): Promise<void> {
  const messagesRef = getMessagesRef(userId, chatId);
  
  console.log('💾 [saveMessages] Preparing to save:', {
    chatId,
    messageCount: messages.length,
    userMessages: messages.filter(m => m.role === 'user').length,
    assistantMessages: messages.filter(m => m.role === 'assistant').length,
    lastMessageRole: messages[messages.length - 1]?.role,
    lastMessageId: messages[messages.length - 1]?.id
  });
  
  const data: MessagesFile = {
    chatId,
    messages,
    lastUpdated: new Date().toISOString(),
  };
  
  const jsonString = JSON.stringify(data, null, 2);
  
  console.log('📤 [saveMessages] Uploading to Storage...');
  await uploadString(messagesRef, jsonString, 'raw', {
    contentType: 'application/json',
  });
  console.log('✅ [saveMessages] Upload complete');
  
  // Update cache
  await updateCachedMessages(userId, chatId, messages);
  console.log('✅ [saveMessages] Cache updated');
}

/**
 * Add a single message to chat
 */
export async function addMessage(
  userId: string,
  chatId: string,
  message: Omit<Message, 'id' | 'createdAt'>
): Promise<Message> {
  // CRITICAL: Load existing messages directly from Storage (not cache)
  // This prevents race conditions when user message and AI message are saved in quick succession
  // Cache might return stale data if two addMessage calls happen simultaneously
  const messages = await loadMessagesFromStorage(userId, chatId);
  
  console.log('📝 [addMessage] Loading from Storage:', {
    chatId,
    currentCount: messages.length,
    role: message.role,
    contentPreview: message.content?.substring(0, 50)
  });
  
  // Create new message with ID and timestamp
  const newMessage: Message = {
    ...message,
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    createdAt: new Date(),
  };
  
  // Add to messages array
  messages.push(newMessage);
  
  console.log('💾 [addMessage] Saving to Storage:', {
    chatId,
    newCount: messages.length,
    messageId: newMessage.id,
    role: newMessage.role
  });
  
  // Save back to storage
  await saveMessages(userId, chatId, messages);
  
  console.log('✅ [addMessage] Saved successfully:', {
    chatId,
    totalMessages: messages.length
  });
  
  return newMessage;
}

/**
 * Update a message
 */
export async function updateMessage(
  userId: string,
  chatId: string,
  messageId: string,
  updates: Partial<Message>
): Promise<void> {
  // Load directly from Storage to prevent race conditions
  const messages = await loadMessagesFromStorage(userId, chatId);
  
  const index = messages.findIndex(m => m.id === messageId);
  if (index === -1) {
    throw new Error(`Message ${messageId} not found`);
  }
  
  messages[index] = { ...messages[index], ...updates };
  await saveMessages(userId, chatId, messages);
}

/**
 * Delete a message
 */
export async function deleteMessage(
  userId: string,
  chatId: string,
  messageId: string
): Promise<void> {
  // Load directly from Storage to prevent race conditions
  const messages = await loadMessagesFromStorage(userId, chatId);
  const filtered = messages.filter(m => m.id !== messageId);
  await saveMessages(userId, chatId, filtered);
}

/**
 * Delete all messages for a chat (used when deleting chat)
 * Also clears IndexedDB cache
 */
export async function deleteAllMessages(userId: string, chatId: string): Promise<void> {
  try {
    const messagesRef = getMessagesRef(userId, chatId);
    await deleteObject(messagesRef);
  } catch (error) {
    // Ignore if file doesn't exist
    const storageError = error as { code?: string };
    if (storageError.code !== 'storage/object-not-found') {
      throw error;
    }
  }
  
  // Clear cache
  await deleteCachedMessagesDB(userId, chatId);
}

/**
 * Check if messages file exists
 */
export async function messagesExist(userId: string, chatId: string): Promise<boolean> {
  try {
    const messagesRef = getMessagesRef(userId, chatId);
    await getMetadata(messagesRef);
    return true;
  } catch (error) {
    const storageError = error as { code?: string };
    if (storageError.code === 'storage/object-not-found') {
      return false;
    }
    throw error;
  }
}

/**
 * Initialize empty messages file for new chat
 */
export async function initializeMessagesFile(userId: string, chatId: string): Promise<void> {
  await saveMessages(userId, chatId, []);
}

/**
 * Get message count without loading all messages
 */
export async function getMessageCount(userId: string, chatId: string): Promise<number> {
  const messages = await loadMessages(userId, chatId);
  return messages.length;
}
