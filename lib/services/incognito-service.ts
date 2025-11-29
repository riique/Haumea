/**
 * Incognito Service - LocalStorage Chat Management
 * 
 * Manages incognito chats in localStorage without saving to Firebase
 * Incognito mode disables:
 * - Global memories
 * - Chat memories
 * - User nickname
 * - About you info
 * - AI personalities
 */

import { Message } from '@/types/chat';

const INCOGNITO_STORAGE_KEY = 'haumea_incognito_chat';

export interface IncognitoChat {
  id: string;
  messages: Message[];
  model: string;
  createdAt: string;
  webSearchEnabled?: boolean;
  guidedStudyEnabled?: boolean;
  deepThinkingEnabled?: boolean;
  deepThinkingDepth?: 'Baixa' | 'Média' | 'Alta';
  reasoningMaxTokens?: number;
}

// Incognito mode state is NOT persisted in localStorage
// It's only in-memory, so it resets on page reload
let incognitoModeActive = false;

/**
 * Check if incognito mode is active
 * Note: This is session-only and will be false after page reload
 */
export function isIncognitoMode(): boolean {
  return incognitoModeActive;
}

/**
 * Enable incognito mode
 * Note: This is session-only and will be lost on page reload
 */
export function enableIncognitoMode(): void {
  incognitoModeActive = true;
}

/**
 * Disable incognito mode and clear incognito chat
 */
export function disableIncognitoMode(): void {
  incognitoModeActive = false;
  clearIncognitoChat();
}

/**
 * Force clean old incognito data
 * Call this to remove any corrupted or old format data
 */
export function forceCleanIncognitoData(): void {
  if (typeof window === 'undefined') return;
  
  console.log('Force cleaning incognito data...');
  clearIncognitoChat();
}

/**
 * Get current incognito chat
 */
export function getIncognitoChat(): IncognitoChat | null {
  if (typeof window === 'undefined') return null;
  
  const data = localStorage.getItem(INCOGNITO_STORAGE_KEY);
  if (!data) return null;
  
  try {
    const chat = JSON.parse(data);
    // Parse dates back to Date objects
    chat.createdAt = new Date(chat.createdAt);
    chat.messages = chat.messages.map((msg: Message) => ({
      ...msg,
      createdAt: new Date(msg.createdAt),
    }));
    
    // Validate message IDs - if any message has a duplicate or old format ID, clear the chat
    const ids = new Set<string>();
    for (const msg of chat.messages) {
      // Check for duplicate IDs
      if (ids.has(msg.id)) {
        console.warn('Incognito chat has duplicate IDs, clearing...');
        clearIncognitoChat();
        return null;
      }
      
      // Check for old format IDs (should have 2 underscores: msg_timestamp_random)
      const underscoreCount = (msg.id.match(/_/g) || []).length;
      if (underscoreCount < 2) {
        console.warn('Incognito chat has old format IDs, clearing...');
        clearIncognitoChat();
        return null;
      }
      
      ids.add(msg.id);
    }
    
    return chat;
  } catch (error) {
    console.error('Error parsing incognito chat:', error);
    clearIncognitoChat();
    return null;
  }
}

/**
 * Create new incognito chat
 */
export function createIncognitoChat(model: string): IncognitoChat {
  const chat: IncognitoChat = {
    id: `incognito_${Date.now()}`,
    messages: [],
    model,
    createdAt: new Date().toISOString(),
  };
  
  saveIncognitoChat(chat);
  return chat;
}

/**
 * Save incognito chat to localStorage
 */
export function saveIncognitoChat(chat: IncognitoChat): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(INCOGNITO_STORAGE_KEY, JSON.stringify(chat));
}

/**
 * Add message to incognito chat
 * Creates a new chat if none exists
 */
export function addIncognitoMessage(message: Message): void {
  let chat = getIncognitoChat();
  
  // If no chat exists (e.g., was cleared due to validation), create a new one
  if (!chat) {
    console.warn('No incognito chat found, creating new one');
    chat = createIncognitoChat('google/gemini-2.0-flash-exp:free');
  }
  
  chat.messages.push(message);
  saveIncognitoChat(chat);
}

/**
 * Update incognito chat configuration
 */
export function updateIncognitoChat(updates: Partial<IncognitoChat>): void {
  const chat = getIncognitoChat();
  if (!chat) {
    console.error('No incognito chat found');
    return;
  }
  
  Object.assign(chat, updates);
  saveIncognitoChat(chat);
}

/**
 * Delete messages from incognito chat
 */
export function deleteIncognitoMessages(messageIds: string[]): void {
  const chat = getIncognitoChat();
  if (!chat) return;
  
  const messageIdSet = new Set(messageIds);
  chat.messages = chat.messages.filter(msg => !messageIdSet.has(msg.id));
  saveIncognitoChat(chat);
}

/**
 * Clear incognito chat
 */
export function clearIncognitoChat(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(INCOGNITO_STORAGE_KEY);
}
