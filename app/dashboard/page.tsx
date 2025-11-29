'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Upperbar } from '@/components/dashboard/Upperbar';
import { ChatInterface } from '@/components/dashboard/ChatInterface';
import { InputBar } from '@/components/dashboard/InputBar';
import { AttachmentsModal } from '@/components/modals/AttachmentsModal';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { StatsModal } from '@/components/modals/StatsModal';
import { DownloadModal } from '@/components/modals/DownloadModal';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { CreateFolderModal } from '@/components/modals/CreateFolderModal';
import { NewChatModal } from '@/components/modals/NewChatModal';
import { EditChatModal } from '@/components/modals/EditChatModal';
import { ShareChatModal } from '@/components/modals/ShareChatModal';
import { EditFolderModal } from '@/components/modals/EditFolderModal';
import { ModelSelectModal } from '@/components/modals/ModelSelectModal';
import { PasswordModal } from '@/components/modals/PasswordModal';
import { LeaderboardModal } from '@/components/modals/LeaderboardModal';
import { DebateConfigModal, DebateEditModal, DebateTurnChoiceModal } from '@/components/modals';
import { PersonaModal } from '@/components/modals/PersonaModal';
import { DebateInterface } from '@/components/dashboard/DebateInterface';
import { DebateToolbar } from '@/components/dashboard/DebateToolbar';
import { CollaborativeChatListeners } from '@/components/dashboard/CollaborativeChatListeners';
import { useDebateMode } from '@/hooks/useDebateMode';
import { usePersonas } from '@/hooks/usePersonas';
import { useCollaborativeChatsManager } from '@/hooks/useCollaborativeChatsManager';
import { Message, ChatConfig, ReasoningConfig, Citation, WebSearchConfig, Chat, GeneratedImage, DebateConfig, MessageUsage, Persona, PersonaConfig } from '@/types/chat';
import * as chatService from '@/lib/services/chat-service';
import * as messageService from '@/lib/services/message-service';
import * as personaService from '@/lib/services/persona-service';
import { streamChat, GeneratedImage as StreamGeneratedImage } from '@/lib/services/openrouter-stream';
import { hasNativeReasoning, getReasoningConfigType, getDefaultMaxTokens } from '@/lib/utils/model-reasoning';
import { uploadFiles, uploadBase64Image } from '@/lib/services/upload-service';
import { fetchOpenRouterCredits } from '@/lib/services/openrouter-service';
import { extractMemoryTags, createMemoryObjects } from '@/lib/utils/memory-parser';
import { MemoryToast } from '@/components/common/MemoryToast';
import { SharedChatNotificationToast } from '@/components/common/SharedChatNotificationToast';
import { calculateAndSaveChatStats } from '@/lib/services/stats-service';
import { useIncognitoMode } from '@/hooks/useIncognitoMode';
import { addIncognitoMessage, getIncognitoChat, forceCleanIncognitoData } from '@/lib/services/incognito-service';
import { subscribeToFailedTranscriptions } from '@/lib/services/failed-transcription-service';

