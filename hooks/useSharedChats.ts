/**
 * useSharedChats Hook - Real-time Shared Chats
 * 
 * Manages chats that have been shared with the current user
 */

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { SharedChat } from '@/types/chat';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/utils/logger';

export function useSharedChats() {
  const { user } = useAuth();
  const [sharedChats, setSharedChats] = useState<SharedChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setSharedChats([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Subscribe to shared chats where user is a member
    const sharedChatsRef = collection(firestore, 'sharedChats');
    const sharedChatsQuery = query(
      sharedChatsRef,
      where('members', 'array-contains', user.uid),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      sharedChatsQuery,
      {
        includeMetadataChanges: false,
      },
      (snapshot) => {
        try {
          const chats = snapshot.docs
            .map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                chatId: data.chatId,
                ownerId: data.ownerId,
                ownerEmail: data.ownerEmail,
                shareType: data.shareType as 'copy' | 'collaborative',
                members: data.members || [],
                inviteCode: data.inviteCode,
                createdAt: data.createdAt?.toDate() || new Date(),
                expiresAt: data.expiresAt?.toDate() || undefined,
                isActive: data.isActive,
                chatMetadata: {
                  name: data.chatMetadata?.name || '',
                  messageCount: data.chatMetadata?.messageCount || 0,
                  lastMessageAt: data.chatMetadata?.lastMessageAt?.toDate() || new Date(),
                },
              };
            })
            // Filter out chats owned by current user (they appear in regular chats)
            .filter(chat => chat.ownerId !== user.uid);

          setSharedChats(chats);
          setLoading(false);
          setError(null);
        } catch (err) {
          logger.error('Error processing shared chats:', { error: err });
          setLoading(false);
        }
      },
      (err) => {
        if (err.code !== 'unavailable' && !err.message.includes('connection')) {
          setError('Erro ao carregar chats compartilhados');
          logger.error('Error loading shared chats:', { error: err });
        }
        setLoading(false);
      }
    );

    return () => {
      try {
        unsubscribe();
      } catch (err) {
        // Ignore cleanup errors
      }
    };
  }, [user]);

  return {
    sharedChats,
    loading,
    error,
  };
}
