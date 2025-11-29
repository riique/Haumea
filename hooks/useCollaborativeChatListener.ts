/**
 * useCollaborativeChatListener Hook
 * 
 * Real-time listener for collaborative chats
 * Monitors messages and metadata changes in shared chats
 */

import { useEffect, useState, useCallback } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { Message } from '@/types/chat';
import { logger } from '@/lib/utils/logger';

interface CollaborativeChatListenerOptions {
  ownerId: string;
  chatId: string;
  enabled: boolean;
  onMessagesUpdate?: (messages: Message[]) => void;
  onNewMessage?: (message: Message) => void;
}

export function useCollaborativeChatListener({
  ownerId,
  chatId,
  enabled,
  onMessagesUpdate,
  onNewMessage,
}: CollaborativeChatListenerOptions) {
  const [isListening, setIsListening] = useState(false);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const checkForUpdates = useCallback(async () => {
    if (!enabled || !ownerId || !chatId) return;

    try {
      const messagesPath = `users/${ownerId}/chats/${chatId}/messages.json`;
      const messagesRef = ref(storage, messagesPath);
      
      // Get messages file
      const url = await getDownloadURL(messagesRef);
      const response = await fetch(url);
      const messages: Message[] = await response.json();

      // Convert Firestore timestamps to Date objects
      const parsedMessages = messages.map((msg) => ({
        ...msg,
        createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
      }));

      // Check if there are new messages
      if (parsedMessages.length > lastMessageCount) {
        setHasNewMessages(true);
        
        // Get the new messages
        const newMessages = parsedMessages.slice(lastMessageCount);
        
        // Notify about new messages
        if (onNewMessage && newMessages.length > 0) {
          newMessages.forEach(msg => onNewMessage(msg));
        }
        
        setLastMessageCount(parsedMessages.length);
      }

      // Notify about all messages update
      if (onMessagesUpdate) {
        onMessagesUpdate(parsedMessages);
      }
    } catch (error) {
      // File might not exist yet or network error
      logger.warn('Error checking for collaborative chat updates:', { error });
    }
  }, [enabled, ownerId, chatId, lastMessageCount, onMessagesUpdate, onNewMessage]);

  // Poll for updates every 5 seconds when enabled
  useEffect(() => {
    if (!enabled) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    
    // Initial check
    checkForUpdates();

    // Set up polling interval
    const intervalId = setInterval(() => {
      checkForUpdates();
    }, 5000); // Poll every 5 seconds

    return () => {
      clearInterval(intervalId);
      setIsListening(false);
    };
  }, [enabled, checkForUpdates]);

  const clearNewMessagesBadge = useCallback(() => {
    setHasNewMessages(false);
  }, []);

  return {
    isListening,
    hasNewMessages,
    clearNewMessagesBadge,
  };
}
