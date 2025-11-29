/**
 * CollaborativeChatListeners Component
 * 
 * Manages real-time listeners for all collaborative chats
 */

'use client';

import { useEffect } from 'react';
import { useCollaborativeChatListener } from '@/hooks/useCollaborativeChatListener';
import { useSharedChats } from '@/hooks/useSharedChats';
import { useAuth } from '@/contexts/AuthContext';
import { Message } from '@/types/chat';

interface CollaborativeChatListenersProps {
  onNewMessage?: (chatId: string, ownerId: string, chatName: string, message: Message) => void;
  currentChatId?: string;
}

export function CollaborativeChatListeners({ 
  onNewMessage,
  currentChatId,
}: CollaborativeChatListenersProps) {
  const { userProfile } = useAuth();
  const { sharedChats } = useSharedChats();

  // Filter only collaborative chats where user is not the owner
  const collaborativeChats = sharedChats.filter(
    chat => chat.shareType === 'collaborative' && chat.ownerId !== userProfile?.uid
  );

  return (
    <>
      {collaborativeChats.map(sharedChat => (
        <CollaborativeChatListener
          key={sharedChat.id}
          chatId={sharedChat.chatId}
          ownerId={sharedChat.ownerId}
          chatName={sharedChat.chatMetadata.name}
          isCurrentChat={currentChatId === `${sharedChat.ownerId}/${sharedChat.chatId}`}
          onNewMessage={onNewMessage}
        />
      ))}
    </>
  );
}

interface CollaborativeChatListenerProps {
  chatId: string;
  ownerId: string;
  chatName: string;
  isCurrentChat: boolean;
  onNewMessage?: (chatId: string, ownerId: string, chatName: string, message: Message) => void;
}

function CollaborativeChatListener({
  chatId,
  ownerId,
  chatName,
  isCurrentChat,
  onNewMessage,
}: CollaborativeChatListenerProps) {
  
  const { hasNewMessages, clearNewMessagesBadge } = useCollaborativeChatListener({
    ownerId,
    chatId,
    enabled: true,
    onNewMessage: (message) => {
      // Don't notify if user is currently viewing this chat
      if (!isCurrentChat && onNewMessage) {
        onNewMessage(chatId, ownerId, chatName, message);
      }
    },
  });

  // Clear badge when user opens the chat
  useEffect(() => {
    if (isCurrentChat && hasNewMessages) {
      clearNewMessagesBadge();
    }
  }, [isCurrentChat, hasNewMessages, clearNewMessagesBadge]);

  return null; // This component only manages side effects
}