declare global {
  interface Window {
    __folderPasswordPromptActive?: boolean;
    __chatPasswordPromptActive?: boolean;
    __folderPasswordResolve?: (value: boolean) => void;
    __chatPasswordResolve?: (value: boolean) => void;
    forceCleanIncognito: () => void;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, userProfile, loading, updateUserProfile } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);

  // Handle Focus Mode with fullscreen
  const handleEnterFocusMode = useCallback(() => {
    setFocusMode(true);
    // Request fullscreen
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    }
  }, []);

  const handleExitFocusMode = useCallback(() => {
    setFocusMode(false);
    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  }, []);

  // Listen for fullscreen changes (e.g., user presses ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && focusMode) {
        setFocusMode(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [focusMode]);
  const [currentChatId, setCurrentChatId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [savingMessageIds, setSavingMessageIds] = useState<Set<string>>(new Set());
  const [chatName, setChatName] = useState('');
  const [displayedChatName, setDisplayedChatName] = useState('');
  const [isTypingChatName, setIsTypingChatName] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [failedTranscriptionsCount, setFailedTranscriptionsCount] = useState(0);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [guidedStudyEnabled, setGuidedStudyEnabled] = useState(false);
  const [deepThinkingEnabled, setDeepThinkingEnabled] = useState(false);
  const [deepThinkingDepth, setDeepThinkingDepth] = useState<'Baixa' | 'Média' | 'Alta'>('Média');
  const [reasoningMaxTokens, setReasoningMaxTokens] = useState<number | undefined>(undefined);
  const [openRouterBalance, setOpenRouterBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [attachmentsModalOpen, setAttachmentsModalOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [leaderboardModalOpen, setLeaderboardModalOpen] = useState(false);
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [parentFolderIdForSubfolder, setParentFolderIdForSubfolder] = useState<string | null>(null);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [editChatModalOpen, setEditChatModalOpen] = useState(false);
  const [shareChatModalOpen, setShareChatModalOpen] = useState(false);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<{ type: 'folder' | 'chat'; id: string; name: string; correctPassword: string; action?: 'edit' | 'delete' } | null>(null);
  const [sidebarRef, setSidebarRef] = useState<{ unlockFolder: (id: string) => void; unlockChat: (id: string) => void } | null>(null);
  const [editFolderModalOpen, setEditFolderModalOpen] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<{ id: string; name: string; color?: string; password?: string } | null>(null);
  const [deleteFolderModalOpen, setDeleteFolderModalOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [memoryToasts, setMemoryToasts] = useState<Array<{ id: string; count: number }>>([]);
  const isLoadingBalanceRef = useRef(false);
  const lastApiKeyRef = useRef<string | undefined>(undefined);
  const lastBalanceFetchRef = useRef<number>(0);
  const BALANCE_CACHE_TIME = 30000; // 30 segundos de cache
  const modelInitializedRef = useRef(false); // Track if model was initialized from userProfile
  
  // Persona states
  const [personaModalOpen, setPersonaModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  
  // Use personas hook to get real-time data
  const { personas } = usePersonas();

  // Debate Mode states
  const [debateConfigModalOpen, setDebateConfigModalOpen] = useState(false);
  const [debateEditModalOpen, setDebateEditModalOpen] = useState(false);
  const [debateStopConfirmModalOpen, setDebateStopConfirmModalOpen] = useState(false);
  const [debateTurnChoiceModalOpen, setDebateTurnChoiceModalOpen] = useState(false);
  const [debateModelSelectParticipant, setDebateModelSelectParticipant] = useState<1 | 2 | null>(null);
  const [debateEditModelSelectParticipant, setDebateEditModelSelectParticipant] = useState<1 | 2 | null>(null);
  const [debateSelectedModel1, setDebateSelectedModel1] = useState<string>('');
  const [debateSelectedModel2, setDebateSelectedModel2] = useState<string>('');
  const [debateEditSelectedModel1, setDebateEditSelectedModel1] = useState<string>('');
  const [debateEditSelectedModel2, setDebateEditSelectedModel2] = useState<string>('');
  const [currentDebatePointIndex, setCurrentDebatePointIndex] = useState<number>(0);

  // Debate Mode hook
  const {
    debateActive,
    debateSession,
    debateMessages,
    isDebateLoading,
    totalCost: debateTotalCost,
    totalTokens: debateTotalTokens,
    debateChatId,
    startDebate,
    stopDebate,
    pauseDebate,
    addDebatePoint,
    selectDebatePoint,
    startInitialPresentations,
    startDebateExchanges,
    moderatorIntervention,
    restoreDebate,
    deleteDebateMessage,
  } = useDebateMode(user?.uid);
  
  // Incognito Mode
  const { incognitoActive, toggleIncognito } = useIncognitoMode();
  
  // Collaborative Chats Manager
  const {
    notifications: sharedChatNotifications,
    clearNotification,
    addNotification,
    requestNotificationPermission,
  } = useCollaborativeChatsManager();
  
  // Shared chat notification toasts
  const [activeNotificationToast, setActiveNotificationToast] = useState<{
    chatId: string;
    chatName: string;
    messagePreview: string;
  } | null>(null);
  
  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);
  
  // Clean incognito data on mount (since mode doesn't persist after reload)
  useEffect(() => {
    // Always clean incognito data on page load
    // Since incognito mode is session-only, old data should be removed
    forceCleanIncognitoData();
    
    if (incognitoActive) {
      // If somehow still active (shouldn't happen), set up incognito mode
      // Always set incognito mode with clean state
      setCurrentChatId('incognito');
      setMessages([]); // Always start with empty messages
      setChatName('Modo Incógnito');
      setDisplayedChatName('Modo Incógnito');
      setIsTypingChatName(false);
      setWebSearchEnabled(false);
      setGuidedStudyEnabled(false);
      setDeepThinkingEnabled(false);
      setDeepThinkingDepth('Média');
      setSelectedModel(userProfile?.defaultModel || 'google/gemini-2.0-flash-exp:free');
      setCurrentChat(null);
      setHasLoadedChat(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount
  
  // Subscribe to failed transcriptions count
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToFailedTranscriptions(
      user.uid,
      (transcriptions) => {
        setFailedTranscriptionsCount(transcriptions.length);
      },
      (error) => {
        console.error('Error subscribing to failed transcriptions:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid]);
  
  // Validate messages in real-time and clean if duplicates detected
  useEffect(() => {
    if (incognitoActive && messages.length > 0) {
      const ids = new Set<string>();
      let hasDuplicate = false;
      let hasOldFormat = false;
      
      for (const msg of messages) {
        if (ids.has(msg.id)) {
          hasDuplicate = true;
          break;
        }
        const underscoreCount = (msg.id.match(/_/g) || []).length;
        if (underscoreCount < 2) {
          hasOldFormat = true;
          break;
        }
        ids.add(msg.id);
      }
      
      if (hasDuplicate || hasOldFormat) {
        console.warn('Detected invalid messages in state, cleaning...');
        forceCleanIncognitoData();
        setMessages([]);
      }
    }
  }, [messages, incognitoActive]);

  /**
   * Busca o saldo de créditos do OpenRouter
   * 
   * OTIMIZAÇÃO: Esta função só é chamada quando:
   * 1. O usuário entra no site (API key muda)
   * 2. O usuário atualiza as configurações da API key
   * 
   * O saldo NÃO é buscado após cada mensagem. Em vez disso, o custo
   * retornado pela API (usage.cost) é usado para decrementar o saldo
   * localmente em tempo real, evitando requisições desnecessárias.
   */
  const loadOpenRouterBalance = useCallback(async (forceRefresh = false) => {
    // Verifica se tem API Key no formato novo (array) ou antigo (string)
    const hasApiKey = (userProfile?.openRouterApiKeys && userProfile.openRouterApiKeys.length > 0) || userProfile?.openRouterApiKey;
    
    if (!hasApiKey) {
      setOpenRouterBalance(null);
      return;
    }

    // Prevent multiple simultaneous calls
    if (isLoadingBalanceRef.current) {
      return;
    }

    // Para o novo formato, pega a API Key ativa
    const activeApiKey = userProfile?.openRouterApiKeys?.find(k => k.isActive)?.id || userProfile?.openRouterApiKey;

    // Cache: não refazer a requisição se foi feita recentemente (exceto se forceRefresh)
    const now = Date.now();
    const timeSinceLastFetch = now - lastBalanceFetchRef.current;
    if (!forceRefresh && timeSinceLastFetch < BALANCE_CACHE_TIME && lastApiKeyRef.current === activeApiKey) {
      return;
    }

    isLoadingBalanceRef.current = true;
    setBalanceLoading(true);
    try {
      const balance = await fetchOpenRouterCredits();
      setOpenRouterBalance(balance);
      lastApiKeyRef.current = activeApiKey;
      lastBalanceFetchRef.current = now;
    } catch (error) {
      console.error('Erro ao buscar saldo do OpenRouter:', error);
      setOpenRouterBalance(null);
    } finally {
      setBalanceLoading(false);
      isLoadingBalanceRef.current = false;
    }
  }, [userProfile?.openRouterApiKey, userProfile?.openRouterApiKeys]);

  // Carregar saldo apenas na primeira vez (quando o componente monta)
  useEffect(() => {
    const hasApiKey = (userProfile?.openRouterApiKeys && userProfile.openRouterApiKeys.length > 0) || userProfile?.openRouterApiKey;
    
    // Carregar apenas na primeira vez (quando lastApiKeyRef está vazio)
    if (hasApiKey && !lastApiKeyRef.current && !isLoadingBalanceRef.current) {
      loadOpenRouterBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]); // Apenas quando userProfile está disponível pela primeira vez

  // Listener para forçar refresh do saldo quando API Key for trocada manualmente
  useEffect(() => {
    const handleRefreshBalance = () => {
      loadOpenRouterBalance(true); // Forçar refresh ignorando cache
    };

    window.addEventListener('refreshOpenRouterBalance', handleRefreshBalance);
    
    return () => {
      window.removeEventListener('refreshOpenRouterBalance', handleRefreshBalance);
    };
  }, [loadOpenRouterBalance]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Controla se o chat já foi carregado para evitar salvamentos prematuros
  const [hasLoadedChat, setHasLoadedChat] = useState(false);

  // Efeito de digitação suave para o nome do chat
  useEffect(() => {
    if (isTypingChatName && chatName) {
      let currentIndex = 0;
      setDisplayedChatName('');
      
      const typingInterval = setInterval(() => {
        if (currentIndex <= chatName.length) {
          setDisplayedChatName(chatName.substring(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(typingInterval);
          setIsTypingChatName(false);
        }
      }, 20); // 20ms por caractere para um efeito dinâmico e suave
      
      return () => clearInterval(typingInterval);
    } else if (!isTypingChatName) {
      // Se não está digitando, mostra o nome completo imediatamente
      setDisplayedChatName(chatName);
    }
  }, [chatName, isTypingChatName]);

  // Inicializar selectedModel quando userProfile carregar pela primeira vez
  useEffect(() => {
    if (userProfile?.defaultModel && !modelInitializedRef.current) {
      setSelectedModel(userProfile.defaultModel);
      modelInitializedRef.current = true;
    } else if (!userProfile && !modelInitializedRef.current && !loading) {
      // Se não tem userProfile depois de carregar, usa fallback
      setSelectedModel('google/gemini-2.0-flash-exp:free');
      modelInitializedRef.current = true;
    }
  }, [userProfile?.defaultModel, userProfile, loading]);

  // Sincronizar selectedModel APENAS quando troca de chat ou carrega chat
  // NÃO escuta userProfile.defaultModel para evitar sobrescrever modelo específico do chat
  useEffect(() => {
    if (!hasLoadedChat) return; // Aguarda chat carregar
    
    const defaultModel = userProfile?.defaultModel || 'google/gemini-2.0-flash-exp:free';
    
    // Se não há chat ativo E já foi inicializado, não faz nada (mantém o modelo padrão do perfil)
    if (!currentChatId && modelInitializedRef.current) {
      return;
    }
    
    // Se não há chat ativo E ainda não foi inicializado, usa defaultModel
    if (!currentChatId && !modelInitializedRef.current) {
      setSelectedModel(defaultModel);
    }
    // Se há chat ativo, usa modelo específico do chat OU defaultModel
    else if (currentChat) {
      // Se chat tem modelo específico, USA ELE (não sobrescreve!)
      if (currentChat.selectedModel) {
        setSelectedModel(currentChat.selectedModel);
      }
      // Se chat não tem modelo específico, usa defaultModel
      else {
        setSelectedModel(defaultModel);
      }
    }
  }, [currentChatId, currentChat, hasLoadedChat, userProfile?.defaultModel]); // userProfile?.defaultModel no final para não causar re-render desnecessário

  const handleNewChat = useCallback(() => {
    // Exit debate mode if active before creating new chat
    if (debateActive) {
      stopDebate();
    }
    setNewChatModalOpen(true);
  }, [debateActive, stopDebate]);

  const handleGoToEmptyChat = useCallback(() => {
    // Exit debate mode if active
    if (debateActive) {
      stopDebate();
    }
    
    // Clear current chat and messages to show empty state
    // DON'T create chat here - let handleSendMessage create it when user sends first message
    setCurrentChatId('');
    setMessages([]);
    setChatName('');
    setDisplayedChatName('');
    setWebSearchEnabled(false);
    setGuidedStudyEnabled(false);
    setDeepThinkingEnabled(false);
    setDeepThinkingDepth('Média');
    setIsTypingChatName(false);
    setHasLoadedChat(false);
    // Reset to default model
    setSelectedModel(userProfile?.defaultModel || 'google/gemini-2.0-flash-exp:free');
    setCurrentChat(null);
  }, [debateActive, stopDebate, userProfile?.defaultModel]);
  
  /**
   * Handle incognito mode toggle
   */
  const handleToggleIncognito = useCallback(() => {
    const defaultModel = userProfile?.defaultModel || 'google/gemini-2.0-flash-exp:free';
    const newState = toggleIncognito(defaultModel);
    
    if (newState) {
      // Incognito mode enabled - switch to incognito chat
      // Get fresh chat from localStorage (will auto-clean if invalid)
      const freshChat = getIncognitoChat();
      
      setCurrentChatId('incognito');
      setMessages(freshChat?.messages || []);
      setChatName('Modo Incógnito');
      setDisplayedChatName('Modo Incógnito');
      setIsTypingChatName(false);
      setWebSearchEnabled(freshChat?.webSearchEnabled || false);
      setGuidedStudyEnabled(freshChat?.guidedStudyEnabled || false);
      setDeepThinkingEnabled(freshChat?.deepThinkingEnabled || false);
      setDeepThinkingDepth(freshChat?.deepThinkingDepth || 'Média');
      setReasoningMaxTokens(freshChat?.reasoningMaxTokens);
      setSelectedModel(freshChat?.model || defaultModel);
      setCurrentChat(null);
      setHasLoadedChat(true);
    } else {
      // Incognito mode disabled - switch to new empty chat
      handleGoToEmptyChat();
    }
  }, [toggleIncognito, userProfile?.defaultModel, handleGoToEmptyChat]);

  const handleCreateChat = async (config: ChatConfig) => {
    if (!user) return;

    try {
      const chatId = await chatService.createChat(user.uid, config);
      
      setCurrentChatId(chatId);
      setChatName(config.name);
      setMessages([]);
      setNewChatModalOpen(false);
      setHasLoadedChat(false); // Will be set to true after loading
      
      // Reset feature toggles to default state for new chat
      setWebSearchEnabled(false);
      setGuidedStudyEnabled(false);
      setDeepThinkingEnabled(false);
      setDeepThinkingDepth('Média');
      
      // Define o modelo padrão para o novo chat (não salva no chat ainda)
      setSelectedModel(userProfile?.defaultModel || 'google/gemini-2.0-flash-exp:free');
      
      // Carregar o chat criado para ter os dados completos
      const chat = await chatService.getChat(user.uid, chatId);
      if (chat) {
        setCurrentChat(chat);
        setHasLoadedChat(true);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      alert('Erro ao criar chat. Tente novamente.');
    }
  };

  const handleSelectChat = useCallback(async (chatId: string) => {
    if (!user) return;
    
    // Exit debate mode if active
    if (debateActive) {
      stopDebate();
    }
    
    setCurrentChatId(chatId);
    setIsLoadingChat(true);
    setHasLoadedChat(false); // Reset flag
    
    // Clear notification for this chat if it's a shared chat
    if (chatId.includes('/')) {
      const [, actualChatId] = chatId.split('/');
      clearNotification(actualChatId);
    }
    
    try {
      // Load chat data
      const chat = await chatService.getChat(user.uid, chatId);
      if (chat) {
        setChatName(chat.name);
        setDisplayedChatName(chat.name);
        setIsTypingChatName(false);
        setCurrentChat(chat);
        
        // Check if this is a saved debate (new debates have isDebate flag, legacy debates have pattern in systemPrompt)
        const isDebateChat = chat.isDebate || chat.systemPrompt?.includes('🎭 Debate entre');
        
        if (isDebateChat && chat.debateConfig) {
          // Load debate messages using cache-first strategy
          const loadedMessages = await chatService.loadMessages(user.uid, chatId);
          
          // Restore debate state (does NOT create a new chat)
          await restoreDebate(chatId, chat.debateConfig, loadedMessages as Message[], chat.totalCost, chat.totalTokens);
          
          setMessages([]); // Clear regular messages
          setHasLoadedChat(true);
          setIsLoadingChat(false);
          return;
        } else if (isDebateChat && !chat.debateConfig) {
          // Legacy debate without config - can't restore properly
          // Fall through to load as regular chat
        }
        
        // Regular chat flow
        // Restaurar modelo específico do chat OU usar defaultModel
        if (chat.selectedModel) {
          setSelectedModel(chat.selectedModel);
        } else {
          // Se chat não tem modelo específico, usa defaultModel
          setSelectedModel(userProfile?.defaultModel || 'google/gemini-2.0-flash-exp:free');
        }
        
        // Restaurar webSearchEnabled do chat
        setWebSearchEnabled(chat.webSearchEnabled || false);
        
        // Restaurar guidedStudyEnabled do chat
        setGuidedStudyEnabled(chat.guidedStudyEnabled || false);
        
        // Restaurar deepThinkingEnabled e depth do chat
        setDeepThinkingEnabled(chat.deepThinkingEnabled || false);
        setDeepThinkingDepth(chat.deepThinkingDepth || 'Média');
        setReasoningMaxTokens(chat.reasoningMaxTokens);
      }
      
      // Load messages using cache-first strategy (FAST - instant from IndexedDB)
      // loadMessages uses loadMessagesWithCache which is now protected against race conditions
      const loadedMessages = await chatService.loadMessages(user.uid, chatId);
      setMessages(loadedMessages);
      
      // Marca que o chat foi carregado
      setHasLoadedChat(true);
    } catch (error) {
      console.error('Error loading chat:', error);
      // Fallback to empty messages if error
      setMessages([]);
      setHasLoadedChat(true);
    } finally {
      setIsLoadingChat(false);
    }
  }, [user, debateActive, stopDebate, userProfile?.defaultModel, restoreDebate, clearNotification]);

  // Memoized callbacks para InputBar
  const handleModelChange = useCallback(async (model: string) => {
    // Atualiza o modelo localmente
    setSelectedModel(model);
    
    // SEMPRE salva o modelo específico no chat quando o usuário seleciona manualmente
    if (incognitoActive) {
      // In incognito mode, update localStorage
      const { updateIncognitoChat } = await import('@/lib/services/incognito-service');
      updateIncognitoChat({ model });
    } else if (user && currentChatId && hasLoadedChat) {
      try {
        await chatService.updateChat(user.uid, currentChatId, {
          selectedModel: model,
        });
        
        setCurrentChat(prev => prev ? { ...prev, selectedModel: model } : null);
      } catch (error) {
        console.error('Error saving selected model:', error);
      }
    }
  }, [user, currentChatId, hasLoadedChat, incognitoActive]);

  const handleGuidedStudyChange = useCallback(async (enabled: boolean) => {
    // Update local state immediately for responsive UI
    setGuidedStudyEnabled(enabled);
    setCurrentChat(prev => prev ? { ...prev, guidedStudyEnabled: enabled } : null);
    
    // Save to Firestore if chat exists, or localStorage if incognito
    if (incognitoActive) {
      // In incognito mode, update localStorage
      const { updateIncognitoChat } = await import('@/lib/services/incognito-service');
      updateIncognitoChat({ guidedStudyEnabled: enabled });
    } else if (user && currentChatId && hasLoadedChat) {
      try {
        await chatService.updateChat(user.uid, currentChatId, {
          guidedStudyEnabled: enabled,
        });
      } catch (error) {
        console.error('Error saving guided study mode:', error);
      }
    }
  }, [user, currentChatId, hasLoadedChat, incognitoActive]);

  const handleWebSearchChange = useCallback(async (enabled: boolean) => {
    // Update local state immediately for responsive UI
    setWebSearchEnabled(enabled);
    setCurrentChat(prev => prev ? { ...prev, webSearchEnabled: enabled } : null);
    
    // Save to Firestore if chat exists, or localStorage if incognito
    if (incognitoActive) {
      // In incognito mode, update localStorage
      const { updateIncognitoChat } = await import('@/lib/services/incognito-service');
      updateIncognitoChat({ webSearchEnabled: enabled });
    } else if (user && currentChatId && hasLoadedChat) {
      try {
        await chatService.updateChat(user.uid, currentChatId, {
          webSearchEnabled: enabled,
        });
      } catch (error) {
        console.error('Error saving web search mode:', error);
      }
    }
  }, [user, currentChatId, hasLoadedChat, incognitoActive]);

  const handleDeepThinkingChange = useCallback(async (enabled: boolean, depth?: 'Baixa' | 'Média' | 'Alta', maxTokens?: number) => {
    // Update local state immediately for responsive UI
    setDeepThinkingEnabled(enabled);
    if (depth) {
      setDeepThinkingDepth(depth);
    }
    if (maxTokens !== undefined) {
      setReasoningMaxTokens(maxTokens);
    }
    
    const updates: Partial<Chat> = { deepThinkingEnabled: enabled };
    if (depth) {
      updates.deepThinkingDepth = depth;
    }
    if (maxTokens !== undefined) {
      updates.reasoningMaxTokens = maxTokens;
    }
    
    setCurrentChat(prev => prev ? { ...prev, ...updates } : null);
    
    // Save to Firestore if chat exists, or localStorage if incognito
    if (incognitoActive) {
      // In incognito mode, update localStorage
      const { updateIncognitoChat } = await import("@/lib/services/incognito-service");
      updateIncognitoChat({ 
        deepThinkingEnabled: enabled,
        deepThinkingDepth: depth || deepThinkingDepth,
        reasoningMaxTokens: maxTokens !== undefined ? maxTokens : reasoningMaxTokens
      });
    } else if (user && currentChatId && hasLoadedChat) {
      try {
        await chatService.updateChat(user.uid, currentChatId, updates);
      } catch (error) {
        console.error('Error saving deep thinking mode:', error);
      }
    }
  }, [user, currentChatId, hasLoadedChat, deepThinkingDepth, reasoningMaxTokens, incognitoActive]);
  const handleSendMessage = useCallback(async (
    content: string, 
    files: File[], 
    options?: { 
      deepThinking?: { enabled: boolean; depth: 'Baixa' | 'Média' | 'Alta'; maxTokens?: number };
      webSearch?: boolean;
      guidedStudy?: boolean;
    }
  ) => {
    if (!user) return;
    
    const effectiveGuidedStudy = options?.guidedStudy ?? guidedStudyEnabled;
    const effectiveWebSearch = options?.webSearch ?? webSearchEnabled;
    const effectiveDeepThinkingEnabled = options?.deepThinking?.enabled ?? deepThinkingEnabled;
    const effectiveDeepThinkingDepth = options?.deepThinking?.depth ?? deepThinkingDepth;
    const effectiveReasoningMaxTokens = options?.deepThinking?.maxTokens ?? reasoningMaxTokens;

    // Check if user has API Key (supports both old and new format)
    const hasApiKey = (userProfile?.openRouterApiKeys && userProfile.openRouterApiKeys.length > 0) || userProfile?.openRouterApiKey;
    if (!hasApiKey) {
      alert('Por favor, configure sua OpenRouter API Key nas configurações antes de enviar mensagens.');
      setSettingsModalOpen(true);
      return;
    }
    
    try {
      // ============================================
      // AUTO CHAT CREATION (if needed)
      // ============================================
      let activeChatId = currentChatId;
      let autoCreatedChat: Chat | null = null;
      
      // If no chat exists, create auto chat (for first message or after clicking profile)
      if (!activeChatId && !incognitoActive) {
        
        // Create auto chat
        const newChatId = await chatService.createChatAuto(user.uid, {
          selectedModel,
          guidedStudyEnabled: effectiveGuidedStudy,
          webSearchEnabled: effectiveWebSearch,
          deepThinkingEnabled: effectiveDeepThinkingEnabled,
          deepThinkingDepth: effectiveDeepThinkingDepth,
        });
        
        activeChatId = newChatId;
        setCurrentChatId(newChatId);
        
        // Set temporary name (will be shown in Firestore/Sidebar)
        const tempName = `Chat ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        setChatName(tempName);
        setDisplayedChatName(tempName); // Show temp name initially
        setIsTypingChatName(false);
        setHasLoadedChat(true);
        
        // Persist initial settings (model + feature toggles) to the new chat
        await chatService.updateChat(user.uid, newChatId, {
          selectedModel,
          guidedStudyEnabled: effectiveGuidedStudy,
          webSearchEnabled: effectiveWebSearch,
          deepThinkingEnabled: effectiveDeepThinkingEnabled,
          deepThinkingDepth: effectiveDeepThinkingDepth,
        });
        
        // Load the created chat
        const newChat = await chatService.getChat(user.uid, newChatId);
        if (newChat) {
          autoCreatedChat = {
            ...newChat,
            guidedStudyEnabled: newChat.guidedStudyEnabled ?? effectiveGuidedStudy,
            webSearchEnabled: newChat.webSearchEnabled ?? effectiveWebSearch,
            deepThinkingEnabled: newChat.deepThinkingEnabled ?? effectiveDeepThinkingEnabled,
            deepThinkingDepth: newChat.deepThinkingDepth ?? effectiveDeepThinkingDepth,
          };
          setCurrentChat(autoCreatedChat);
          // Sync UI toggles with persisted chat values (fallback to existing state if undefined)
          if (typeof autoCreatedChat.guidedStudyEnabled === 'boolean') {
            setGuidedStudyEnabled(autoCreatedChat.guidedStudyEnabled);
          }
          if (typeof autoCreatedChat.webSearchEnabled === 'boolean') {
            setWebSearchEnabled(autoCreatedChat.webSearchEnabled);
          }
          if (typeof autoCreatedChat.deepThinkingEnabled === 'boolean') {
            setDeepThinkingEnabled(autoCreatedChat.deepThinkingEnabled);
          }
          if (autoCreatedChat.deepThinkingDepth) {
            setDeepThinkingDepth(autoCreatedChat.deepThinkingDepth);
          }
          if (autoCreatedChat.selectedModel) {
            setSelectedModel(autoCreatedChat.selectedModel);
          }
        }
      } else if (incognitoActive) {
        // In incognito mode, use 'incognito' as chatId
        activeChatId = 'incognito';
      }

      // ============================================
      // OPTIMISTIC UI - USER MESSAGE (IMMEDIATE)
      // ============================================
      // Create preview attachments immediately for instant UI feedback
      const previewAttachments = files.map((file) => ({
        id: `temp_${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: '', // Will be filled after upload
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }));
      
      const tempUserMessageId = `temp_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const tempUserMessage: Message = {
        id: tempUserMessageId,
        role: 'user',
        content,
        createdAt: new Date(),
        attachments: previewAttachments, // Show previews immediately
      };
      
      // Add user message to UI immediately (Optimistic UI)
      setMessages((prev) => [...prev, tempUserMessage]);
      
      // Set loading state AFTER adding user message to avoid showing typing indicator first
      setIsAILoading(true);
      
      // ============================================
      // OPTIMISTIC UI - ASSISTANT MESSAGE PLACEHOLDER (IMMEDIATE)
      // ============================================
      // Create assistant message placeholder immediately for faster perceived response
      const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: new Date(),
        model: selectedModel,
        isStreaming: true,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      // ============================================
      // UPLOAD DE ANEXOS (BACKGROUND)
      // ============================================
      // Start upload immediately but don't block UI - store promise for later await
      const uploadPromise = files.length > 0 
        ? uploadFiles(files, user.uid, activeChatId)
        : Promise.resolve([]);
      
      // Prepare storage for uploaded attachments
      let uploadedAttachments: Array<{
        id: string;
        name: string;
        type: string;
        size: number;
        url: string;
        storageRef?: string;
        base64?: string;
        preview?: string;
      }> = [];
      
      // If this is first message of auto-created chat, show "Generating name..." in Upperbar
      const checkChat = autoCreatedChat || currentChat;
      if (checkChat?.isTemporary && checkChat?.isFirstMessage) {
        setDisplayedChatName('___GENERATING___');
      }
      
      // Wait for upload to complete before saving to Firebase/localStorage
      // This ensures we have real URLs for attachments
      if (files.length > 0) {
        try {
          const uploadResults = await uploadPromise;
          uploadedAttachments = uploadResults
            .filter(r => r.success && r.attachment)
            .map(r => r.attachment!);
            
          // Update UI immediately with final attachments
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempUserMessageId
                ? { ...msg, attachments: uploadedAttachments }
                : msg
            )
          );
          
          // Check for failed uploads
          const failedUploads = uploadResults.filter(r => !r.success);
          if (failedUploads.length > 0) {
            console.error('Falha em alguns uploads:', failedUploads);
            alert(`${failedUploads.length} arquivo(s) não puderam ser enviados. Continuando com os demais...`);
          }
        } catch (error) {
          console.error('Erro ao fazer upload de arquivos:', error);
          alert('Erro ao fazer upload dos arquivos. Tente novamente.');
          setIsAILoading(false);
          return; // Stop execution if upload fails
        }
      }
      
      // Save user message - different behavior for incognito mode
      let userMessage: Message;
      if (incognitoActive) {
        // In incognito mode, save to localStorage instead of Firebase
        userMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          role: 'user',
          content,
          createdAt: new Date(),
          attachments: uploadedAttachments,
        };
        addIncognitoMessage(userMessage);
      } else {
        // Normal mode: save to Firebase Storage
        // Mark temp message as saving (disable edit/delete buttons)
        setSavingMessageIds(prev => new Set(prev).add(tempUserMessageId));
        
        userMessage = await chatService.addMessage(user.uid, activeChatId, {
          role: 'user',
          content,
          attachments: uploadedAttachments,
        });
        
        // Capture the real message ID for setTimeout
        const realMessageId = userMessage.id;
        
        // Wait 2 seconds before enabling edit/delete buttons on user message
        // Now that IDs are correct, a short delay is enough
        setTimeout(() => {
          setSavingMessageIds(prev => {
            const next = new Set(prev);
            next.delete(tempUserMessageId);
            next.delete(realMessageId);
            return next;
          });
        }, 2000);
      }
      
      // Update with saved message (replaces temp message with real ID)
      // CRITICAL: Do this synchronously to ensure UI has the real ID
      setMessages((prev) => 
        prev.map((msg) => msg.id === tempUserMessageId ? userMessage : msg)
      );
      
      // Transfer saving state to real message ID
      // Also update immediately after messages update
      if (!incognitoActive) {
        // Use the real message ID directly, not from closure
        const realMsgId = userMessage.id;
        setSavingMessageIds(prev => {
          const next = new Set(prev);
          next.delete(tempUserMessageId);
          next.add(realMsgId);
          return next;
        });
        
        console.log(`✅ [handleSendMessage] Transferred saving state from ${tempUserMessageId} to ${realMsgId}`);
      }

      // Assistant message placeholder already created above for instant UI feedback
      
      // 4. Build reasoning config based on model and deep thinking settings
      let reasoningConfig: ReasoningConfig | undefined;
      
      // Check if model has native reasoning (always active internally)
      const modelHasNativeReasoning = hasNativeReasoning(selectedModel);
      
      // For models with native reasoning: always send config, toggle controls visibility
      // For other models: only send config if toggle is enabled
      if (modelHasNativeReasoning || effectiveDeepThinkingEnabled) {
        const configType = getReasoningConfigType(selectedModel);
        const depthMap = {
          'Baixa': { effort: 'low' as const, maxTokens: 2000 },
          'Média': { effort: 'medium' as const, maxTokens: 4000 },
          'Alta': { effort: 'high' as const, maxTokens: 8000 },
        };
        const depthConfig = depthMap[effectiveDeepThinkingDepth];
        
        if (configType === 'max_tokens') {
          const maxTokensValue = effectiveReasoningMaxTokens || getDefaultMaxTokens(selectedModel);
          reasoningConfig = {
            enabled: true,
            max_tokens: maxTokensValue,
          };
          
          // For models with native reasoning: use exclude to control visibility
          if (modelHasNativeReasoning && !effectiveDeepThinkingEnabled) {
            reasoningConfig.exclude = true; // Reasoning works but doesn't show in response
          }
        } else {
          reasoningConfig = {
            enabled: true,
            effort: depthConfig.effort,
          };
          
          // For models with native reasoning: use exclude to control visibility
          if (modelHasNativeReasoning && !effectiveDeepThinkingEnabled) {
            reasoningConfig.exclude = true; // Reasoning works but doesn't show in response
          }
        }
      }

      // 5. Build web search config
      let webSearchConfig: WebSearchConfig | undefined;
      if (effectiveWebSearch) {
        webSearchConfig = {
          enabled: true,
          engine: undefined, // Auto: uses native if available, else Exa
          max_results: 5,
        };
      }

      // 6. Prepare conversation history (all previous messages with active attachments only)
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        attachments: msg.attachments?.filter(att => att.isActive !== false), // Only include active attachments
      }));

      // ============================================
      // STREAM AI RESPONSE
      // ============================================
      let fullContent = '';
      let fullReasoning = '';
      let citations: Citation[] = [];
      const generatedImages: GeneratedImage[] = [];
      const uploadedImageUrls = new Set<string>();
      let messageCost = 0; // Cost of this message in dollars
      let messageTokens = 0; // Total tokens used in this message
      let messageUsage: MessageUsage | undefined; // Usage data for the message
      
      // Determine auto-naming flags (use autoCreatedChat if just created, otherwise currentChat)
      const chatForFlags = autoCreatedChat || currentChat;
      const chatMemoriesToSend = chatForFlags?.memories ?? undefined;
      const personaConfigToSend = chatForFlags?.personaConfig ?? undefined;
      
      await streamChat({
        chatId: activeChatId,
        message: content,
        userId: user.uid,
        userName: incognitoActive ? undefined : userProfile?.displayName, // User's display name (disabled in incognito)
        userNickname: incognitoActive ? undefined : userProfile?.nickname, // User's preferred nickname (disabled in incognito)
        userAbout: incognitoActive ? undefined : userProfile?.aboutYou, // Additional information about the user (disabled in incognito)
        apiKey: userProfile.openRouterApiKey || '', // Backend will fetch from Firestore if empty
        model: selectedModel,
        conversationHistory, // Send full conversation history
        attachments: uploadedAttachments,
        pdfEngine: userProfile.pdfEngine,
        reasoning: reasoningConfig,
        webSearch: webSearchConfig,
        guidedStudy: effectiveGuidedStudy,
        globalMemories: incognitoActive ? undefined : userProfile.globalMemories, // User's global memories (disabled in incognito)
        chatMemories: incognitoActive ? undefined : chatMemoriesToSend, // Chat-specific memories (disabled in incognito)
        aiPersonalities: incognitoActive ? undefined : userProfile.aiPersonalities, // User's custom AI personalities (disabled in incognito)
        personaConfig: personaConfigToSend, // Persona configuration (if this is a persona chat)
        generateImages: true, // Enable image generation if model supports it
        isFirstMessage: chatForFlags?.isFirstMessage,
        isAutoCreatedChat: chatForFlags?.createdManually !== true,
        // Chat generation settings
        temperature: chatForFlags?.temperature,
        maxTokens: chatForFlags?.maxTokens,
        frequencyPenalty: chatForFlags?.frequencyPenalty,
        repetitionPenalty: chatForFlags?.repetitionPenalty,
        
        onChunk: (chunk) => {
          // Accumulate raw content (with memory tags)
          // Tags will be processed at the end to avoid fragmented tags in streaming
          fullContent += chunk;
          
          // Update UI with raw content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + chunk }
                : msg
            )
          );
        },
        
        onReasoning: (reasoning) => {
          fullReasoning += reasoning;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, reasoning: (msg.reasoning || '') + reasoning }
                : msg
            )
          );
        },
        
        onImages: async (images: StreamGeneratedImage[]) => {
          // Process generated images: upload to Storage
          for (const img of images) {
            const imageDataUrl = img.image_url.url;

            // Avoid processing the same image multiple times (OpenRouter may resend in stream)
            if (uploadedImageUrls.has(imageDataUrl)) {
              continue;
            }

            try {
              const imageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const uploadResult = await uploadBase64Image(
                imageDataUrl,
                user.uid,
                activeChatId,
                imageId
              );
              
              const generatedImage: GeneratedImage = {
                id: imageId,
                url: uploadResult.url,
                storageRef: uploadResult.storagePath,
                createdAt: new Date(),
                size: uploadResult.size,
              };
              
              generatedImages.push(generatedImage);
              
              // Update UI immediately with the new image
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, generatedImages: [...(msg.generatedImages || []), generatedImage] }
                    : msg
                )
              );
            } catch (error) {
              console.error('Erro ao salvar imagem gerada:', error);
            }
          }
        },
        
        onAnnotations: (annotations) => {
          // Parse OpenRouter annotations to citations
          const newCitations = annotations
            .filter((ann) => ann.type === 'url_citation')
            .map((ann) => ({
              title: ann.url_citation?.title || 'Web Result',
              url: ann.url_citation?.url || '',
              content: ann.url_citation?.content,
              snippet: ann.url_citation?.content,
              start_index: ann.url_citation?.start_index,
              end_index: ann.url_citation?.end_index,
            }));
          
          citations = [...citations, ...newCitations];
          
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, citations }
                : msg
            )
          );
        },
        
        onUsage: (usage) => {
          // Capture usage data (cost, tokens)
          messageCost = usage.cost || 0;
          messageTokens = usage.tokens || usage.total_tokens || 0;
          
          // Capture detailed usage data for the message
          // Check if reasoning was actually used (native reasoning models or explicitly enabled)
          const wasReasoningUsed = modelHasNativeReasoning || reasoningConfig?.enabled;
          
          messageUsage = {
            promptTokens: usage.promptTokens || usage.prompt_tokens || 0,
            completionTokens: usage.completionTokens || usage.completion_tokens || 0,
            totalTokens: messageTokens,
            reasoningTokens: usage.reasoningTokens || usage.completion_tokens_details?.reasoning_tokens,
            cachedTokens: usage.cachedTokens || usage.prompt_tokens_details?.cached_tokens,
            cost: messageCost,
            upstreamCost: usage.upstreamCost || usage.cost_details?.upstream_inference_cost,
            apiKeyName: usage.apiKeyName,
            reasoningEnabled: wasReasoningUsed,
            reasoningEffort: reasoningConfig?.effort,
            reasoningMaxTokens: reasoningConfig?.max_tokens,
          };
          
          
          // Decrementar saldo localmente em tempo real
          if (messageCost > 0) {
            setOpenRouterBalance(prev => {
              if (prev === null) return prev;
              return Math.max(0, prev - messageCost);
            });
          }
        },
        
        onChatNameUpdate: async (chatName, cleanedResponse) => {
          // Backend already updated Firestore, we just need to update UI
          // Update chat name in UI with typing animation
          setChatName(chatName);
          setIsTypingChatName(true); // Activate typing animation
          
          // Update fullContent with cleaned response (without tags)
          fullContent = cleanedResponse;
          
          // Update message content immediately with cleaned response
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: cleanedResponse }
                : msg
            )
          );
          
          // Update currentChat to reflect changes (critical for preventing re-naming)
          const updatedChatData: Chat = {
            ...(autoCreatedChat || currentChat!),
            name: chatName,
            isTemporary: false,
            isFirstMessage: false,
          };
          
          setCurrentChat(updatedChatData);
          
          // Also update autoCreatedChat if it exists (for this same render cycle)
          if (autoCreatedChat) {
            autoCreatedChat.isFirstMessage = false;
            autoCreatedChat.isTemporary = false;
            autoCreatedChat.name = chatName;
          }
          
        },
        
        onComplete: async () => {
          // ============================================
          // PROCESS MEMORY TAGS FROM COMPLETE CONTENT
          // ============================================
          // Now that streaming is complete, process memory tags from fullContent
          const { cleanContent, memories } = extractMemoryTags(fullContent);
          
          // Update message with cleaned content (no tags) - generatedImages already added by onImages
          let finalMessage: Message | undefined;
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMessageId) {
                const updated: Message = { 
                  ...msg, 
                  content: cleanContent, 
                  isStreaming: false,
                  usage: messageUsage, // Add usage data to the message state
                  // Don't override - generatedImages were already added by onImages callback
                };
                finalMessage = updated;
                return updated;
              }
              return msg;
            })
          );
          
          // Set loading to false
          setIsAILoading(false);
          
          // Save assistant message - different behavior for incognito mode
          const imagesToSave = (finalMessage?.generatedImages && finalMessage.generatedImages.length > 0)
            ? finalMessage.generatedImages
            : generatedImages;
          
          if (cleanContent || imagesToSave.length > 0 || citations.length > 0 || fullReasoning) {
            if (incognitoActive) {
              // In incognito mode, save to localStorage instead of Firebase
              const assistantMsg: Message = {
                id: assistantMessageId,
                role: 'assistant',
                content: cleanContent || '',
                createdAt: new Date(),
                model: selectedModel,
                reasoning: fullReasoning || undefined,
                citations: citations.length > 0 ? citations : undefined,
                generatedImages: imagesToSave.length > 0 ? imagesToSave : undefined,
                webSearchEnabled: effectiveWebSearch,
                usage: messageUsage,
              };
              addIncognitoMessage(assistantMsg);
            } else {
              // Normal mode: save to Firebase Storage
              // Mark message as saving (disable edit/delete buttons)
              setSavingMessageIds(prev => new Set(prev).add(assistantMessageId));
              
              try {
                // CRITICAL: addMessage returns the message with REAL ID from Firebase
                const savedAssistantMessage = await chatService.addMessage(user.uid, activeChatId, {
                  role: 'assistant',
                  content: cleanContent || '',
                  model: selectedModel,
                  reasoning: fullReasoning || undefined,
                  citations: citations.length > 0 ? citations : undefined,
                  generatedImages: imagesToSave.length > 0 ? imagesToSave : undefined,
                  webSearchEnabled: options?.webSearch,
                  usage: messageUsage,
                });
                
                // Update chat metadata
                await chatService.updateChatAfterMessage(user.uid, activeChatId, cleanContent || 'Imagem gerada');
                
                // CRITICAL: Replace placeholder ID with real ID in messages state
                const realAssistantId = savedAssistantMessage.id;
                setMessages(prev => 
                  prev.map(msg => msg.id === assistantMessageId ? savedAssistantMessage : msg)
                );
                
                // Transfer saving state from placeholder to real ID
                setSavingMessageIds(prev => {
                  const next = new Set(prev);
                  next.delete(assistantMessageId);
                  next.add(realAssistantId);
                  return next;
                });
                
                console.log(`✅ [handleSendMessage] Replaced assistant placeholder ${assistantMessageId} with real ID ${realAssistantId}`);
                
                // Capture real message ID for setTimeout closure
                const messageIdToRemove = realAssistantId;
                
                // Wait 2 seconds before enabling edit/delete buttons
                // Now that IDs are correct, a short delay is enough
                setTimeout(() => {
                  setSavingMessageIds(prev => {
                    const next = new Set(prev);
                    next.delete(messageIdToRemove);
                    return next;
                  });
                }, 2000);
              } catch (error) {
                // On error, remove immediately
                setSavingMessageIds(prev => {
                  const next = new Set(prev);
                  next.delete(assistantMessageId);
                  return next;
                });
                throw error;
              }
            }
          }
          
          // ============================================
          // SAVE ACCUMULATED COST AND TOKENS TO CHAT
          // ============================================
          // Skip in incognito mode
          if (!incognitoActive && (messageCost > 0 || messageTokens > 0)) {
            try {
              // Get current chat to get existing totals
              const chat = await chatService.getChat(user.uid, activeChatId);
              const currentTotalCost = chat?.totalCost || 0;
              const currentTotalTokens = chat?.totalTokens || 0;
              const newTotalCost = currentTotalCost + messageCost;
              const newTotalTokens = currentTotalTokens + messageTokens;
              
              // Update chat with accumulated cost and tokens
              await chatService.updateChat(user.uid, activeChatId, {
                totalCost: newTotalCost,
                totalTokens: newTotalTokens,
              });
              
              // Update local state immediately so modal shows updated values
              setCurrentChat(prev => prev ? { 
                ...prev, 
                totalCost: newTotalCost,
                totalTokens: newTotalTokens 
              } : prev);
            } catch (error) {
              console.error('Erro ao salvar custo e tokens do chat:', error);
              // Don't show error to user, just log it
            }
          }
          
          // ============================================
          // SAVE AUTOMATIC MEMORIES
          // ============================================
          // Skip in incognito mode - memories are not saved
          if (!incognitoActive && memories.length > 0) {
            try {
              // Convert to full Memory objects
              const newMemories = createMemoryObjects(memories);
              
              // Get current global memories
              const currentMemories = userProfile.globalMemories || [];
              
              // Add new memories to the beginning of the array
              const updatedMemories = [...newMemories, ...currentMemories];
              
              // Update user profile with new memories
              await updateUserProfile({ globalMemories: updatedMemories });
              
              // Show toast notification
              const toastId = `toast_${Date.now()}`;
              setMemoryToasts(prev => [...prev, { id: toastId, count: newMemories.length }]);
            } catch (error) {
              console.error('Erro ao salvar memórias automáticas:', error);
              // Don't show error to user, just log it
            }
          }
          
          // Saldo já foi decrementado localmente no onUsage
          // Não precisa fazer nova requisição ao OpenRouter
        },
        
        onError: (error) => {
          console.error('Streaming error:', error);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: `❌ Erro: ${error.message}`, isStreaming: false }
                : msg
            )
          );
          setIsAILoading(false);
          // Se houver custo parcial, ele já foi decrementado no onUsage
          // Não precisa fazer nova requisição ao OpenRouter
        },
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setIsAILoading(false);
      alert('Erro ao enviar mensagem. Tente novamente.');
    }
  }, [user, userProfile, selectedModel, currentChatId, currentChat, messages, updateUserProfile, incognitoActive, guidedStudyEnabled, webSearchEnabled, deepThinkingEnabled, deepThinkingDepth, reasoningMaxTokens]);

  const handleToggleAttachment = async (attachmentId: string, isActive: boolean) => {
    if (!user || !currentChatId) return;
    
    try {
      // Update in local state and capture the updated messages
      let updatedMessages: Message[] = [];
      setMessages((prev) => {
        updatedMessages = prev.map((msg) => ({
          ...msg,
          attachments: msg.attachments?.map((att) =>
            att.id === attachmentId ? { ...att, isActive } : att
          ),
        }));
        return updatedMessages;
      });

      // Persist to storage using the captured updated messages
      await chatService.saveMessages(user.uid, currentChatId, updatedMessages);
    } catch (error) {
      console.error('Error toggling attachment:', error);
      alert('Erro ao atualizar anexo. Tente novamente.');
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, storageRef: string) => {
    if (!user || !currentChatId) return;
    
    // Confirmar a exclusão
    if (!confirm('Tem certeza que deseja excluir este anexo? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    try {
      // Delete from Firebase Storage
      const { deleteAttachment } = await import('@/lib/services/upload-service');
      await deleteAttachment(storageRef);
      
      // Update in local state and capture the updated messages
      let updatedMessages: Message[] = [];
      setMessages((prev) => {
        updatedMessages = prev.map((msg) => ({
          ...msg,
          attachments: msg.attachments?.filter((att) => att.id !== attachmentId),
        }));
        return updatedMessages;
      });

      // Persist to storage using the captured updated messages
      await chatService.saveMessages(user.uid, currentChatId, updatedMessages);
    } catch (error) {
      console.error('Error deleting attachment:', error);
      alert('Erro ao excluir anexo. Tente novamente.');
    }
  };

  const handleCreateFolder = async (name: string, color?: string, password?: string, parentFolderId?: string | null) => {
    if (!user) return;
    
    try {
      await chatService.createFolder(user.uid, name, color, password, parentFolderId || null);
      // Folder will appear automatically via real-time listener in Sidebar
      setParentFolderIdForSubfolder(null);
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Erro ao criar pasta. Tente novamente.');
    }
  };

  const handleOpenCreateSubfolder = (parentFolderId: string) => {
    setParentFolderIdForSubfolder(parentFolderId);
    setCreateFolderModalOpen(true);
  };

  // Helper function to find folder recursively in hierarchy
  const findFolderRecursive = (folders: Array<{ id: string; subfolders?: Array<{ id: string }> }>, folderId: string): { id: string; name?: string; color?: string; password?: string } | null => {
    for (const folder of folders) {
      if (folder.id === folderId) return folder;
      if (folder.subfolders && folder.subfolders.length > 0) {
        const found = findFolderRecursive(folder.subfolders, folderId);
        if (found) return found;
      }
    }
    return null;
  };

  const handleRequestFolderPassword = async (folderId: string, folderName: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Get folder data to retrieve password (force fresh from Firestore)
      const { invalidateMetadataCache } = await import('@/lib/db/metadata-cache');
      await invalidateMetadataCache(user.uid);
      
      const folders = await chatService.getUserFolders(user.uid);
      const folder = findFolderRecursive(folders, folderId);
      
      if (!folder) {
        console.error('Folder not found', { folderId, folderName });
        alert('Pasta não encontrada.');
        return false;
      }
      
      if (!folder.password || folder.password === null || folder.password === '') {
        console.warn('Folder has no password configured', { folderId, folderName, password: folder.password });
        // If no password, just expand without asking
        return true;
      }
      
      setPasswordTarget({
        type: 'folder',
        id: folderId,
        name: folderName,
        correctPassword: folder.password,
      });
      setPasswordModalOpen(true);
      
      // Return a promise that resolves when password is verified
      return new Promise((resolve) => {
        const resolver = (value: boolean) => {
          resolve(value);
        };
        window.__folderPasswordResolve = resolver;
      });
    } catch (error) {
      console.error('Error getting folder password:', error);
      alert('Erro ao verificar senha. Tente novamente.');
      return false;
    }
  };

  const handleRequestChatPassword = async (chatId: string, chatName: string, action?: 'edit' | 'delete'): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Get chat data to retrieve password
      const chat = await chatService.getChat(user.uid, chatId);
      
      if (!chat || !chat.password) {
        console.error('Chat not found or has no password');
        return false;
      }
      
      setPasswordTarget({
        type: 'chat',
        id: chatId,
        name: chatName,
        correctPassword: chat.password,
        action,
      });
      setPasswordModalOpen(true);
      
      // Return a promise that resolves when password is verified
      return new Promise((resolve) => {
        // This will be resolved in handleVerifyPassword
        window.__chatPasswordResolve = (value: boolean) => {
          resolve(value);
        };
      });
    } catch (error) {
      console.error('Error getting chat password:', error);
      alert('Erro ao verificar senha. Tente novamente.');
      return false;
    }
  };

  const handleRequestFolderPasswordForAction = async (folderId: string, folderName: string, action: 'edit' | 'delete'): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Get folder data to retrieve password (force fresh from Firestore)
      const { invalidateMetadataCache } = await import('@/lib/db/metadata-cache');
      await invalidateMetadataCache(user.uid);
      
      const folders = await chatService.getUserFolders(user.uid);
      const folder = findFolderRecursive(folders, folderId);
      
      if (!folder) {
        console.error('Folder not found', { folderId, folderName });
        alert('Pasta não encontrada.');
        return false;
      }
      
      if (!folder.password || folder.password === null || folder.password === '') {
        console.error('Folder has no password configured - cannot perform protected action');
        alert('Esta pasta não tem senha configurada.');
        return false;
      }
      
      setPasswordTarget({
        type: 'folder',
        id: folderId,
        name: folderName,
        correctPassword: folder.password,
        action,
      });
      setPasswordModalOpen(true);
      
      // Wait for password verification
      return new Promise((resolve) => {
        // This will be resolved in handleVerifyPassword
        window.__folderPasswordResolve = (value: boolean) => {
          resolve(value);
        };
      });
    } catch (error) {
      console.error('Error getting folder password:', error);
      alert('Erro ao verificar senha. Tente novamente.');
      return false;
    }
  };

  const handleVerifyPassword = async (enteredPassword: string): Promise<boolean> => {
    if (!passwordTarget) return false;
    
    const isCorrect = enteredPassword === passwordTarget.correctPassword;
    
    if (isCorrect) {
      // Resolve the promise for folder actions
      if (window.__folderPasswordResolve) {
        window.__folderPasswordResolve(true);
        delete window.__folderPasswordResolve;
      }
      
      // Resolve the promise for chat actions
      if (window.__chatPasswordResolve) {
        window.__chatPasswordResolve(true);
        delete window.__chatPasswordResolve;
      }
      
      // Unlock the folder or chat in Sidebar
      if (passwordTarget.type === 'folder' && sidebarRef) {
        sidebarRef.unlockFolder(passwordTarget.id);
      } else if (passwordTarget.type === 'chat') {
        if (sidebarRef) {
          sidebarRef.unlockChat(passwordTarget.id);
        }
        // Only load the chat if not deleting
        if (passwordTarget.action !== 'delete') {
          await handleSelectChat(passwordTarget.id);
        }
      }
    } else {
      // Reject the promise for folder actions
      if (window.__folderPasswordResolve) {
        window.__folderPasswordResolve(false);
        delete window.__folderPasswordResolve;
      }
      
      // Reject the promise for chat actions
      if (window.__chatPasswordResolve) {
        window.__chatPasswordResolve(false);
        delete window.__chatPasswordResolve;
      }
    }
    
    return isCorrect;
  };
  
  const handleOpenFolderSettings = async (folderId: string) => {
    if (!user) return;
    
    try {
      const folders = await chatService.getUserFolders(user.uid);
      
      // Recursively search for folder (including subfolders)
      const findFolderRecursive = (folderList: typeof folders): typeof folders[0] | null => {
        for (const folder of folderList) {
          if (folder.id === folderId) {
            return folder;
          }
          if (folder.subfolders && folder.subfolders.length > 0) {
            const found = findFolderRecursive(folder.subfolders);
            if (found) return found;
          }
        }
        return null;
      };
      
      const folder = findFolderRecursive(folders);
      
      if (folder) {
        setCurrentFolder(folder);
        setEditFolderModalOpen(true);
      } else {
        console.error('Folder not found:', folderId);
        alert('Pasta não encontrada.');
      }
    } catch (error) {
      console.error('Error loading folder for editing:', error);
      alert('Erro ao carregar configurações da pasta.');
    }
  };
  
  const handleUpdateFolder = async (folderId: string, name: string, color?: string, password?: string) => {
    if (!user) return;
    
    try {
      await chatService.updateFolder(user.uid, folderId, name, color, password);
      // Folder will update automatically via real-time listener in Sidebar
    } catch (error) {
      console.error('Error updating folder:', error);
      throw error;
    }
  };
  
  const handleDeleteFolderRequest = (folderId: string) => {
    setFolderToDelete(folderId);
    setDeleteFolderModalOpen(true);
  };
  
  const handleConfirmDeleteFolder = async () => {
    if (!folderToDelete || !user) return;
    
    try {
      await chatService.deleteFolder(user.uid, folderToDelete);
      // Folder will be removed automatically via real-time listener
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Erro ao deletar pasta. Tente novamente.');
    }
  };

  const handleOpenChatSettings = async (chatId: string) => {
    if (!user) return;
    
    try {
      const chat = await chatService.getChat(user.uid, chatId);
      if (chat) {
        setCurrentChat(chat);
        
        // Se for um chat de Persona, abrir modal de edição de Persona
        if (chat.isPersona && chat.personaConfig) {
          // Buscar a Persona original para editar
          const persona = personas.find(p => p.id === chat.personaConfig?.personaId);
          if (persona) {
            setEditingPersona(persona);
            setPersonaModalOpen(true);
          } else {
            // Se a Persona foi deletada, informar o usuário
            alert('A Persona original não existe mais. Este chat continuará funcionando com a configuração salva.');
          }
        } else {
          // Chat normal, abrir modal de configurações padrão
          setEditChatModalOpen(true);
        }
      }
    } catch (error) {
      console.error('Error loading chat for editing:', error);
      alert('Erro ao carregar configurações do chat.');
    }
  };

  const handleOpenShareChat = async (chatId: string) => {
    if (!user) return;
    
    try {
      const chat = await chatService.getChat(user.uid, chatId);
      if (chat) {
        setCurrentChat(chat);
        setShareChatModalOpen(true);
      }
    } catch (error) {
      console.error('Error loading chat for sharing:', error);
      alert('Erro ao carregar chat.');
    }
  };

  const handleUpdateChat = async (chatId: string, config: Partial<ChatConfig>) => {
    if (!user) return;
    
    try {
      await chatService.updateChat(user.uid, chatId, config);
      
      // Update local state if it's the current chat
      if (chatId === currentChatId && config.name) {
        setChatName(config.name);
        setDisplayedChatName(config.name);
        setIsTypingChatName(false);
      }
      
      // Reload chat data
      const updatedChat = await chatService.getChat(user.uid, chatId);
      if (updatedChat) {
        setCurrentChat(updatedChat);
      }
    } catch (error) {
      console.error('Error updating chat:', error);
      throw error;
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user || !currentChatId) return;
    
    try {
      // Remove from UI immediately
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      
      // Delete from storage
      await messageService.deleteMessage(user.uid, currentChatId, messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Erro ao deletar mensagem. Tente novamente.');
      // Reload messages on error
      const loadedMessages = await messageService.loadMessages(user.uid, currentChatId);
      setMessages(loadedMessages);
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!user || !currentChatId) return;
    
    console.log(`📝 [handleEditMessage] Attempting to edit message: ${messageId}`);
    console.log(`📋 [handleEditMessage] Current message IDs in UI:`, messages.map(m => m.id));
    console.log(`🔒 [handleEditMessage] Currently saving:`, Array.from(savingMessageIds));
    
    try {
      // Update in UI immediately
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: newContent } : m))
      );
      
      // Update in storage
      await messageService.updateMessage(user.uid, currentChatId, messageId, {
        content: newContent,
      });
      
      console.log(`✅ [handleEditMessage] Successfully edited message: ${messageId}`);
    } catch (error) {
      console.error('❌ [handleEditMessage] Error editing message:', error);
      alert('Erro ao editar mensagem. Tente novamente.');
      // Reload messages on error
      const loadedMessages = await messageService.loadMessages(user.uid, currentChatId);
      setMessages(loadedMessages);
    }
  };

  const handleRegenerateMessage = async (messageId: string) => {
    if (!user || !currentChatId) return;
    
    const effectiveGuidedStudy = guidedStudyEnabled;
    const effectiveWebSearch = webSearchEnabled;
    const effectiveDeepThinkingEnabled = deepThinkingEnabled;
    const effectiveDeepThinkingDepth = deepThinkingDepth;

    try {
      // Find the user message to regenerate (the button is on the user's message bubble)
      const userMessageIndex = messages.findIndex(m => m.id === messageId);
      if (userMessageIndex === -1) {
        console.error('Message not found');
        return;
      }

      const userMessage = messages[userMessageIndex];
      
      // Verify this is actually a user message
      if (userMessage.role !== 'user') {
        console.error('Message is not from user');
        return;
      }
      
      // Delete ALL messages after the user message (assistant responses and any subsequent messages)
      // Keep the user message and everything before it
      const messagesToKeep = messages.slice(0, userMessageIndex + 1); // +1 to include the user message
      const messagesToDelete = messages.slice(userMessageIndex + 1); // Delete everything after
      
      // Update UI immediately - keep all messages up to and including the user message
      setMessages(messagesToKeep);
      
      // Delete messages from storage (different behavior for incognito mode)
      if (incognitoActive) {
        // In incognito mode, delete from localStorage
        const { deleteIncognitoMessages } = await import('@/lib/services/incognito-service');
        deleteIncognitoMessages(messagesToDelete.map(m => m.id));
      } else {
        // Normal mode: rewrite storage with remaining messages to ensure consistency
        // Mark user message as saving (disable edit/delete/regenerate buttons)
        const userMessageId = userMessage.id;
        setSavingMessageIds(prev => new Set(prev).add(userMessageId));
        
        await messageService.saveMessages(user.uid, currentChatId, messagesToKeep);
        
        // Wait 2 seconds before enabling buttons on user message
        // Now that IDs are correct, a short delay is enough
        setTimeout(() => {
          setSavingMessageIds(prev => {
            const next = new Set(prev);
            next.delete(userMessageId);
            return next;
          });
        }, 2000);
      }
      
      // Use current toggle states for regeneration (matches behavior of new messages)
      const reasoningDepthForRegeneration = effectiveDeepThinkingDepth;
      
      // Start regeneration - do NOT re-add user message (it's already in messagesToKeep)
      setIsAILoading(true);
      
      // Create assistant message placeholder
      const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: new Date(),
        model: selectedModel,
        isStreaming: true,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Build conversation history (excludes the user message being regenerated)
      const conversationHistory = messagesToKeep.slice(0, -1).map(msg => ({
        role: msg.role,
        content: msg.content,
        attachments: msg.attachments?.filter(att => att.isActive !== false),
      }));

      // Check API Key (supports both old and new format)
      const hasApiKey = (userProfile?.openRouterApiKeys && userProfile.openRouterApiKeys.length > 0) || userProfile?.openRouterApiKey;
      if (!hasApiKey) {
        setIsAILoading(false);
        alert('Por favor, configure sua OpenRouter API Key nas configurações.');
        return;
      }

      // Stream response
      let fullContent = '';
      let fullReasoning = '';
      let citations: Citation[] = [];
      const generatedImages: GeneratedImage[] = [];
      let messageCost = 0; // Cost of this message in dollars
      let messageTokens = 0; // Total tokens used in this message
      let messageUsage: MessageUsage | undefined; // Usage data for the message
      
      // Configure reasoning if deep thinking is enabled (same logic as handleSendMessage)
      let reasoningConfig: ReasoningConfig | undefined;
      const modelHasNativeReasoning = hasNativeReasoning(selectedModel);
      
      // For models with native reasoning: always send config, toggle controls visibility
      // For other models: only send config if toggle is enabled
      if (modelHasNativeReasoning || effectiveDeepThinkingEnabled) {
        const configType = getReasoningConfigType(selectedModel);
        const depthMap = {
          'Baixa': { effort: 'low' as const, maxTokens: 2000 },
          'Média': { effort: 'medium' as const, maxTokens: 4000 },
          'Alta': { effort: 'high' as const, maxTokens: 8000 },
        };
        const depthConfig = depthMap[reasoningDepthForRegeneration];
        
        if (configType === 'max_tokens') {
          const maxTokensValue = reasoningMaxTokens || getDefaultMaxTokens(selectedModel);
          reasoningConfig = {
            enabled: true,
            max_tokens: maxTokensValue,
          };
          
          // For models with native reasoning: use exclude to control visibility
          if (modelHasNativeReasoning && !effectiveDeepThinkingEnabled) {
            reasoningConfig.exclude = true; // Reasoning works but doesn't show in response
          }
        } else {
          reasoningConfig = {
            enabled: true,
            effort: depthConfig.effort,
          };
          
          // For models with native reasoning: use exclude to control visibility
          if (modelHasNativeReasoning && !effectiveDeepThinkingEnabled) {
            reasoningConfig.exclude = true; // Reasoning works but doesn't show in response
          }
        }
      }

      let webSearchConfig: WebSearchConfig | undefined;
      if (effectiveWebSearch) {
        webSearchConfig = {
          enabled: true,
          engine: undefined,
          max_results: 5,
        };
      }

      const userNameToSend = incognitoActive ? undefined : userProfile?.displayName;
      const userNicknameToSend = incognitoActive ? undefined : userProfile?.nickname;
      const userAboutToSend = incognitoActive ? undefined : userProfile?.aboutYou;
      const globalMemoriesToSend = incognitoActive ? undefined : userProfile?.globalMemories;
      const chatMemoriesToSend = incognitoActive ? undefined : currentChat?.memories ?? undefined;
      const aiPersonalitiesToSend = incognitoActive ? undefined : userProfile?.aiPersonalities;
      const personaConfigToSend = currentChat?.personaConfig ?? undefined;

      await streamChat({
        chatId: currentChatId,
        message: userMessage.content,
        userId: user.uid,
        userName: userNameToSend,
        userNickname: userNicknameToSend,
        userAbout: userAboutToSend,
        apiKey: userProfile.openRouterApiKey || '', // Backend will fetch from Firestore if empty
        model: selectedModel,
        conversationHistory,
        attachments: userMessage.attachments?.filter(att => att.isActive !== false),
        pdfEngine: userProfile.pdfEngine,
        reasoning: reasoningConfig,
        webSearch: webSearchConfig,
        guidedStudy: effectiveGuidedStudy,
        globalMemories: globalMemoriesToSend,
        chatMemories: chatMemoriesToSend,
        aiPersonalities: aiPersonalitiesToSend,
        personaConfig: personaConfigToSend,
        generateImages: true, // Enable image generation if model supports it
        // Chat generation settings
        temperature: currentChat?.temperature,
        maxTokens: currentChat?.maxTokens,
        frequencyPenalty: currentChat?.frequencyPenalty,
        repetitionPenalty: currentChat?.repetitionPenalty,
        
        onChunk: (chunk) => {
          // Accumulate raw content (with memory tags)
          fullContent += chunk;
          
          // Update UI with raw content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + chunk }
                : msg
            )
          );
        },
        
        onReasoning: (reasoning) => {
          fullReasoning += reasoning;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, reasoning: (msg.reasoning || '') + reasoning }
                : msg
            )
          );
        },
        
        onImages: async (images: StreamGeneratedImage[]) => {
          // Process generated images: upload to Storage
          const uploadedImageUrls = new Set<string>();
          for (const img of images) {
            const imageDataUrl = img.image_url.url;

            // Avoid processing duplicates (may arrive multiple times in stream)
            if (uploadedImageUrls.has(imageDataUrl)) {
              continue;
            }

            try {
              const imageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const uploadResult = await uploadBase64Image(
                imageDataUrl,
                user.uid,
                currentChatId,
                imageId
              );
              
              const generatedImage: GeneratedImage = {
                id: imageId,
                url: uploadResult.url,
                storageRef: uploadResult.storagePath,
                createdAt: new Date(),
                size: uploadResult.size,
              };

              uploadedImageUrls.add(imageDataUrl);
              generatedImages.push(generatedImage);
              
              // Update UI immediately with the new image
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, generatedImages: [...(msg.generatedImages || []), generatedImage] }
                    : msg
                )
              );
            } catch (error) {
              console.error('Erro ao salvar imagem gerada:', error);
            }
          }
        },
        
        onAnnotations: (annotations) => {
          const newCitations = annotations
            .filter((ann) => ann.type === 'url_citation')
            .map((ann) => ({
              title: ann.url_citation?.title || 'Web Result',
              url: ann.url_citation?.url || '',
              content: ann.url_citation?.content,
              snippet: ann.url_citation?.content,
              start_index: ann.url_citation?.start_index,
              end_index: ann.url_citation?.end_index,
            }));
          
          citations = [...citations, ...newCitations];
          
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, citations }
                : msg
            )
          );
        },
        
        onUsage: (usage) => {
          // Capture usage data (cost, tokens)
          messageCost = usage.cost || 0;
          messageTokens = usage.tokens || usage.total_tokens || 0;
          
          // Capture detailed usage data for the message
          messageUsage = {
            promptTokens: usage.promptTokens || usage.prompt_tokens || 0,
            completionTokens: usage.completionTokens || usage.completion_tokens || 0,
            totalTokens: messageTokens,
            reasoningTokens: usage.reasoningTokens || usage.completion_tokens_details?.reasoning_tokens,
            cachedTokens: usage.cachedTokens || usage.prompt_tokens_details?.cached_tokens,
            cost: messageCost,
            upstreamCost: usage.upstreamCost || usage.cost_details?.upstream_inference_cost,
            apiKeyName: usage.apiKeyName,
            reasoningEnabled: effectiveDeepThinkingEnabled,
            reasoningEffort: effectiveDeepThinkingEnabled ? (effectiveDeepThinkingDepth === 'Baixa' ? 'low' : effectiveDeepThinkingDepth === 'Média' ? 'medium' : 'high') : undefined,
            reasoningMaxTokens: undefined, // Not available in regenerate context
          };


          if (messageCost > 0) {
            setOpenRouterBalance(prev => {
              if (prev === null) return prev;
              return Math.max(0, prev - messageCost);
            });
          }
        },
        
        onComplete: async () => {
          // Process memory tags from complete content
          const { cleanContent, memories } = extractMemoryTags(fullContent);
          
          // Update message with cleaned content (no tags) - generatedImages already added by onImages
          let finalMessage: Message | undefined;
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMessageId) {
                const updated: Message = { 
                  ...msg, 
                  content: cleanContent, 
                  isStreaming: false,
                  usage: messageUsage, // Add usage data to the message state
                  // Don't override - generatedImages were already added by onImages callback
                };
                finalMessage = updated;
                return updated;
              }
              return msg;
            })
          );
          
          // Save assistant message with CLEANED content
          // Save even if cleanContent is empty but has images/citations/reasoning
          const imagesToSave = finalMessage?.generatedImages || [];
          
          if (cleanContent || imagesToSave.length > 0 || citations.length > 0 || fullReasoning) {
            if (incognitoActive) {
              // In incognito mode, save to localStorage
              addIncognitoMessage({
                id: assistantMessageId,
                role: 'assistant',
                content: cleanContent || '',
                createdAt: new Date(),
                model: selectedModel,
                reasoning: fullReasoning || undefined,
                citations: citations.length > 0 ? citations : undefined,
                generatedImages: imagesToSave.length > 0 ? imagesToSave : undefined,
                webSearchEnabled: effectiveWebSearch,
                usage: messageUsage,
              });
            } else {
              // Normal mode: save to Firebase
              // Mark message as saving (disable edit/delete buttons)
              setSavingMessageIds(prev => new Set(prev).add(assistantMessageId));
              
              try {
                // CRITICAL: addMessage returns the message with REAL ID from Firebase
                const savedAssistantMessage = await messageService.addMessage(user.uid, currentChatId, {
                  role: 'assistant',
                  content: cleanContent || '',
                  model: selectedModel,
                  reasoning: fullReasoning || undefined,
                  citations: citations.length > 0 ? citations : undefined,
                  generatedImages: imagesToSave.length > 0 ? imagesToSave : undefined,
                  webSearchEnabled: effectiveWebSearch,
                  usage: messageUsage,
                });
                
                await chatService.updateChatAfterMessage(user.uid, currentChatId, cleanContent || 'Imagem gerada');
                
                // CRITICAL: Replace placeholder ID with real ID in messages state
                const realAssistantId = savedAssistantMessage.id;
                setMessages(prev => 
                  prev.map(msg => msg.id === assistantMessageId ? savedAssistantMessage : msg)
                );
                
                // Transfer saving state from placeholder to real ID
                setSavingMessageIds(prev => {
                  const next = new Set(prev);
                  next.delete(assistantMessageId);
                  next.add(realAssistantId);
                  return next;
                });
                
                console.log(`✅ [handleRegenerateMessage] Replaced assistant placeholder ${assistantMessageId} with real ID ${realAssistantId}`);
                
                // Capture real message ID for setTimeout closure
                const messageIdToRemove = realAssistantId;
                
                // Wait 2 seconds before enabling edit/delete buttons
                // Now that IDs are correct, a short delay is enough
                setTimeout(() => {
                  setSavingMessageIds(prev => {
                    const next = new Set(prev);
                    next.delete(messageIdToRemove);
                    return next;
                  });
                }, 2000);
              } catch (error) {
                // On error, remove immediately
                setSavingMessageIds(prev => {
                  const next = new Set(prev);
                  next.delete(assistantMessageId);
                  return next;
                });
                throw error;
              }
            }
          }
          
          // Save accumulated cost and tokens to chat (skip in incognito mode)
          if (!incognitoActive && (messageCost > 0 || messageTokens > 0)) {
            try {
              const chat = await chatService.getChat(user.uid, currentChatId);
              const currentTotalCost = chat?.totalCost || 0;
              const currentTotalTokens = chat?.totalTokens || 0;
              const newTotalCost = currentTotalCost + messageCost;
              const newTotalTokens = currentTotalTokens + messageTokens;
              
              await chatService.updateChat(user.uid, currentChatId, {
                totalCost: newTotalCost,
                totalTokens: newTotalTokens,
              });
              
              // Update local state immediately so modal shows updated values
              setCurrentChat(prev => prev ? { 
                ...prev, 
                totalCost: newTotalCost,
                totalTokens: newTotalTokens 
              } : prev);
            } catch (error) {
              console.error('Erro ao salvar custo e tokens do chat:', error);
            }
          }
          
          // Save automatic memories from regeneration (skip in incognito mode)
          if (!incognitoActive && memories.length > 0) {
            try {
              const newMemories = createMemoryObjects(memories);
              const currentMemories = userProfile.globalMemories || [];
              const updatedMemories = [...newMemories, ...currentMemories];
              
              await updateUserProfile({ globalMemories: updatedMemories });
              
              const toastId = `toast_${Date.now()}`;
              setMemoryToasts(prev => [...prev, { id: toastId, count: newMemories.length }]);
            } catch (error) {
              console.error('Erro ao salvar memórias automáticas:', error);
            }
          }
          
          setIsAILoading(false);
        },
        
        onError: (error) => {
          console.error('Streaming error:', error);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: `❌ Erro: ${error.message}`, isStreaming: false }
                : msg
            )
          );
          setIsAILoading(false);
          // Se houver custo parcial, ele já foi decrementado no onUsage
          // Não precisa fazer nova requisição ao OpenRouter
        },
      });
    } catch (error) {
      console.error('Error regenerating message:', error);
      setIsAILoading(false);
      alert('Erro ao regenerar mensagem. Tente novamente.');
      // Reload messages on error (skip in incognito mode)
      if (!incognitoActive && user && currentChatId) {
        const loadedMessages = await messageService.loadMessages(user.uid, currentChatId);
        setMessages(loadedMessages);
      }
    }
  };

  const handleOpenStats = async () => {
    setStatsModalOpen(true);
    
    // Salvar estatísticas no Firestore apenas se necessário
    if (user && currentChatId && messages.length > 0) {
      try {
        // Verificar se precisa recalcular (stats não existe ou messageCount mudou)
        const stats = currentChat?.stats;
        const currentMessageCount = messages.length;
        const needsUpdate = !stats || 
                           (currentChat?.messageCount !== currentMessageCount) ||
                           (stats.lastUpdated && (Date.now() - new Date(stats.lastUpdated).getTime()) > 3600000); // 1 hora
        
        if (needsUpdate) {
          await calculateAndSaveChatStats(user.uid, currentChatId, messages);
        }
      } catch (error) {
        console.error('Erro ao salvar estatísticas:', error);
        // Não bloquear a abertura do modal mesmo se falhar ao salvar
      }
    }
  };

  // Debate Mode handlers
  const handleOpenDebateConfig = useCallback(() => {
    if (debateActive) {
      // Se já está em debate, pausar/retomar
      pauseDebate();
    } else {
      // Abrir modal de configuração
      setDebateConfigModalOpen(true);
    }
  }, [debateActive, pauseDebate]);

  const handleStartDebate = useCallback(async (config: DebateConfig) => {
    setDebateConfigModalOpen(false);
    
    try {
      // Wait for debate session to be created
      await startDebate(config);
      
      // Small delay to ensure state propagation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Start initial presentations
      await startInitialPresentations();
      
      // Wait a bit to ensure everything is settled
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Após ambas apresentações, abrir modal para escolher quem começa
      setDebateTurnChoiceModalOpen(true);
    } catch {
      alert('Erro ao iniciar debate. Tente novamente.');
    }
  }, [startDebate, startInitialPresentations]);

  const handleSelectFirstParticipant = useCallback(async (participant: 1 | 2) => {
    setDebateTurnChoiceModalOpen(false);
    await startDebateExchanges(participant);
  }, [startDebateExchanges]);

  const handleStopDebateWithConfirm = useCallback(() => {
    setDebateStopConfirmModalOpen(true);
  }, []);

  const handleConfirmStopDebate = useCallback(async () => {
    setDebateStopConfirmModalOpen(false);
    await stopDebate();
  }, [stopDebate]);

  const handleOpenDebateEditConfig = useCallback(() => {
    if (debateSession?.isPaused && debateSession.config) {
      // Initialize edit modal with current config
      setDebateEditSelectedModel1(debateSession.config.participant1.model);
      setDebateEditSelectedModel2(debateSession.config.participant2.model);
      setDebateEditModalOpen(true);
    }
  }, [debateSession]);

  const handleSaveDebateEdit = useCallback(async (updatedConfig: Partial<DebateConfig>) => {
    if (!user || !debateChatId || !debateSession) return;

    try {
      // Update debate config in Firestore
      const fullConfig = {
        ...debateSession.config,
        ...updatedConfig,
      };

      await chatService.updateChat(user.uid, debateChatId, {
        debateConfig: fullConfig,
        context: `Tema: ${fullConfig.topic}\nPautas: ${fullConfig.points.join(', ')}`,
      });

      setDebateEditModalOpen(false);
      alert('Configurações do debate atualizadas com sucesso!');
    } catch {
      alert('Erro ao atualizar configurações do debate.');
    }
  }, [user, debateChatId, debateSession]);

  // Persona handlers
  const handleOpenPersonaModal = useCallback(() => {
    setEditingPersona(null);
    setPersonaModalOpen(true);
  }, []);

  const handleSavePersona = useCallback(async (data: {
    name: string;
    personality: string;
    description: string;
    dialogExamples?: string;
    firstMessage?: string;
    alwaysDo?: string;
    neverDo?: string;
    maxTokens?: number;
  }) => {
    if (!user) return;

    try {
      if (editingPersona) {
        // Update existing persona
        await personaService.updatePersona(user.uid, editingPersona.id, data);
        
        // Se estiver editando a partir das configurações de um chat específico,
        // atualizar o personaConfig desse chat
        if (currentChat?.isPersona && currentChat.personaConfig?.personaId === editingPersona.id) {
          // Build personaConfig without undefined fields (Firestore doesn't accept undefined)
          const updatedPersonaConfig: PersonaConfig = {
            personaId: editingPersona.id,
            name: data.name,
            personality: data.personality,
            description: data.description,
          };
          
          // Add optional fields only if they have values
          if (data.dialogExamples) {
            updatedPersonaConfig.dialogExamples = data.dialogExamples;
          }
          if (data.firstMessage) {
            updatedPersonaConfig.firstMessage = data.firstMessage;
          }
          if (data.alwaysDo) {
            updatedPersonaConfig.alwaysDo = data.alwaysDo;
          }
          if (data.neverDo) {
            updatedPersonaConfig.neverDo = data.neverDo;
          }
          if (data.maxTokens) {
            updatedPersonaConfig.maxTokens = data.maxTokens;
          }

          await chatService.updateChat(user.uid, currentChat.id, {
            name: data.name,
            personaConfig: updatedPersonaConfig,
          });
          
          // Atualizar estado local
          setChatName(data.name);
          setDisplayedChatName(data.name);
          
          // Recarregar o chat
          const updatedChat = await chatService.getChat(user.uid, currentChat.id);
          if (updatedChat) {
            setCurrentChat(updatedChat);
          }
        }
      } else {
        // Create new persona
        const personaId = await personaService.createPersona(user.uid, data);
        
        // Create a chat with this persona
        // Build personaConfig without undefined fields (Firestore doesn't accept undefined)
        const personaConfig: PersonaConfig = {
          personaId: personaId,
          name: data.name,
          personality: data.personality,
          description: data.description,
        };
        
        // Add optional fields only if they have values
        if (data.dialogExamples) {
          personaConfig.dialogExamples = data.dialogExamples;
        }
        if (data.firstMessage) {
          personaConfig.firstMessage = data.firstMessage;
        }
        if (data.alwaysDo) {
          personaConfig.alwaysDo = data.alwaysDo;
        }
        if (data.neverDo) {
          personaConfig.neverDo = data.neverDo;
        }
        if (data.maxTokens) {
          personaConfig.maxTokens = data.maxTokens;
        }

        const chatId = await chatService.createChat(user.uid, {
          name: data.name,
          systemPrompt: '',
          context: '',
          password: '',
          latexEnabled: false,
          latexLevel: 'medio',
          temperature: 1.0,
          frequencyPenalty: 0,
          repetitionPenalty: 0,
          maxTokens: 4096,
          isDebate: false,
          isPersona: true,
          personaConfig,
        } as ChatConfig & { isPersona: boolean; personaConfig: PersonaConfig });

        // If there's a first message, add it to the chat
        if (data.firstMessage) {
          await messageService.saveMessages(user.uid, chatId, [{
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: data.firstMessage,
            createdAt: new Date(),
          }]);
          
          // Update chat with last message info
          await chatService.updateChat(user.uid, chatId, {
            lastMessage: data.firstMessage.substring(0, 100),
            messageCount: 1,
          });
        }

        // Navigate to the new chat and load it completely
        setCurrentChatId(chatId);
        setIsLoadingChat(true);
        setHasLoadedChat(false);
        
        // Load the complete chat with all data
        const chat = await chatService.getChat(user.uid, chatId);
        if (chat) {
          setChatName(chat.name);
          setDisplayedChatName(chat.name);
          setIsTypingChatName(false);
          setCurrentChat(chat);
          
          // Load messages (including first message if it exists)
          const loadedMessages = await chatService.loadMessages(user.uid, chatId);
          setMessages(loadedMessages);
          
          // Set default model
          setSelectedModel(userProfile?.defaultModel || 'google/gemini-2.0-flash-exp:free');
          
          // Reset other states
          setWebSearchEnabled(false);
          setGuidedStudyEnabled(false);
          setDeepThinkingEnabled(false);
          setDeepThinkingDepth('Média');
          
          setHasLoadedChat(true);
          setIsLoadingChat(false);
        }
      }

      setPersonaModalOpen(false);
      setEditingPersona(null);
    } catch (error) {
      console.error('Error saving persona:', error);
      alert('Erro ao salvar persona. Tente novamente.');
    }
  }, [user, editingPersona, currentChat, userProfile?.defaultModel]);

  const handleOpenDebateModelSelect = useCallback((participant: 1 | 2) => {
    setDebateModelSelectParticipant(participant);
    setModelSelectOpen(true);
  }, []);

  const handleDebateEditModelSelect = useCallback((participant: 1 | 2) => {
    setDebateEditModelSelectParticipant(participant);
    setModelSelectOpen(true);
  }, []);

  const handleDebateModelSelected = useCallback((model: string) => {
    if (debateModelSelectParticipant === 1) {
      setDebateSelectedModel1(model);
    } else if (debateModelSelectParticipant === 2) {
      setDebateSelectedModel2(model);
    }
    setDebateModelSelectParticipant(null);
    
    if (debateEditModelSelectParticipant === 1) {
      setDebateEditSelectedModel1(model);
    } else if (debateEditModelSelectParticipant === 2) {
      setDebateEditSelectedModel2(model);
    }
    setDebateEditModelSelectParticipant(null);
    
    setModelSelectOpen(false);
  }, [debateModelSelectParticipant, debateEditModelSelectParticipant]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Calculate total attachments count
  const attachmentsCount = (messages ?? []).reduce(
    (count, message) => count + (message?.attachments?.length || 0),
    0
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Hidden in Focus Mode */}
      {!focusMode && (
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          currentChatId={currentChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onGoToEmptyChat={handleGoToEmptyChat}
          onOpenSettings={() => setSettingsModalOpen(true)}
          onOpenDebateConfig={handleOpenDebateConfig}
          onOpenPersonaModal={handleOpenPersonaModal}
          onOpenLeaderboard={() => setLeaderboardModalOpen(true)}
          onOpenCreateFolder={() => setCreateFolderModalOpen(true)}
          onOpenCreateSubfolder={handleOpenCreateSubfolder}
          onOpenChatSettings={handleOpenChatSettings}
          onOpenShareChat={handleOpenShareChat}
          onOpenFolderSettings={handleOpenFolderSettings}
          onRequestFolderPassword={handleRequestFolderPassword}
          onRequestChatPassword={handleRequestChatPassword}
          onRequestFolderPasswordForAction={handleRequestFolderPasswordForAction}
          onDeleteFolder={handleDeleteFolderRequest}
          openRouterBalance={openRouterBalance}
          balanceLoading={balanceLoading}
          sharedChatNotifications={Object.fromEntries(
            Object.entries(sharedChatNotifications).map(([, notif]) => [notif.chatId, notif.newMessageCount])
          )}
          onRegisterUnlockHandlers={setSidebarRef}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Upperbar - Hidden in Focus Mode */}
        {!focusMode && (
          <Upperbar
            chatName={debateActive ? 'Modo Debate' : displayedChatName}
            currentModel={selectedModel}
            isLoading={isAILoading || isDebateLoading}
            isTypingName={isTypingChatName}
            attachmentsCount={attachmentsCount}
            incognitoMode={incognitoActive}
            debateMode={debateActive}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onOpenAttachments={() => setAttachmentsModalOpen(true)}
            onOpenStats={handleOpenStats}
            onDownload={() => setDownloadModalOpen(true)}
            onOpenModelSelect={() => setModelSelectOpen(true)}
            onToggleFocusMode={handleEnterFocusMode}
            onToggleIncognito={handleToggleIncognito}
          />
        )}

        {/* Chat or Debate Interface */}
        {debateActive && debateSession ? (
          <>
            <DebateToolbar
              hasStarted={debateSession.hasStarted}
              isActive={debateSession.isActive}
              isPaused={debateSession.isPaused}
              totalCost={debateTotalCost}
              totalTokens={debateTotalTokens}
              currentPoints={debateSession.config.points}
              currentPointIndex={currentDebatePointIndex}
              onStopDebate={handleStopDebateWithConfirm}
              onPauseDebate={pauseDebate}
              onAddPoint={addDebatePoint}
              onSelectPoint={(index) => {
                setCurrentDebatePointIndex(index);
                selectDebatePoint(index);
              }}
              onModeratorIntervention={moderatorIntervention}
              onOpenEditConfig={handleOpenDebateEditConfig}
            />
            <DebateInterface
              messages={debateMessages}
              config={debateSession.config}
              isLoading={isDebateLoading}
              currentTurn={debateSession.currentTurn}
              onDeleteMessage={deleteDebateMessage}
            />
          </>
        ) : (
          <>
            <ChatInterface
              messages={messages}
              isLoading={isAILoading}
              isLoadingChat={isLoadingChat}
              chatId={currentChatId}
              incognitoMode={incognitoActive}
              aiName={currentChat?.personaConfig?.name || 'Haumea'}
              savingMessageIds={savingMessageIds}
              onRegenerateMessage={handleRegenerateMessage}
              onDeleteMessage={handleDeleteMessage}
              onEditMessage={handleEditMessage}
            />

            {/* Input Bar - Always visible */}
            <InputBar 
              onSendMessage={handleSendMessage} 
              isLoading={isAILoading}
              selectedModel={selectedModel}
              currentChatId={currentChatId}
              guidedStudyEnabled={guidedStudyEnabled}
              webSearchEnabled={webSearchEnabled}
              deepThinkingEnabled={deepThinkingEnabled}
              deepThinkingDepth={deepThinkingDepth}
              reasoningMaxTokens={reasoningMaxTokens}
              onModelChange={handleModelChange}
              onGuidedStudyChange={handleGuidedStudyChange}
              onWebSearchChange={handleWebSearchChange}
              onDeepThinkingChange={handleDeepThinkingChange}
              failedTranscriptionsCount={failedTranscriptionsCount}
              focusMode={focusMode}
              onExitFocusMode={handleExitFocusMode}
            />
          </>
        )}
      </div>

      {/* Modals - Renderizados no nível da página para centralização correta */}
      <AttachmentsModal
        isOpen={attachmentsModalOpen}
        onClose={() => setAttachmentsModalOpen(false)}
        messages={messages}
        onToggleAttachment={handleToggleAttachment}
        onDeleteAttachment={handleDeleteAttachment}
      />

      <StatsModal
        isOpen={statsModalOpen}
        onClose={() => setStatsModalOpen(false)}
        messages={debateActive ? debateMessages : messages}
        chatName={debateActive && debateSession ? `🎭 Debate: ${debateSession.config.topic}` : (chatName || 'Chat Atual')}
        totalCost={debateActive ? debateTotalCost : currentChat?.totalCost}
        totalTokens={debateActive ? debateTotalTokens : currentChat?.totalTokens}
      />

      <DownloadModal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
        messages={debateActive ? debateMessages : messages}
        chatName={debateActive && debateSession ? `Debate - ${debateSession.config.topic}` : (chatName || 'Chat')}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />

      <LeaderboardModal
        isOpen={leaderboardModalOpen}
        onClose={() => setLeaderboardModalOpen(false)}
      />

      <PersonaModal
        isOpen={personaModalOpen}
        onClose={() => {
          setPersonaModalOpen(false);
          setEditingPersona(null);
        }}
        onSave={handleSavePersona}
        editingPersona={editingPersona}
      />

      <CreateFolderModal
        isOpen={createFolderModalOpen}
        onClose={() => {
          setCreateFolderModalOpen(false);
          setParentFolderIdForSubfolder(null);
        }}
        onCreateFolder={handleCreateFolder}
        folders={[]}
        parentFolderId={parentFolderIdForSubfolder}
        isSubfolder={!!parentFolderIdForSubfolder}
      />

      <NewChatModal
        isOpen={newChatModalOpen}
        onClose={() => setNewChatModalOpen(false)}
        onCreateChat={handleCreateChat}
      />

      <EditChatModal
        isOpen={editChatModalOpen}
        onClose={() => {
          setEditChatModalOpen(false);
          setCurrentChat(null);
        }}
        onUpdateChat={handleUpdateChat}
        chat={currentChat}
      />

      <ShareChatModal
        isOpen={shareChatModalOpen}
        onClose={() => {
          setShareChatModalOpen(false);
          setCurrentChat(null);
        }}
        chat={currentChat}
      />

      <ModelSelectModal
        isOpen={modelSelectOpen}
        onClose={() => {
          setModelSelectOpen(false);
          setDebateModelSelectParticipant(null);
        }}
        currentModel={selectedModel}
        onSelectModel={async (model) => {
          // Se estamos selecionando modelo para debate
          if (debateModelSelectParticipant) {
            handleDebateModelSelected(model);
            return;
          }
          
          // Modo normal: Atualiza o modelo localmente
          setSelectedModel(model);
          
          // SEMPRE salva o modelo específico no chat quando o usuário seleciona manualmente
          if (user && currentChatId && hasLoadedChat) {
            try {
              await chatService.updateChat(user.uid, currentChatId, {
                selectedModel: model,
              });
              
              // Atualiza o currentChat local para refletir a mudança
              setCurrentChat(prev => prev ? { ...prev, selectedModel: model } : null);
              
            } catch (error) {
              console.error('Error saving selected model:', error);
            }
          }
        }}
      />

      <EditFolderModal
        isOpen={editFolderModalOpen}
        onClose={() => {
          setEditFolderModalOpen(false);
          setCurrentFolder(null);
        }}
        onUpdateFolder={handleUpdateFolder}
        folder={currentFolder}
      />

      <PasswordModal
        isOpen={passwordModalOpen}
        onClose={() => {
          setPasswordModalOpen(false);
          setPasswordTarget(null);
          // Reject any pending promises
          if (window.__folderPasswordResolve) {
            window.__folderPasswordResolve(false);
            delete window.__folderPasswordResolve;
          }
          if (window.__chatPasswordResolve) {
            window.__chatPasswordResolve(false);
            delete window.__chatPasswordResolve;
          }
        }}
        onVerify={handleVerifyPassword}
        title={passwordTarget ? `${passwordTarget.action === 'delete' ? 'Deletar' : passwordTarget.action === 'edit' ? 'Editar' : 'Desbloquear'} ${passwordTarget.type === 'folder' ? 'Projeto' : 'Chat'}` : 'Senha Necessária'}
        description={passwordTarget ? `Digite a senha para ${passwordTarget.action === 'delete' ? 'deletar' : passwordTarget.action === 'edit' ? 'editar' : 'acessar'} "${passwordTarget.name}"` : 'Digite a senha para continuar'}
      />
      
      <ConfirmModal
        isOpen={deleteFolderModalOpen}
        onClose={() => setDeleteFolderModalOpen(false)}
        onConfirm={handleConfirmDeleteFolder}
        title="Deletar Projeto"
        description="Tem certeza que deseja deletar este projeto? Os chats dentro dele não serão deletados, apenas movidos para 'Chats Sem Pasta'. Esta ação não pode ser desfeita."
        confirmText="Deletar"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Debate Config Modal */}
      <DebateConfigModal
        isOpen={debateConfigModalOpen}
        onClose={() => setDebateConfigModalOpen(false)}
        onStartDebate={handleStartDebate}
        onOpenModelSelect={handleOpenDebateModelSelect}
        selectedModel1={debateSelectedModel1}
        selectedModel2={debateSelectedModel2}
        userName={userProfile?.displayName || userProfile?.nickname}
      />

      {/* Debate Turn Choice Modal */}
      {debateSession && (
        <DebateTurnChoiceModal
          isOpen={debateTurnChoiceModalOpen}
          participant1Name={debateSession.config.participant1.name}
          participant2Name={debateSession.config.participant2.name}
          onSelectParticipant={handleSelectFirstParticipant}
        />
      )}

      {/* Debate Edit Modal */}
      {debateSession && (
        <DebateEditModal
          isOpen={debateEditModalOpen}
          onClose={() => setDebateEditModalOpen(false)}
          onSave={handleSaveDebateEdit}
          currentConfig={debateSession.config}
          onOpenModelSelect={handleDebateEditModelSelect}
          selectedModel1={debateEditSelectedModel1}
          selectedModel2={debateEditSelectedModel2}
        />
      )}

      {/* Debate Stop Confirmation Modal */}
      <ConfirmModal
        isOpen={debateStopConfirmModalOpen}
        onClose={() => setDebateStopConfirmModalOpen(false)}
        onConfirm={handleConfirmStopDebate}
        title="Interromper Debate"
        description="Tem certeza que deseja interromper o debate? O debate será salvo e você poderá continuar mais tarde."
        confirmText="Interromper"
        cancelText="Cancelar"
        variant="warning"
      />

      {/* Memory Toasts */}
      {memoryToasts.map(toast => (
        <MemoryToast
          key={toast.id}
          count={toast.count}
          onDismiss={() => setMemoryToasts(prev => prev.filter(t => t.id !== toast.id))}
        />
      ))}
      
      {/* Shared Chat Notification Toast */}
      {activeNotificationToast && (
        <SharedChatNotificationToast
          chatName={activeNotificationToast.chatName}
          messagePreview={activeNotificationToast.messagePreview}
          onClose={() => setActiveNotificationToast(null)}
          onClick={() => {
            handleSelectChat(`${sharedChatNotifications[activeNotificationToast.chatId]?.ownerId}/${activeNotificationToast.chatId}`);
            setActiveNotificationToast(null);
          }}
        />
      )}
      
      {/* Collaborative Chat Listeners */}
      <CollaborativeChatListeners
        currentChatId={currentChatId}
        onNewMessage={(chatId, ownerId, chatName, message) => {
          // Add to notifications manager
          addNotification(chatId, ownerId, chatName, message);
          
          // Show toast
          setActiveNotificationToast({
            chatId,
            chatName,
            messagePreview: message.content.substring(0, 100),
          });
        }}
      />
    </div>
  );
}
