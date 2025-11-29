/**
 * Chat Converter Service
 * 
 * Converts old site chat format to new Haumea format
 */

import { Message } from '@/types/chat';

// Old site chat format
interface OldMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string | number; // Can be ISO string or unix timestamp
  responseTime?: number;
}

interface OldChat {
  id: string;
  name: string;
  messages: OldMessage[];
  createdAt: string;
  lastUpdated: string;
}

/**
 * Convert old site message to new format
 */
function convertOldMessage(oldMsg: OldMessage): Message {
  // Convert timestamp to Date object
  let createdAt: Date;
  if (typeof oldMsg.timestamp === 'string') {
    createdAt = new Date(oldMsg.timestamp);
  } else {
    createdAt = new Date(oldMsg.timestamp);
  }

  // Create new message format
  const newMessage: Message = {
    id: oldMsg.id,
    role: oldMsg.role,
    content: oldMsg.content,
    createdAt,
  };

  return newMessage;
}

/**
 * Convert old site chat to new Haumea format
 * Returns chat metadata and messages separately
 */
export function convertOldChatToNew(oldChat: OldChat) {
  // Convert messages
  const messages: Message[] = oldChat.messages.map(convertOldMessage);

  // Parse dates
  const createdAt = new Date(oldChat.createdAt);
  const lastUpdated = new Date(oldChat.lastUpdated);

  // Create chat metadata
  const chatMetadata = {
    name: oldChat.name,
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
    createdAt,
    lastMessageAt: lastUpdated,
    lastMessage: messages.length > 0 ? messages[messages.length - 1].content.substring(0, 100) : '',
    messageCount: messages.length,
    isArchived: false,
    isFavorite: false,
    isProtected: false,
    folderId: null,
    order: createdAt.getTime(),
  };

  return {
    chatMetadata,
    messages,
  };
}

/**
 * Validate old chat format
 */
export function validateOldChatFormat(data: unknown): data is OldChat {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const chat = data as Record<string, unknown>;

  // Check required fields
  if (
    typeof chat.id !== 'string' ||
    typeof chat.name !== 'string' ||
    typeof chat.createdAt !== 'string' ||
    typeof chat.lastUpdated !== 'string' ||
    !Array.isArray(chat.messages)
  ) {
    return false;
  }

  // Check messages format
  for (const msg of chat.messages) {
    if (
      !msg ||
      typeof msg !== 'object' ||
      typeof (msg as Record<string, unknown>).id !== 'string' ||
      typeof (msg as Record<string, unknown>).content !== 'string' ||
      typeof (msg as Record<string, unknown>).role !== 'string' ||
      ((msg as Record<string, unknown>).role !== 'user' && (msg as Record<string, unknown>).role !== 'assistant') ||
      (typeof (msg as Record<string, unknown>).timestamp !== 'string' && typeof (msg as Record<string, unknown>).timestamp !== 'number')
    ) {
      return false;
    }
  }

  return true;
}
