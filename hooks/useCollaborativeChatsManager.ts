/**
 * useCollaborativeChatsManager Hook
 * 
 * Manages multiple collaborative chat listeners and notifications
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSharedChats } from './useSharedChats';
import { useCollaborativeChatListener } from './useCollaborativeChatListener';
import { Message } from '@/types/chat';
import { logger } from '@/lib/utils/logger';

interface ChatNotification {
  chatId: string;
  ownerId: string;
  chatName: string;
  newMessageCount: number;
  lastMessageAt: Date;
}

export function useCollaborativeChatsManager() {
  const { userProfile } = useAuth();
  const { sharedChats } = useSharedChats();
  const [notifications, setNotifications] = useState<Record<string, ChatNotification>>({});
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  
  // Track active listeners
  const activeListenersRef = useRef<Set<string>>(new Set());

  // Filter only collaborative chats
  const collaborativeChats = sharedChats.filter(
    chat => chat.shareType === 'collaborative' && chat.ownerId !== userProfile?.uid
  );

  // Clear notification for a specific chat
  const clearNotification = useCallback((chatId: string) => {
    setNotifications(prev => {
      const newNotifications = { ...prev };
      delete newNotifications[chatId];
      return newNotifications;
    });
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications({});
  }, []);

  // Add notification
  const addNotification = useCallback((
    chatId: string,
    ownerId: string,
    chatName: string,
    newMessage: Message
  ) => {
    setNotifications(prev => {
      const existing = prev[chatId];
      return {
        ...prev,
        [chatId]: {
          chatId,
          ownerId,
          chatName,
          newMessageCount: (existing?.newMessageCount || 0) + 1,
          lastMessageAt: new Date(),
        },
      };
    });

    // Browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`Nova mensagem em ${chatName}`, {
          body: newMessage.content.substring(0, 100) + (newMessage.content.length > 100 ? '...' : ''),
          icon: '/icon-192x192.png',
          tag: chatId,
        });
      } catch (error) {
        logger.warn('Failed to show browser notification:', { error });
      }
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (error) {
        logger.error('Error requesting notification permission:', { error });
        return false;
      }
    }
    return Notification.permission === 'granted';
  }, []);

  // Update total unread count
  useEffect(() => {
    const total = Object.values(notifications).reduce(
      (sum, notif) => sum + notif.newMessageCount,
      0
    );
    setTotalUnreadCount(total);
  }, [notifications]);

  return {
    collaborativeChats,
    notifications,
    totalUnreadCount,
    clearNotification,
    clearAllNotifications,
    addNotification,
    requestNotificationPermission,
  };
}
