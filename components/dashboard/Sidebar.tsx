'use client';

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import {
  Plus,
  Folder,
  MessageSquare,
  Archive,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Settings as SettingsIcon,
  Home,
  FolderPlus,
  Loader2,
  Pin,
  Lock,
  Edit3,
  Users,
  Trophy,
  Drama,
  Share2,
} from 'lucide-react';
import { Chat } from '@/types/chat';
import { useAuth } from '@/contexts/AuthContext';
import { useChatData } from '@/hooks/useChatData';
import { useSharedChats } from '@/hooks/useSharedChats';
import { deleteChat, togglePinChat } from '@/lib/services/chat-service';
import { NotificationBadge } from '@/components/common/NotificationBadge';
import { getUserPreferences, updateFolderExpandedState, updateSectionExpandedState } from '@/lib/services/user-preferences-service';
import { ConfirmModal } from '@/components/modals/ConfirmModal';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentChatId?: string;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onGoToEmptyChat: () => void;
  onOpenSettings: () => void;
  onOpenDebateConfig: () => void;
  onOpenPersonaModal: () => void;
  onOpenCreateFolder: () => void;
  onOpenCreateSubfolder: (parentFolderId: string) => void;
  onOpenChatSettings: (chatId: string) => void;
  onOpenShareChat: (chatId: string) => void;
  onOpenFolderSettings: (folderId: string) => void;
  onRequestFolderPassword: (folderId: string, folderName: string) => Promise<boolean>;
  onRequestChatPassword: (chatId: string, chatName: string, action?: 'edit' | 'delete') => Promise<boolean>;
  onRequestFolderPasswordForAction: (folderId: string, folderName: string, action: 'edit' | 'delete') => Promise<boolean>;
  onDeleteFolder: (folderId: string) => void;
  openRouterBalance: number | null;
  balanceLoading: boolean;
  onOpenLeaderboard: () => void;
  sharedChatNotifications?: Record<string, number>; // chatId -> unread count
  onRegisterUnlockHandlers?: (
    handlers: { unlockFolder: (id: string) => void; unlockChat: (id: string) => void } | null
  ) => void;
}

