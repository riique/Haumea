/**
 * useChatData Hook - Real-time Firestore Updates
 * 
 * Manages real-time synchronization of chats and folders from Firestore
 */

import { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { Chat, Folder } from '@/types/chat';
import { useAuth } from '@/contexts/AuthContext';

export function useChatData() {
  const { user } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [unorganizedChats, setUnorganizedChats] = useState<Chat[]>([]);
  const [archivedChats, setArchivedChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Keep organized chats in a ref to avoid losing them during folder updates
  const organizedChatsRef = useRef<{ [folderId: string]: Chat[] }>({});

  useEffect(() => {
    if (!user) {
      setFolders([]);
      setUnorganizedChats([]);
      setArchivedChats([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribers: (() => void)[] = [];

    // Subscribe to folders with error recovery
    const foldersRef = collection(firestore, `users/${user.uid}/folders`);
    const foldersQuery = query(foldersRef, orderBy('createdAt', 'asc'));
    
    const unsubFolders = onSnapshot(
      foldersQuery,
      {
        // Include metadata changes to handle offline/online transitions
        includeMetadataChanges: false,
      },
      (snapshot) => {
        try {
          const allFoldersData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name,
              color: data.color,
              password: data.password,
              isExpanded: data.isExpanded ?? true,
              createdAt: data.createdAt.toDate(),
              parentFolderId: data.parentFolderId || null,
              chats: [],
              subfolders: [] as Folder[],
            };
          });

          // Build folder map - using ref to preserve chats
          const folderMap = new Map<string, Folder>();
          allFoldersData.forEach(folder => {
            folderMap.set(folder.id, {
              ...folder,
              chats: organizedChatsRef.current[folder.id] || [],
              subfolders: [],
            });
          });

          // Build hierarchy - organizar em árvore
          const rootFolders: Folder[] = [];
          const processedIds = new Set<string>();
          
          allFoldersData.forEach(folder => {
            const currentFolder = folderMap.get(folder.id);
            if (!currentFolder) return;
            
            if (folder.parentFolderId) {
              // É uma subpasta - adicionar ao pai
              const parentFolder = folderMap.get(folder.parentFolderId);
              if (parentFolder) {
                parentFolder.subfolders = parentFolder.subfolders || [];
                parentFolder.subfolders.push(currentFolder);
                processedIds.add(folder.id);
              } else {
                // Pai não encontrado - tratar como raiz
                if (!processedIds.has(folder.id)) {
                  rootFolders.push(currentFolder);
                  processedIds.add(folder.id);
                }
              }
            } else {
              // É pasta raiz
              if (!processedIds.has(folder.id)) {
                rootFolders.push(currentFolder);
                processedIds.add(folder.id);
              }
            }
          });

          setFolders(rootFolders);
          setError(null);
        } catch (err) {
          console.error('Error processing folders:', err);
        }
      },
      (err) => {
        // Handle Firestore errors
        if (err.code !== 'unavailable' && !err.message.includes('connection')) {
          setError('Erro ao carregar pastas');
        }
      }
    );
    unsubscribers.push(unsubFolders);

    // Subscribe to chats with error recovery
    // OTIMIZAÇÃO: Apenas observar chats recentes (últimos 90 dias) para reduzir leituras
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const chatsRef = collection(firestore, `users/${user.uid}/chats`);
    const chatsQuery = query(
      chatsRef, 
      where('lastMessageAt', '>', ninetyDaysAgo),
      orderBy('lastMessageAt', 'desc')
    );
    
    const unsubChats = onSnapshot(
      chatsQuery,
      {
        // Include metadata changes to handle offline/online transitions
        includeMetadataChanges: false,
      },
      (snapshot) => {
        try {
          const allChats = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            lastMessageAt: doc.data().lastMessageAt.toDate(),
            createdAt: doc.data().createdAt.toDate(),
            folderId: doc.data().folderId,
            isArchived: doc.data().isArchived ?? false,
            isFavorite: doc.data().isFavorite ?? false,
            isProtected: doc.data().isProtected ?? false,
            isPinned: doc.data().isPinned ?? false,
            systemPrompt: doc.data().systemPrompt,
            context: doc.data().context,
            password: doc.data().password,
            latexEnabled: doc.data().latexEnabled,
            latexLevel: doc.data().latexLevel,
            temperature: doc.data().temperature,
            frequencyPenalty: doc.data().frequencyPenalty,
            repetitionPenalty: doc.data().repetitionPenalty,
            maxTokens: doc.data().maxTokens,
            lastMessage: doc.data().lastMessage,
            messageCount: doc.data().messageCount ?? 0,
            order: doc.data().order,
            isDebate: doc.data().isDebate ?? false,
            debateConfig: doc.data().debateConfig ?? null,
            isPersona: doc.data().isPersona ?? false,
            personaConfig: doc.data().personaConfig ?? null,
            // Auto-naming flags
            isTemporary: doc.data().isTemporary ?? false,
            createdManually: doc.data().createdManually ?? false,
            isFirstMessage: doc.data().isFirstMessage ?? false,
          })) as Chat[];

          // Separate chats by category
          const archived: Chat[] = [];
          const organized: { [folderId: string]: Chat[] } = {};
          const unorganized: Chat[] = [];

          allChats.forEach(chat => {
            if (chat.isArchived) {
              archived.push(chat);
            } else if (chat.folderId) {
              if (!organized[chat.folderId]) {
                organized[chat.folderId] = [];
              }
              organized[chat.folderId].push(chat);
            } else {
              unorganized.push(chat);
            }
          });

          // Sort function: pinned chats first, then by lastMessageAt
          const sortChats = (chats: Chat[]) => {
            return chats.sort((a, b) => {
              // Pinned chats come first
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              // If both pinned or both unpinned, sort by lastMessageAt
              return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
            });
          };

          // Clear and rebuild organized chats ref to prevent stale data
          // This ensures folders that no longer have chats are properly cleared
          organizedChatsRef.current = {};
          Object.keys(organized).forEach(folderId => {
            organizedChatsRef.current[folderId] = sortChats(organized[folderId]);
          });

          // Helper function to recursively update folder chats
          const updateFolderChats = (folder: Folder): Folder => {
            return {
              ...folder,
              chats: organizedChatsRef.current[folder.id] || [],
              subfolders: folder.subfolders?.map(subfolder => updateFolderChats(subfolder)),
            };
          };

          // Update folders with their chats (sorted, recursively)
          setFolders(prevFolders =>
            prevFolders.map(folder => updateFolderChats(folder))
          );

          setUnorganizedChats(sortChats(unorganized));
          setArchivedChats(sortChats(archived));
          setLoading(false);
          // Clear error on successful sync
          setError(null);
        } catch (err) {
          setLoading(false);
        }
      },
      (err) => {
        // Handle Firestore errors
        if (err.code !== 'unavailable' && !err.message.includes('connection')) {
          setError('Erro ao carregar chats');
        }
        setLoading(false);
      }
    );
    unsubscribers.push(unsubChats);

    // Cleanup subscriptions
    return () => {
      unsubscribers.forEach(unsub => {
        try {
          unsub();
        } catch (err) {
          // Ignore errors during cleanup
        }
      });
    };
  }, [user]);

  return {
    folders,
    unorganizedChats,
    archivedChats,
    loading,
    error,
  };
}