export function Sidebar({
  isOpen,
  onToggle,
  currentChatId,
  onSelectChat,
  onNewChat,
  onGoToEmptyChat,
  onOpenSettings,
  onOpenDebateConfig,
  onOpenPersonaModal,
  onOpenCreateFolder,
  onOpenCreateSubfolder,
  onOpenChatSettings,
  onOpenShareChat,
  onOpenFolderSettings,
  onRequestFolderPassword,
  onRequestChatPassword,
  onRequestFolderPasswordForAction,
  onDeleteFolder,
  openRouterBalance,
  balanceLoading,
  onOpenLeaderboard,
  sharedChatNotifications = {},
  onRegisterUnlockHandlers,
}: SidebarProps) {
  const { userProfile } = useAuth();
  
  // Load real data from Firestore
  const { folders, unorganizedChats, archivedChats, loading, error } = useChatData();
  const { sharedChats } = useSharedChats();
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [debatesExpanded, setDebatesExpanded] = useState(true); // Debates section
  const [personasExpanded, setPersonasExpanded] = useState(true); // Personas section
  const [regularChatsExpanded, setRegularChatsExpanded] = useState(true); // Regular chats section
  const [sharedChatsExpanded, setSharedChatsExpanded] = useState(true); // Shared chats section
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [unlockedFolders, setUnlockedFolders] = useState<Record<string, boolean>>({});
  const [unlockedChats, setUnlockedChats] = useState<Record<string, boolean>>({});
  
  // Load preferences from Firestore
  useEffect(() => {
    const loadPreferences = async () => {
      if (!userProfile?.uid) return;
      
      try {
        const prefs = await getUserPreferences(userProfile.uid);
        if (prefs) {
          setExpandedFolders(prefs.expandedFolders || {});
          setRegularChatsExpanded(prefs.regularChatsExpanded ?? true);
          setDebatesExpanded(prefs.debatesExpanded ?? true);
          setPersonasExpanded(prefs.personasExpanded ?? true);
          setSharedChatsExpanded(prefs.sharedChatsExpanded ?? true);
        }
      } catch (error) {
        console.error('Failed to load preferences:', error);
      }
    };
    
    loadPreferences();
  }, [userProfile?.uid]);
  
  // Separate debates and personas from regular chats
  const debateChats = unorganizedChats.filter(chat => {
    // New debates: have isDebate flag
    if (chat.isDebate === true) return true;
    // Legacy debates: detect by systemPrompt pattern
    if (chat.systemPrompt?.includes('🎭 Debate entre')) return true;
    return false;
  });
  
  const personaChats = unorganizedChats.filter(chat => chat.isPersona === true);
  
  const regularChats = unorganizedChats.filter(chat => {
    // Exclude debates and personas
    if (chat.isDebate === true) return false;
    if (chat.isPersona === true) return false;
    if (chat.systemPrompt?.includes('🎭 Debate entre')) return false;
    return true;
  });
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [openFolderMenu, setOpenFolderMenu] = useState<string | null>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  
  // Configure drag sensors with activation constraint
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  const toggleFolder = async (folderId: string, folder: { password?: string; name: string }) => {
    // Check if folder has password and is not unlocked
    if (folder.password && !unlockedFolders[folderId]) {
      await onRequestFolderPassword(folderId, folder.name);
      return;
    }
    
    const newExpandedState = !expandedFolders[folderId];
    
    // Update state immediately for responsiveness
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: newExpandedState,
    }));
    
    // Save to Firestore in background
    if (userProfile?.uid) {
      try {
        await updateFolderExpandedState(userProfile.uid, folderId, newExpandedState);
      } catch (error) {
        console.error('Failed to save folder state to Firestore:', error);
      }
    }
  };
  
  const handleSelectChatWithPassword = async (chatId: string, chat: { password?: string; name: string }) => {
    // Check if chat has password and is not unlocked
    if (chat.password && !unlockedChats[chatId]) {
      await onRequestChatPassword(chatId, chat.name);
      return;
    }
    
    onSelectChat(chatId);
  };
  
  // Expose function to unlock folder (called from parent after password verification)
  const unlockFolder = useCallback((folderId: string) => {
    setUnlockedFolders(prev => ({ ...prev, [folderId]: true }));
    setExpandedFolders(prev => ({ ...prev, [folderId]: true }));
    
    // Save to Firestore in background
    if (userProfile?.uid) {
      updateFolderExpandedState(userProfile.uid, folderId, true).catch(error => {
        console.error('Failed to save folder state to Firestore:', error);
      });
    }
  }, [userProfile?.uid]);
  
  // Expose function to unlock chat (called from parent after password verification)
  const unlockChat = useCallback((chatId: string) => {
    setUnlockedChats(prev => ({ ...prev, [chatId]: true }));
  }, []);

  useEffect(() => {
    onRegisterUnlockHandlers?.({ unlockFolder, unlockChat });
    return () => onRegisterUnlockHandlers?.(null);
  }, [onRegisterUnlockHandlers, unlockFolder, unlockChat]);

  const isFolderExpanded = (folderId: string) => {
    return expandedFolders[folderId] ?? false; // Default to collapsed
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || !userProfile?.uid) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dragging a folder
    const isDraggingFolder = activeId.startsWith('draggable-folder-');
    
    if (isDraggingFolder) {
      // Extract folder ID
      const folderId = activeId.replace('draggable-folder-', '');
      
      // Dropped on another folder
      if (overId.startsWith('folder-')) {
        const targetFolderId = overId.replace('folder-', '');
        try {
          const { moveFolderToFolder } = await import('@/lib/services/chat-service');
          await moveFolderToFolder(userProfile.uid, folderId, targetFolderId);
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Erro ao mover pasta. Tente novamente.');
        }
      }
      
      // Dropped on root area (unorganized)
      if (overId === 'unorganized-chats' || overId === 'root-folders') {
        try {
          const { moveFolderToFolder } = await import('@/lib/services/chat-service');
          await moveFolderToFolder(userProfile.uid, folderId, null);
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Erro ao mover pasta. Tente novamente.');
        }
      }
    } else {
      // Dragging a chat
      const chatId = activeId;
      
      // Dropped on a folder
      if (overId.startsWith('folder-')) {
        const folderId = overId.replace('folder-', '');
        try {
          const { moveChatToFolder } = await import('@/lib/services/chat-service');
          await moveChatToFolder(userProfile.uid, chatId, folderId);
        } catch {
          alert('Erro ao mover chat. Tente novamente.');
        }
      }
      
      // Dropped on "unorganized" area
      if (overId === 'unorganized-chats') {
        try {
          const { moveChatToFolder } = await import('@/lib/services/chat-service');
          await moveChatToFolder(userProfile.uid, chatId, null);
        } catch {
          alert('Erro ao mover chat. Tente novamente.');
        }
      }
    }
  };

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const handleDeleteClick = async (chatId: string, chat: { password?: string; name: string }) => {
    // Check if chat has password and is not unlocked
    if (chat.password && !unlockedChats[chatId]) {
      const verified = await onRequestChatPassword(chatId, chat.name, 'delete');
      if (!verified) return;
    }
    
    setChatToDelete(chatId);
    setDeleteModalOpen(true);
  };
  
  const handleOpenChatSettings = async (chatId: string, chat: { password?: string; name: string }) => {
    // Check if chat has password and is not unlocked
    if (chat.password && !unlockedChats[chatId]) {
      const verified = await onRequestChatPassword(chatId, chat.name, 'edit');
      if (!verified) return;
    }
    
    onOpenChatSettings(chatId);
  };
  
  const handleFolderAction = async (folderId: string, folder: { password?: string; name: string }, action: 'edit' | 'delete' | 'createSubfolder') => {
    // Check if folder has password (not needed for createSubfolder)
    if (folder.password && action !== 'createSubfolder') {
      const verified = await onRequestFolderPasswordForAction(folderId, folder.name, action as 'edit' | 'delete');
      if (!verified) return;
    }
    
    if (action === 'edit') {
      onOpenFolderSettings(folderId);
    } else if (action === 'delete') {
      onDeleteFolder(folderId);
    } else if (action === 'createSubfolder') {
      onOpenCreateSubfolder(folderId);
    }
    
    setOpenFolderMenu(null);
  };
  
  // Close folder menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(event.target as Node)) {
        setOpenFolderMenu(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConfirmDelete = async () => {
    if (!chatToDelete || !userProfile?.uid) return;
    
    try {
      await deleteChat(userProfile.uid, chatToDelete);
      
      // If deleting current chat, go to empty chat
      if (chatToDelete === currentChatId) {
        onGoToEmptyChat();
      }
      
      // Chat list will update automatically via Firestore real-time sync
    } catch {
      alert('Erro ao deletar chat. Tente novamente.');
    }
  };

  const handleArchiveClick = async (chatId: string, isArchived: boolean) => {
    if (!userProfile?.uid) return;
    
    try {
      const { toggleArchiveChat } = await import('@/lib/services/chat-service');
      await toggleArchiveChat(userProfile.uid, chatId, !isArchived);
      
      // Chat list will update automatically via Firestore real-time sync
    } catch {
      alert('Erro ao arquivar chat. Tente novamente.');
    }
  };

  const handlePinClick = async (chatId: string, isPinned: boolean) => {
    if (!userProfile?.uid) return;
    
    try {
      await togglePinChat(userProfile.uid, chatId, !isPinned);
      
      // Chat list will update automatically via Firestore real-time sync
    } catch {
      alert('Erro ao fixar chat. Tente novamente.');
    }
  };

  if (!isOpen) {
    // Sidebar colapsada (60px)
    return (
      <aside className="w-[60px] h-screen bg-card border-r border-border flex flex-col items-center py-4 gap-4 shrink-0 relative">
        <button
          type="button"
          onClick={onGoToEmptyChat}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-sm font-semibold shadow-sm hover:scale-105 transition-transform duration-200"
          title="Chat Inicial"
        >
          {userProfile?.displayName?.[0]?.toUpperCase() || 'U'}
        </button>
        
        <div className="w-8 h-px bg-border" />
        
        <button
          onClick={onNewChat}
          className="p-2 hover:bg-muted rounded-lg transition-colors duration-150"
          title="Novo Chat"
        >
          <Plus className="w-5 h-5 text-muted-foreground" />
        </button>
        
        <button
          onClick={onGoToEmptyChat}
          className="p-2 hover:bg-muted rounded-lg transition-colors duration-150"
          title="Chat Inicial"
        >
          <Home className="w-5 h-5 text-muted-foreground" />
        </button>

        <div className="flex-1" />

        <button
          onClick={onOpenSettings}
          className="p-2 hover:bg-muted rounded-lg transition-colors duration-150"
          title="Configurações"
        >
          <SettingsIcon className="w-5 h-5 text-muted-foreground" />
        </button>

        <button
          onClick={onToggle}
          className="absolute top-1/2 -right-3 -translate-y-1/2 w-8 h-8 bg-card border border-border rounded-lg shadow-sm flex items-center justify-center hover:bg-muted hover:border-primary/50 transition-all duration-200 z-50"
          title="Abrir sidebar"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </aside>
    );
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onToggle}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Sidebar */}
        <aside className="w-[320px] h-screen bg-card border-r border-border flex flex-col overflow-hidden relative shrink-0 z-50 animate-in slide-in-from-left-4 duration-300">
        {/* Avatar Section */}
        <div className="p-6 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onGoToEmptyChat}
              className="w-12 h-12 rounded-full border-2 border-border overflow-hidden shadow-sm hover:scale-105 transition-transform duration-200"
              title="Ir para chat inicial"
            >
              {userProfile?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userProfile.photoURL}
                  alt="Foto de perfil"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-semibold text-lg">
                  {userProfile?.displayName?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-foreground truncate">
                @{userProfile?.displayName || 'username'}
              </p>
              <p className="text-sm font-mono text-muted-foreground mt-1">
                {balanceLoading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>...</span>
                  </span>
                ) : openRouterBalance !== null ? (
                  `$${openRouterBalance.toFixed(2)}`
                ) : (
                  <span className="text-destructive text-xs">Erro ao buscar saldo</span>
                )}
              </p>
            </div>

            <button
              onClick={onOpenCreateFolder}
              className="p-2 hover:bg-muted rounded-lg transition-colors duration-150 shrink-0"
              title="Novo Projeto"
            >
              <FolderPlus className="w-5 h-5 text-muted-foreground" />
            </button>

            <button
              onClick={onOpenSettings}
              className="p-2 hover:bg-muted rounded-lg transition-colors duration-150 shrink-0"
              title="Configurações"
            >
              <SettingsIcon className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Novo Chat Button */}
        <div className="px-4 pt-4 shrink-0">
          <button
            onClick={onNewChat}
            className="w-full px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Novo Chat
          </button>
        </div>

        {/* Chat List (Scrollable) */}
        <div className="flex-1 overflow-y-auto overflow-x-visible px-2 py-3 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && folders.length === 0 && unorganizedChats.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nenhum chat ainda.
              <br />
              Clique em &quot;Novo Chat&quot; para começar!
            </div>
          )}
          {/* Pastas */}
          <RootFoldersDropZone>
            {folders.map((folder) => (
              <FolderDropZone
                key={folder.id}
                folder={folder}
                isExpanded={isFolderExpanded(folder.id)}
                isUnlocked={folder.password ? unlockedFolders[folder.id] : true}
                currentChatId={currentChatId}
                unlockedChats={unlockedChats}
                expandedFolders={expandedFolders}
                unlockedFolders={unlockedFolders}
                openFolderMenu={openFolderMenu}
                folderMenuRef={folderMenuRef}
                onToggle={() => toggleFolder(folder.id, folder)}
                toggleFolder={toggleFolder}
                onOpenFolderMenu={setOpenFolderMenu}
                onFolderAction={handleFolderAction}
                onSelectChat={handleSelectChatWithPassword}
                onDeleteChat={handleDeleteClick}
                onArchiveChat={handleArchiveClick}
                onPinChat={handlePinClick}
                onShareChat={onOpenShareChat}
                onSettingsChat={handleOpenChatSettings}
                formatTimestamp={formatTimestamp}
              />
            ))}
          </RootFoldersDropZone>

          {/* Personas Section */}
          {personaChats.length > 0 && (
            <div className="mb-4">
              <button
                onClick={async () => {
                  const newState = !personasExpanded;
                  setPersonasExpanded(newState);
                  if (userProfile?.uid) {
                    try {
                      await updateSectionExpandedState(userProfile.uid, 'personas', newState);
                    } catch (error) {
                      console.error('Failed to save personas state:', error);
                    }
                  }
                }}
                className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors duration-150"
              >
                <div className="flex items-center gap-2">
                  <Drama className="w-4 h-4" />
                  <span>Personas</span>
                  <span className="text-xs">({personaChats.length})</span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 transition-transform duration-200 ${
                    personasExpanded ? 'rotate-90' : ''
                  }`}
                />
              </button>
              <AnimatePresence>
                {personasExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-1">
                      {personaChats.map((chat) => (
                        <ChatItem
                          key={chat.id}
                          chat={chat}
                          isActive={chat.id === currentChatId}
                          onClick={() => handleSelectChatWithPassword(chat.id, chat)}
                          onDelete={() => handleDeleteClick(chat.id, chat)}
                          onArchive={() => handleArchiveClick(chat.id, chat.isArchived || false)}
                          onPin={() => handlePinClick(chat.id, chat.isPinned || false)}
                          onShare={() => onOpenShareChat(chat.id)}
                          onSettings={() => handleOpenChatSettings(chat.id, chat)}
                          formatTimestamp={formatTimestamp}
                          showLock={!!(chat.password && !unlockedChats[chat.id])}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Shared Chats Section */}
          {sharedChats.length > 0 && (
            <div className="mb-4">
              <button
                onClick={async () => {
                  const newState = !sharedChatsExpanded;
                  setSharedChatsExpanded(newState);
                  if (userProfile?.uid) {
                    try {
                      await updateSectionExpandedState(userProfile.uid, 'sharedChats', newState);
                    } catch (error) {
                      console.error('Failed to save sharedChats state:', error);
                    }
                  }
                }}
                className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors duration-150"
              >
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  <span>Compartilhados</span>
                  <span className="text-xs">({sharedChats.length})</span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 transition-transform duration-200 ${
                    sharedChatsExpanded ? 'rotate-90' : ''
                  }`}
                />
              </button>
              <AnimatePresence>
                {sharedChatsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-1">
                      {sharedChats.map((sharedChat) => {
                        const notificationCount = sharedChatNotifications[sharedChat.chatId] || 0;
                        const hasNotification = notificationCount > 0;
                        
                        return (
                          <div
                            key={sharedChat.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => onSelectChat(`${sharedChat.ownerId}/${sharedChat.chatId}`)}
                            className="w-full px-3 py-2 flex items-center justify-between gap-2 text-sm rounded-lg transition-colors duration-150 cursor-pointer text-foreground hover:bg-muted relative"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-muted-foreground" />
                              <span className="truncate">{sharedChat.chatMetadata.name}</span>
                              {sharedChat.shareType === 'collaborative' && (
                                <div className="relative">
                                  <Users className="w-3 h-3 text-primary shrink-0" />
                                  <NotificationBadge
                                    show={hasNotification}
                                    size="sm"
                                    variant="danger"
                                  />
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {hasNotification && (
                                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                                  {notificationCount > 9 ? '9+' : notificationCount}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {formatTimestamp(sharedChat.chatMetadata.lastMessageAt)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Debates Section */}
          {debateChats.length > 0 && (
            <div className="mb-4">
              <button
                onClick={async () => {
                  const newState = !debatesExpanded;
                  setDebatesExpanded(newState);
                  if (userProfile?.uid) {
                    try {
                      await updateSectionExpandedState(userProfile.uid, 'debates', newState);
                    } catch (error) {
                      console.error('Failed to save debates state:', error);
                    }
                  }
                }}
                className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors duration-150"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Debates</span>
                  <span className="text-xs">({debateChats.length})</span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 transition-transform duration-200 ${
                    debatesExpanded ? 'rotate-90' : ''
                  }`}
                />
              </button>
              <AnimatePresence>
                {debatesExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-1">
                      {debateChats.map((chat) => (
                        <ChatItem
                          key={chat.id}
                          chat={chat}
                          isActive={chat.id === currentChatId}
                          onClick={() => handleSelectChatWithPassword(chat.id, chat)}
                          onDelete={() => handleDeleteClick(chat.id, chat)}
                          onArchive={() => handleArchiveClick(chat.id, chat.isArchived || false)}
                          onPin={() => handlePinClick(chat.id, chat.isPinned || false)}
                          onShare={() => onOpenShareChat(chat.id)}
                          onSettings={() => handleOpenChatSettings(chat.id, chat)}
                          formatTimestamp={formatTimestamp}
                          showLock={!!(chat.password && !unlockedChats[chat.id])}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Chats Sem Pasta (only regular chats) */}
          {regularChats.length > 0 && (
            <UnorganizedChatsDropZone
              chats={regularChats}
              isExpanded={regularChatsExpanded}
              onToggleExpanded={async () => {
                const newState = !regularChatsExpanded;
                setRegularChatsExpanded(newState);
                if (userProfile?.uid) {
                  try {
                    await updateSectionExpandedState(userProfile.uid, 'regularChats', newState);
                  } catch (error) {
                    console.error('Failed to save regularChats state:', error);
                  }
                }
              }}
              currentChatId={currentChatId}
              unlockedChats={unlockedChats}
              onSelectChat={handleSelectChatWithPassword}
              onDeleteChat={handleDeleteClick}
              onArchiveChat={handleArchiveClick}
              onPinChat={handlePinClick}
              onShareChat={onOpenShareChat}
              onSettingsChat={handleOpenChatSettings}
              formatTimestamp={formatTimestamp}
            />
          )}

          {/* Arquivados */}
          <div className="mb-4">
            <button
              onClick={() => setArchivedExpanded(!archivedExpanded)}
              className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors duration-150"
            >
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4" />
                <span>Arquivados</span>
                <span className="text-xs">({archivedChats.length})</span>
              </div>
              <ChevronRight
                className={`w-4 h-4 transition-transform duration-200 ${
                  archivedExpanded ? 'rotate-90' : ''
                }`}
              />
            </button>

            {archivedExpanded && (
              <div className="mt-1 space-y-0.5">
                {archivedChats.map((chat) => (
                  <ChatItem
                    key={chat.id}
                    chat={chat}
                    isActive={currentChatId === chat.id}
                    onClick={() => handleSelectChatWithPassword(chat.id, chat)}
                    onDelete={() => handleDeleteClick(chat.id, chat)}
                    onArchive={() => handleArchiveClick(chat.id, chat.isArchived || false)}
                    onPin={() => handlePinClick(chat.id, chat.isPinned || false)}
                    onShare={() => onOpenShareChat(chat.id)}
                    onSettings={() => handleOpenChatSettings(chat.id, chat)}
                    formatTimestamp={formatTimestamp}
                    showLock={!!(chat.password && !unlockedChats[chat.id])}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-border space-y-2 shrink-0">
          <button
            onClick={onOpenLeaderboard}
            className="w-full px-4 py-2 flex items-center gap-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors duration-150"
          >
            <Trophy className="w-4 h-4" />
            <span>Leaderboard</span>
          </button>

          <button
            onClick={onOpenPersonaModal}
            className="w-full px-4 py-2 flex items-center gap-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors duration-150"
          >
            <Drama className="w-4 h-4" />
            <span>Nova Persona</span>
          </button>

          <button
            onClick={onOpenDebateConfig}
            className="w-full px-4 py-2 flex items-center gap-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors duration-150"
          >
            <Users className="w-4 h-4" />
            <span>Novo Debate</span>
          </button>
        </div>

        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="absolute top-1/2 -right-3 -translate-y-1/2 w-8 h-8 bg-card border border-border rounded-lg shadow-sm flex items-center justify-center hover:bg-muted hover:border-primary/50 transition-all duration-200 z-10"
          title="Fechar sidebar"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
      </aside>
      
      {/* Drag Overlay */}
      <DragOverlay>
        {activeDragId ? (
          <DragOverlayContent 
            chatId={activeDragId} 
            folders={folders} 
            unorganizedChats={unorganizedChats}
            personaChats={personaChats}
            debateChats={debateChats}
          />
        ) : null}
      </DragOverlay>
      </DndContext>
      
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Deletar Chat"
        description="Tem certeza que deseja deletar este chat? Todas as mensagens e anexos serão permanentemente removidos. Esta ação não pode ser desfeita."
        confirmText="Deletar"
        cancelText="Cancelar"
        variant="danger"
      />
    </>
  );
}

// ChatItem Component
interface ChatItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onPin: () => void;
  onShare: () => void;
  onSettings: () => void;
  formatTimestamp: (date: Date) => string;
  showLock?: boolean;
}

function ChatItem({ chat, isActive, onClick, onDelete, onArchive, onPin, onShare, onSettings, formatTimestamp, showLock }: ChatItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const leftGroupRef = useRef<HTMLDivElement>(null);
  const [controlsPadding, setControlsPadding] = useState(0);
  const titleRef = useRef<HTMLSpanElement>(null);
  const [needsSpace, setNeedsSpace] = useState(false);

  // Calculate dropdown position
  useEffect(() => {
    if (dropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }, [dropdownOpen]);

  // Reserve space for controls only if left group would overlap them
  useLayoutEffect(() => {
    if (!(isHovered || dropdownOpen)) {
      setControlsPadding(0);
      return;
    }
    const controlsRect = controlsRef.current?.getBoundingClientRect();
    const groupRect = leftGroupRef.current?.getBoundingClientRect();
    if (!controlsRect || !groupRect) return;
    const gap = 8; // px
    const wouldOverlap = groupRect.right + gap > controlsRect.left;
    setControlsPadding(wouldOverlap ? controlsRect.width + gap : 0);
  }, [isHovered, dropdownOpen]);

  // Determine if the title is actually truncated; if yes, we hide timestamp
  useLayoutEffect(() => {
    if (!titleRef.current) return;
    const el = titleRef.current;
    const truncated = el.scrollWidth > el.clientWidth;
    setNeedsSpace(truncated);
  }, [isHovered, dropdownOpen, controlsPadding, chat.name]);

  // Recalculate on resize
  useEffect(() => {
    const handler = () => {
      if (isHovered || dropdownOpen) {
        const controlsRect = controlsRef.current?.getBoundingClientRect();
        const groupRect = leftGroupRef.current?.getBoundingClientRect();
        if (controlsRect && groupRect) {
          const gap = 8;
          const wouldOverlap = groupRect.right + gap > controlsRect.left;
          setControlsPadding(wouldOverlap ? controlsRect.width + gap : 0);
        }
      }
      if (titleRef.current) {
        setNeedsSpace(titleRef.current.scrollWidth > titleRef.current.clientWidth);
      }
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [isHovered, dropdownOpen]);

  // Close dropdown when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    const handleScroll = () => {
      setDropdownOpen(false);
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [dropdownOpen]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-sm rounded-lg transition-colors duration-150 group relative cursor-pointer ${
        isActive
          ? 'bg-primary/10 border-l-3 border-primary text-primary font-medium'
          : 'text-foreground hover:bg-muted'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1" ref={leftGroupRef} style={{ paddingRight: controlsPadding }}>
        <div
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            isActive ? 'bg-primary' : 'bg-muted-foreground'
          }`}
        />

        {chat.isTemporary ? (
          // Loading state - show spinner (chat name being generated by AI)
          <div className="flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 text-primary animate-spin shrink-0" />
            <span className="text-xs text-muted-foreground">Gerando...</span>
          </div>
        ) : (
          // Normal state - show chat name
          <span className="truncate" ref={titleRef}>
            {chat.name || 'Novo Chat'}
          </span>
        )}

        {showLock && !isHovered && (
          <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
        )}
        
        {chat.isPinned && !isHovered && !showLock && (
          <Pin className="w-3 h-3 text-primary shrink-0" />
        )}
      </div>

      <span
        className={`inline-block text-xs text-muted-foreground transition-all duration-150 ${
          (needsSpace || dropdownOpen || isHovered) ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
        }`}
      >
        {formatTimestamp(chat.lastMessageAt)}
      </span>

      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        ref={controlsRef}
        className={`absolute right-2 flex gap-1 transition-opacity duration-150 ${
          isHovered || dropdownOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Dropdown Menu */}
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setDropdownOpen((v) => !v);
          }}
          onMouseDown={(e) => { e.stopPropagation(); }}
          onPointerDown={(e) => { e.stopPropagation(); }}
          onTouchStart={(e) => { e.stopPropagation(); }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setDropdownOpen((v) => !v);
            }
          }}
          className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors duration-150"
          title="Mais opções"
          aria-haspopup="menu"
          aria-expanded={dropdownOpen}
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>

        {/* Dropdown rendered via portal */}
        {typeof window !== 'undefined' && createPortal(
          <AnimatePresence mode="wait">
            {dropdownOpen && dropdownPosition.top > 0 && (
              <div
                key={`chat-dropdown-${chat.id}`}
                className="fixed inset-0"
                style={{ zIndex: 99999 }}
                onClick={() => setDropdownOpen(false)}
                data-portal-root
              >
                <motion.div
                  ref={dropdownRef}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'fixed',
                    top: `${dropdownPosition.top}px`,
                    right: `${dropdownPosition.right}px`,
                    zIndex: 99999,
                  }}
                  className="w-48 bg-card border border-border rounded-lg shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="py-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPin();
                        setDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Pin className="w-4 h-4" />
                      <span>{chat.isPinned ? "Desafixar chat" : "Fixar chat"}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onArchive();
                        setDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Archive className="w-4 h-4" />
                      <span>{chat.isArchived ? "Desarquivar chat" : "Arquivar chat"}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShare();
                        setDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Compartilhar chat</span>
                    </button>

                    <div className="h-px bg-border my-1" />

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                        setDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Deletar chat</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

        {/* Settings Button (separate) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onSettings();
          }}
          onMouseDown={(e) => { e.stopPropagation(); }}
          onPointerDown={(e) => { e.stopPropagation(); }}
          onTouchStart={(e) => { e.stopPropagation(); }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSettings();
            }
          }}
          className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors duration-150"
          title="Configurações do chat"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// DRAG AND DROP COMPONENTS
// ============================================

// Draggable Chat Item
interface DraggableChatProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onPin: () => void;
  onShare: () => void;
  onSettings: () => void;
  formatTimestamp: (date: Date) => string;
  showLock?: boolean;
}

function DraggableChat({
  chat,
  isActive,
  onClick,
  onDelete,
  onArchive,
  onPin,
  onShare,
  onSettings,
  formatTimestamp,
  showLock,
}: DraggableChatProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: chat.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      animate={{
        opacity: isDragging ? 0.5 : 1,
        scale: isDragging ? 0.95 : 1,
      }}
      transition={{ duration: 0.2 }}
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing"
    >
      <ChatItem
        chat={chat}
        isActive={isActive}
        onClick={onClick}
        onDelete={onDelete}
        onArchive={onArchive}
        onPin={onPin}
        onShare={onShare}
        onSettings={onSettings}
        formatTimestamp={formatTimestamp}
        showLock={showLock}
      />
    </motion.div>
  );
}

// Root Folders Drop Zone (for dropping folders to root level)
function RootFoldersDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'root-folders',
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-colors duration-200 ${
        isOver ? 'bg-primary/5 rounded-lg' : ''
      }`}
    >
      {children}
    </div>
  );
}

// Folder Drop Zone
type FolderStructure = {
  id: string;
  name: string;
  color?: string;
  password?: string;
  chats: Chat[];
  subfolders?: FolderStructure[];
};

interface FolderDropZoneProps {
  folder: FolderStructure;
  isExpanded: boolean;
  isUnlocked: boolean;
  currentChatId?: string;
  unlockedChats: Record<string, boolean>;
  expandedFolders: Record<string, boolean>;
  unlockedFolders: Record<string, boolean>;
  openFolderMenu: string | null;
  folderMenuRef: React.RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  toggleFolder: (folderId: string, folder: { password?: string; name: string }) => void;
  onOpenFolderMenu: (folderId: string | null) => void;
  onFolderAction: (folderId: string, folder: { id: string; name: string; password?: string }, action: 'edit' | 'delete' | 'createSubfolder') => void;
  onSelectChat: (chatId: string, chat: Chat) => void;
  onDeleteChat: (chatId: string, chat: Chat) => void;
  onArchiveChat: (chatId: string, isArchived: boolean) => void;
  onPinChat: (chatId: string, isPinned: boolean) => void;
  onShareChat: (chatId: string) => void;
  onSettingsChat: (chatId: string, chat: Chat) => void;
  formatTimestamp: (date: Date) => string;
}

function FolderDropZone({
  folder,
  isExpanded,
  isUnlocked,
  currentChatId,
  unlockedChats,
  expandedFolders,
  unlockedFolders,
  openFolderMenu,
  folderMenuRef,
  onToggle,
  toggleFolder,
  onOpenFolderMenu,
  onFolderAction,
  onSelectChat,
  onDeleteChat,
  onArchiveChat,
  onPinChat,
  onShareChat,
  onSettingsChat,
  formatTimestamp,
}: FolderDropZoneProps) {
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `folder-${folder.id}`,
  });

  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: `draggable-folder-${folder.id}`,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  // Recursively count all chats including subfolders
  const getTotalChatsCount = (currentFolder: typeof folder): number => {
    let count = currentFolder.chats.length;
    if (currentFolder.subfolders) {
      currentFolder.subfolders.forEach(subfolder => {
        count += getTotalChatsCount(subfolder);
      });
    }
    return count;
  };

  const totalChatsCount = getTotalChatsCount(folder);

  // Combine refs
  const setRefs = (node: HTMLDivElement | null) => {
    setDroppableRef(node);
    setDraggableRef(node);
  };

  return (
    <motion.div
      ref={setRefs}
      style={style}
      initial={{ opacity: 0, y: -10 }}
      animate={{
        opacity: isDragging ? 0.5 : 1,
        y: 0,
        scale: isDragging ? 0.95 : 1,
      }}
      transition={{ duration: 0.2 }}
      className={`mb-4 rounded-lg transition-colors duration-200 ${
        isOver ? 'bg-primary/10 ring-2 ring-primary ring-offset-2' : ''
      } ${isDragging ? 'cursor-grabbing' : ''}`}
    >
      <div 
        onClick={onToggle}
        {...listeners}
        {...attributes}
        className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors duration-150 group cursor-pointer"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Folder 
            className="w-4 h-4 shrink-0" 
            style={{ color: folder.color || 'hsl(var(--muted-foreground))' }}
          />
          <span className="truncate">{folder.name}</span>
          {folder.password && !isUnlocked && (
            <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
          )}
          <span className="text-xs text-muted-foreground shrink-0">({totalChatsCount})</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative" ref={openFolderMenu === folder.id ? folderMenuRef : null}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenFolderMenu(openFolderMenu === folder.id ? null : folder.id);
              }}
              className="p-1 hover:bg-muted-foreground/10 rounded"
            >
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
            
            {openFolderMenu === folder.id && (
              <div className="fixed right-4 mt-8 z-50 w-52 bg-card border border-border rounded-lg shadow-lg py-1 animate-in slide-in-from-top-2 duration-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFolderAction(folder.id, folder, 'createSubfolder');
                  }}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Criar Subprojeto</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFolderAction(folder.id, folder, 'edit');
                  }}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Editar Projeto</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFolderAction(folder.id, folder, 'delete');
                  }}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Deletar Projeto</span>
                </button>
              </div>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && isUnlocked && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="ml-3 mt-1 space-y-0.5 overflow-hidden"
          >
            {/* Render subfolders first */}
            {folder.subfolders && folder.subfolders.length > 0 && (
              <div className="space-y-0.5 mb-2 ml-4">
                {folder.subfolders.map((subfolder) => (
                  <FolderDropZone
                    key={subfolder.id}
                    folder={subfolder}
                    isExpanded={expandedFolders[subfolder.id] ?? false}
                    isUnlocked={subfolder.password ? unlockedFolders[subfolder.id] : true}
                    currentChatId={currentChatId}
                    unlockedChats={unlockedChats}
                    expandedFolders={expandedFolders}
                    unlockedFolders={unlockedFolders}
                    openFolderMenu={openFolderMenu}
                    folderMenuRef={folderMenuRef}
                    onToggle={() => toggleFolder(subfolder.id, subfolder)}
                    toggleFolder={toggleFolder}
                    onOpenFolderMenu={onOpenFolderMenu}
                    onFolderAction={onFolderAction}
                    onSelectChat={onSelectChat}
                    onDeleteChat={onDeleteChat}
                    onArchiveChat={onArchiveChat}
                    onPinChat={onPinChat}
                    onShareChat={onShareChat}
                    onSettingsChat={onSettingsChat}
                    formatTimestamp={formatTimestamp}
                  />
                ))}
              </div>
            )}
            
            {/* Render chats */}
            {folder.chats.map((chat: Chat) => (
              <DraggableChat
                key={chat.id}
                chat={chat}
                isActive={currentChatId === chat.id}
                onClick={() => onSelectChat(chat.id, chat)}
                onDelete={() => onDeleteChat(chat.id, chat)}
                onArchive={() => onArchiveChat(chat.id, chat.isArchived || false)}
                onPin={() => onPinChat(chat.id, chat.isPinned || false)}
                onShare={() => onShareChat(chat.id)}
                onSettings={() => onSettingsChat(chat.id, chat)}
                formatTimestamp={formatTimestamp}
                showLock={!!(chat.password && !unlockedChats[chat.id])}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Unorganized Chats Drop Zone
interface UnorganizedChatsDropZoneProps {
  chats: Chat[];
  isExpanded: boolean;
  onToggleExpanded: () => void;
  currentChatId?: string;
  unlockedChats: Record<string, boolean>;
  onSelectChat: (chatId: string, chat: Chat) => void;
  onDeleteChat: (chatId: string, chat: Chat) => void;
  onArchiveChat: (chatId: string, isArchived: boolean) => void;
  onPinChat: (chatId: string, isPinned: boolean) => void;
  onShareChat: (chatId: string) => void;
  onSettingsChat: (chatId: string, chat: Chat) => void;
  formatTimestamp: (date: Date) => string;
}

function UnorganizedChatsDropZone({
  chats,
  isExpanded,
  onToggleExpanded,
  currentChatId,
  unlockedChats,
  onSelectChat,
  onDeleteChat,
  onArchiveChat,
  onPinChat,
  onShareChat,
  onSettingsChat,
  formatTimestamp,
}: UnorganizedChatsDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'unorganized-chats',
  });

  return (
    <div className="mb-4">
      <button
        onClick={onToggleExpanded}
        className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          <span>Chats Sem Pasta</span>
          <span className="text-xs">({chats.length})</span>
        </div>
        <ChevronRight
          className={`w-4 h-4 transition-transform duration-200 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <motion.div
              ref={setNodeRef}
              className={`mt-2 rounded-lg p-2 transition-colors duration-200 ${
                isOver ? 'bg-primary/5 ring-2 ring-primary ring-offset-2' : ''
              }`}
            >
              <div className="space-y-0.5">
                {chats.map((chat) => (
                  <DraggableChat
                    key={chat.id}
                    chat={chat}
                    isActive={currentChatId === chat.id}
                    onClick={() => onSelectChat(chat.id, chat)}
                    onDelete={() => onDeleteChat(chat.id, chat)}
                    onArchive={() => onArchiveChat(chat.id, chat.isArchived || false)}
                    onPin={() => onPinChat(chat.id, chat.isPinned || false)}
                    onShare={() => onShareChat(chat.id)}
                    onSettings={() => onSettingsChat(chat.id, chat)}
                    formatTimestamp={formatTimestamp}
                    showLock={!!(chat.password && !unlockedChats[chat.id])}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Drag Overlay Content
interface DragOverlayContentProps {
  chatId: string;
  folders: FolderStructure[];
  unorganizedChats: Chat[];
  personaChats: Chat[];
  debateChats: Chat[];
}

function DragOverlayContent({ chatId, folders, unorganizedChats, personaChats, debateChats }: DragOverlayContentProps) {
  // Find the chat being dragged
  let chat: Chat | undefined;
  
  // Check unorganized chats, personas, and debates
  chat = unorganizedChats.find(c => c.id === chatId) || personaChats.find(c => c.id === chatId) || debateChats.find(c => c.id === chatId);
  
  // Recursive function to search in folders and subfolders
  const findChatInFolder = (folder: FolderStructure): Chat | undefined => {
    // Check current folder's chats
    const found = folder.chats.find((c: Chat) => c.id === chatId);
    if (found) return found;
    
    // Check subfolders recursively
    if (folder.subfolders) {
      for (const subfolder of folder.subfolders) {
        const foundInSubfolder = findChatInFolder(subfolder);
        if (foundInSubfolder) return foundInSubfolder;
      }
    }
    
    return undefined;
  };
  
  // Check folders recursively
  if (!chat) {
    for (const folder of folders) {
      chat = findChatInFolder(folder);
      if (chat) break;
    }
  }
  
  if (!chat) return null;

  return (
    <motion.div
      initial={{ scale: 1 }}
      animate={{ scale: 1.05, rotate: 2 }}
      className="bg-card border-2 border-primary rounded-lg shadow-2xl px-3 py-2 max-w-[250px]"
    >
      <div className="flex items-center gap-2">
        {chat.isTemporary ? (
          <div className="flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 text-primary animate-spin shrink-0" />
            <span className="text-xs text-muted-foreground">Gerando...</span>
          </div>
        ) : (
          <span className="text-sm font-medium text-foreground truncate">
            {chat.name || 'Novo Chat'}
          </span>
        )}
      </div>
    </motion.div>
  );
}
