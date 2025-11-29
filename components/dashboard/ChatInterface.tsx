'use client';

import {
  Bot,
  User,
  Copy,
  RefreshCw,
  Trash2,
  Edit2,
  ChevronDown,
  Sparkles,
  Code,
  ExternalLink,
  FileText,
  Download,
  Maximize2,
  Loader2,
  Check,
  Image as ImageIcon,
  EyeOff,
  ShieldOff,
  Users,
  Brain,
  DollarSign,
} from 'lucide-react';
import { ImageViewerModal } from '@/components/modals/ImageViewerModal';
import { MessageUsageModal } from '@/components/modals/MessageUsageModal';
import React from 'react';
import { Message } from '@/types/chat';
import { useChatAutoScroll } from '@/hooks/useChatAutoScroll';
import { useChatVirtualization } from '@/hooks/useChatVirtualization';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { ReasoningBlock } from '@/components/common/ReasoningBlock';
import { useAuth } from '@/contexts/AuthContext';
import { getFontFamily } from '@/lib/utils/font-mapper';

interface ChatInterfaceProps {
  messages: Message[];
  isLoading?: boolean;
  isLoadingChat?: boolean; // Loading chat data
  chatId?: string; // To reset scroll on chat change
  incognitoMode?: boolean; // Incognito mode indicator
  aiName?: string; // Name to display for AI (defaults to "Haumea")
  savingMessageIds?: Set<string>; // IDs of messages currently being saved
  isSharedChat?: boolean; // If this is a shared chat
  shareType?: 'copy' | 'collaborative'; // Type of sharing
  sharedBy?: string; // Email of the person who shared (for received shares)
  isOwner?: boolean; // If current user is the owner
  onRegenerateMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, content: string) => void;
}

export function ChatInterface({
  messages,
  isLoading = false,
  isLoadingChat = false,
  chatId,
  incognitoMode = false,
  aiName = 'Haumea',
  savingMessageIds = new Set(),
  isSharedChat = false,
  shareType,
  sharedBy,
  isOwner = true,
  onRegenerateMessage,
  onDeleteMessage,
  onEditMessage,
}: ChatInterfaceProps) {
  const { userProfile } = useAuth();
  
  // Virtualização de mensagens
  const {
    isVirtualized,
    totalWords,
    renderedMessages,
    topPlaceholderHeight,
    bottomPlaceholderHeight,
    containerRef: virtualContainerRef,
    registerMessageHeight,
    handleScroll: handleVirtualScroll,
    scrollToBottom: virtualScrollToBottom,
  } = useChatVirtualization(messages);

  // Auto-scroll (fallback para chats não virtualizados)
  const { messagesEndRef, containerRef: autoScrollContainerRef, scrollToBottom: autoScrollToBottom, handleScroll: autoScrollHandleScroll } =
    useChatAutoScroll(messages.length, isLoading, chatId);

  const [messageToDelete, setMessageToDelete] = React.useState<string | null>(null);
  const [messageToRegenerate, setMessageToRegenerate] = React.useState<string | null>(null);
  const [imageViewerOpen, setImageViewerOpen] = React.useState(false);
  const [selectedImage, setSelectedImage] = React.useState<{ url: string; name: string } | null>(null);

  // Usar containerRef apropriado
  const containerRef = isVirtualized ? virtualContainerRef : autoScrollContainerRef;

  // Detectar se deve mostrar botão de scroll (funciona para ambos os modos)
  const [showScrollButton, setShowScrollButton] = React.useState(false);
  // Track if user is near bottom for auto-scroll during streaming
  const isNearBottomRef = React.useRef(true);
  // Track last manual scroll time to prevent auto-scroll interruption
  const lastManualScrollRef = React.useRef<number>(0);
  const userScrollingRef = React.useRef(false);
  // Track auto-scroll animation frame
  const autoScrollFrameRef = React.useRef<number | null>(null);
  // Track previous scroll position to detect user scroll direction
  const prevScrollTopRef = React.useRef(0);
  
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout | undefined;

    const checkScroll = () => {
      // Clear previous timeout to prevent memory leaks
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
        scrollTimeout = undefined;
      }

      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      // Threshold de 100px para considerar "perto do fundo"
      const nearBottom = distanceFromBottom < 100;
      
      setShowScrollButton(distanceFromBottom > 200);
      
      // Detectar se usuário scrollou manualmente para CIMA
      const scrolledUp = scrollTop < prevScrollTopRef.current;
      prevScrollTopRef.current = scrollTop;
      
      // Se usuário scrollou para cima E estava perto do fundo, marcar como scroll manual
      if (scrolledUp && !nearBottom) {
        lastManualScrollRef.current = Date.now();
        userScrollingRef.current = true;
        
        // Cancelar qualquer auto-scroll em andamento
        if (autoScrollFrameRef.current) {
          cancelAnimationFrame(autoScrollFrameRef.current);
          autoScrollFrameRef.current = null;
        }
        
        // Clear user scrolling flag after 3 seconds of no scroll
        scrollTimeout = setTimeout(() => {
          userScrollingRef.current = false;
        }, 3000);
      }
      
      // Se usuário está perto do fundo novamente, pode reativar auto-scroll
      if (nearBottom) {
        userScrollingRef.current = false;
        lastManualScrollRef.current = 0;
      }
      
      isNearBottomRef.current = nearBottom;
    };

    checkScroll();
    container.addEventListener('scroll', checkScroll);
    return () => {
      container.removeEventListener('scroll', checkScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      if (autoScrollFrameRef.current) {
        cancelAnimationFrame(autoScrollFrameRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVirtualized]); // containerRef is a ref and doesn't need to be in deps
  
  // Combinar handlers de scroll
  const handleScroll = React.useCallback(() => {
    if (isVirtualized) {
      handleVirtualScroll();
    } else {
      autoScrollHandleScroll();
    }
  }, [isVirtualized, handleVirtualScroll, autoScrollHandleScroll]);

  // Função unificada de scroll para baixo
  const scrollToBottom = React.useCallback(() => {
    // Cancel any ongoing auto-scroll animation
    if (autoScrollFrameRef.current) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    
    if (isVirtualized) {
      virtualScrollToBottom();
    } else {
      autoScrollToBottom();
    }
    // Re-enable auto-scroll when user manually scrolls to bottom
    isNearBottomRef.current = true;
    userScrollingRef.current = false;
    lastManualScrollRef.current = 0;
  }, [isVirtualized, virtualScrollToBottom, autoScrollToBottom]);

  // Track last message count to detect new user messages
  const lastMessageCountRef = React.useRef(0);
  // Track last message content for streaming detection
  const lastMessageContentRef = React.useRef('');
  // Track streaming state
  const isStreamingRef = React.useRef(false);

  // Auto-scroll inteligente durante mensagens e streaming
  React.useEffect(() => {
    const hasStreaming = messages.some(m => m.isStreaming);
    
    // Check if a new message was added
    const messageCountIncreased = messages.length > lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;
    
    // Check if streaming message content changed
    const lastMessage = messages[messages.length - 1];
    const contentChanged = lastMessage && lastMessage.content !== lastMessageContentRef.current;
    lastMessageContentRef.current = lastMessage?.content || '';
    
    // If a new message was just added (user sent message), force scroll to bottom
    if (messageCountIncreased && messages.length > 0) {
      // If the last message is from user, force scroll (they just sent it)
      if (lastMessage.role === 'user') {
        // Reset scroll tracking and force scroll to bottom
        userScrollingRef.current = false;
        lastManualScrollRef.current = 0;
        isNearBottomRef.current = true;
        scrollToBottom(); // Instant scroll for user messages
        return;
      }
    }
    
    // Don't auto-scroll if user is actively scrolling manually
    if (userScrollingRef.current) {
      return;
    }
    
    // Don't auto-scroll if user manually scrolled in the last 3 seconds
    const timeSinceManualScroll = Date.now() - lastManualScrollRef.current;
    if (timeSinceManualScroll < 3000 && lastManualScrollRef.current > 0) {
      return;
    }
    
    // Double-check: verify user is still near bottom before auto-scrolling
    const container = containerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      isNearBottomRef.current = distanceFromBottom < 100;
    }
    
    // Only auto-scroll if user is near the bottom (hasn't scrolled up)
    if (isNearBottomRef.current) {
      // Durante streaming, fazer scroll suave e contínuo
      if (hasStreaming && contentChanged) {
        // Usar requestAnimationFrame para scroll mais suave
        if (autoScrollFrameRef.current) {
          cancelAnimationFrame(autoScrollFrameRef.current);
        }
        
        autoScrollFrameRef.current = requestAnimationFrame(() => {
          if (container && isNearBottomRef.current && !userScrollingRef.current) {
            container.scrollTop = container.scrollHeight;
          }
          autoScrollFrameRef.current = null;
        });
      } else if (isLoading || messageCountIncreased) {
        // Para novo loading ou nova mensagem, scroll normal
        scrollToBottom();
      }
    }
    
    // Update streaming state
    isStreamingRef.current = hasStreaming;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading]);  // containerRef is a ref and doesn't need to be in deps; scrollToBottom omitted to prevent infinite loop
  
  // Continuous scroll during streaming using interval
  React.useEffect(() => {
    const hasStreaming = messages.some(m => m.isStreaming);
    if (!hasStreaming) return;
    
    // Initial scroll to bottom when streaming starts - BUT only if user hasn't scrolled recently
    const container = containerRef.current;
    const timeSinceManualScroll = Date.now() - lastManualScrollRef.current;
    const userScrolledRecently = timeSinceManualScroll < 3000 && lastManualScrollRef.current > 0;
    
    if (container && !userScrolledRecently) {
      container.scrollTop = container.scrollHeight;
      isNearBottomRef.current = true;
    }
    
    const streamingScrollInterval = setInterval(() => {
      const container = containerRef.current;
      if (!container) return;
      
      // Check if user scrolled up recently (last 3 seconds)
      const timeSinceManualScroll = Date.now() - lastManualScrollRef.current;
      const userScrolledUpRecently = timeSinceManualScroll < 3000 && lastManualScrollRef.current > 0;
      
      if (userScrolledUpRecently) return;
      
      // Check current position
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      // Only auto-scroll if we're reasonably close to bottom (within 300px)
      if (distanceFromBottom < 300) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100); // Check every 100ms during streaming
    
    return () => clearInterval(streamingScrollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]); // containerRef is a ref and doesn't need to be in deps

  // Count messages that will be deleted when regenerating
  const getMessagesToDeleteCount = (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return 0;
    return messages.length - messageIndex;
  };

  const hasStreamingAssistant = messages.some(
    (msg) => msg.role === 'assistant' && msg.isStreaming
  );

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isLoadingChat) {
    return <ChatLoadingState />;
  }

  if (messages.length === 0 && !isLoading) {
    return <EmptyState incognitoMode={incognitoMode} aiName={aiName} />;
  }

  return (
    <main
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto relative"
      style={
        userProfile?.chatBackgroundURL
          ? {
              backgroundImage: `url(${userProfile.chatBackgroundURL})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
            }
          : { backgroundColor: 'hsl(var(--muted))' }
      }
    >
      {/* Shared Chat Banner */}
      {isSharedChat && (
        <div className="sticky top-0 z-10 bg-blue-500/10 border-b border-blue-500/20 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 md:px-8 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {shareType === 'collaborative' ? (
                    <>
                      Chat Colaborativo {!isOwner && sharedBy && `• Compartilhado por ${sharedBy}`}
                    </>
                  ) : (
                    <>
                      Cópia de Chat Compartilhado {sharedBy && `por ${sharedBy}`}
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {shareType === 'collaborative' ? (
                    isOwner ? (
                      'Você é o proprietário. Outros usuários podem ver e enviar mensagens.'
                    ) : (
                      'Você tem acesso colaborativo. Suas mensagens serão visíveis para o proprietário.'
                    )
                  ) : (
                    'Esta é uma cópia independente. Suas alterações não afetam o chat original.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-4">
        {/* Placeholder superior para mensagens não renderizadas */}
        {isVirtualized && topPlaceholderHeight > 0 && (
          <div style={{ height: `${topPlaceholderHeight}px` }} aria-hidden="true" />
        )}

        {/* Renderizar apenas mensagens visíveis */}
        {renderedMessages.map((message) => (
          <MessageCard
            key={message.id}
            message={message}
            formatTime={formatTime}
            copyToClipboard={copyToClipboard}
            aiName={aiName}
            savingMessageIds={savingMessageIds}
            onRegenerateRequest={() => setMessageToRegenerate(message.id)}
            onDeleteRequest={() => setMessageToDelete(message.id)}
            onEdit={onEditMessage}
            onViewImage={(url, name) => {
              setSelectedImage({ url, name });
              setImageViewerOpen(true);
            }}
            fontFamily={getFontFamily(userProfile?.fontFamily || 'Inter')}
            fontSize={userProfile?.fontSize || 16}
            registerHeight={isVirtualized ? registerMessageHeight : undefined}
            hasBackground={!!userProfile?.chatBackgroundURL}
          />
        ))}

        {isLoading && !hasStreamingAssistant && <TypingIndicator />}

        {/* Placeholder inferior para mensagens não renderizadas */}
        {isVirtualized && bottomPlaceholderHeight > 0 && (
          <div style={{ height: `${bottomPlaceholderHeight}px` }} aria-hidden="true" />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Virtualization Indicator */}
      {isVirtualized && (
        <div className="fixed top-20 right-6 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full flex items-center gap-2 text-xs font-medium text-primary animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Virtualizado ({totalWords.toLocaleString('pt-BR')} palavras)</span>
        </div>
      )}

      {/* Scroll to Bottom FAB */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom()}
          className="fixed bottom-24 right-6 w-12 h-12 bg-card border border-border shadow-lg hover:shadow-xl rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      {/* Delete Confirmation Modal */}
      {messageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
            onClick={() => setMessageToDelete(null)}
          />
          <div className="relative bg-card border border-border rounded-xl shadow-lg p-6 max-w-sm w-full animate-in slide-in-from-bottom-2 duration-300">
            <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Deletar Mensagem</h3>
            <p className="text-muted-foreground mb-4">
              Tem certeza que deseja deletar esta mensagem? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMessageToDelete(null)}
                className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-lg transition-colors duration-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteMessage?.(messageToDelete);
                  setMessageToDelete(null);
                }}
                className="flex-1 px-4 py-2.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-medium rounded-lg shadow-sm transition-all duration-200"
              >
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Confirmation Modal */}
      {messageToRegenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
            onClick={() => setMessageToRegenerate(null)}
          />
          <div className="relative bg-card border border-border rounded-xl shadow-lg p-6 max-w-sm w-full animate-in slide-in-from-bottom-2 duration-300">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <RefreshCw className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Regenerar Resposta</h3>
            <p className="text-muted-foreground mb-4">
              Ao regenerar esta resposta, {getMessagesToDeleteCount(messageToRegenerate)} {getMessagesToDeleteCount(messageToRegenerate) === 1 ? 'mensagem será apagada' : 'mensagens serão apagadas'} (incluindo esta e todas as posteriores). Deseja continuar?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMessageToRegenerate(null)}
                className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-lg transition-colors duration-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onRegenerateMessage?.(messageToRegenerate);
                  setMessageToRegenerate(null);
                }}
                className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg shadow-sm transition-all duration-200"
              >
                Regenerar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {selectedImage && (
        <ImageViewerModal
          isOpen={imageViewerOpen}
          onClose={() => {
            setImageViewerOpen(false);
            setSelectedImage(null);
          }}
          imageUrl={selectedImage.url}
          imageName={selectedImage.name}
        />
      )}
    </main>
  );
}

// MessageCard Component
interface MessageCardProps {
  message: Message;
  formatTime: (date: Date) => string;
  copyToClipboard: (text: string) => void;
  aiName?: string;
  savingMessageIds?: Set<string>;
  onRegenerateRequest?: () => void;
  onDeleteRequest?: () => void;
  onEdit?: (messageId: string, content: string) => void;
  onViewImage?: (url: string, name: string) => void;
  fontFamily?: string;
  fontSize?: number;
  registerHeight?: (messageId: string, element: HTMLDivElement | null) => void;
  hasBackground?: boolean;
}

function MessageCard({
  message,
  formatTime,
  copyToClipboard,
  aiName = 'Haumea',
  savingMessageIds = new Set(),
  onRegenerateRequest,
  onDeleteRequest,
  onEdit,
  onViewImage,
  fontFamily,
  fontSize = 16,
  registerHeight,
  hasBackground = false,
}: MessageCardProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(message.content);
  const [usageModalOpen, setUsageModalOpen] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const messageCardRef = React.useRef<HTMLDivElement>(null);

  // Registrar altura do card quando virtualizado
  React.useEffect(() => {
    if (registerHeight && messageCardRef.current) {
      registerHeight(message.id, messageCardRef.current);
    }
    return () => {
      if (registerHeight) {
        registerHeight(message.id, null);
      }
    };
  }, [message.id, registerHeight]);

  const handleCopy = () => {
    copyToClipboard(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEdit = () => {
    if (isEditing) {
      // Save edit
      if (editContent.trim() && editContent !== message.content) {
        onEdit?.(message.id, editContent.trim());
      }
      setIsEditing(false);
    } else {
      // Start editing
      setEditContent(message.content);
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  // Auto-resize textarea when editing
  React.useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(textarea.scrollHeight, 150)}px`;
    }
  }, [isEditing, editContent]);

  return (
    <div ref={messageCardRef} className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Avatar */}
      <div
        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${
          isUser
            ? 'bg-muted text-foreground'
            : 'bg-primary/10 text-primary'
        }`}
      >
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>

      {/* Message Card */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-foreground">
            {isUser ? 'Você' : aiName}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
          {message.webSearchEnabled && (
            <span className="px-2 py-0.5 bg-accent/10 text-accent text-xs font-medium rounded flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Web Search
            </span>
          )}
        </div>

        {/* Content Card */}
        <div
          className={`border shadow-sm rounded-2xl p-4 hover:shadow-md transition-shadow duration-200 break-words overflow-hidden ${
            isUser ? 'border-border' : 'border-primary/20 border-l-[3px] border-l-primary'
          } ${
            hasBackground ? 'backdrop-blur-md bg-card/85' : 'bg-card'
          }`}
        >
          {/* Message Content */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-3 bg-muted border border-border rounded-lg text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary overflow-hidden"
                autoFocus
                style={{ minHeight: '150px', fontFamily: fontFamily, fontSize: `${fontSize}px` }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Salvar
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 bg-muted text-foreground text-sm font-medium rounded-lg hover:bg-muted/80 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div style={{ fontFamily: fontFamily, fontSize: `${fontSize}px` }}>
              <MarkdownRenderer content={message.content} />
            </div>
          )}
          
          {/* Streaming Indicator */}
          {message.isStreaming && (
            <span className="inline-block ml-1 w-1.5 h-4 bg-primary animate-pulse" />
          )}

          {/* Reasoning Block - Only for assistant messages */}
          {!isUser && message.reasoning && (
            <div className="mt-4">
              <ReasoningBlock reasoning={message.reasoning} model={message.model} />
            </div>
          )}

          {/* Web Search Citations */}
          {message.citations && message.citations.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-md bg-accent/10">
                  <ExternalLink className="w-3.5 h-3.5 text-accent" />
                </div>
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  Fontes da Web
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {message.citations.map((citation, i) => (
                  <a
                    key={i}
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block p-3 rounded-lg bg-accent/5 hover:bg-accent/10 border border-accent/20 hover:border-accent/40 transition-all duration-150"
                  >
                    <div className="flex items-start gap-2">
                      <ExternalLink className="w-4 h-4 shrink-0 text-accent mt-0.5 group-hover:scale-110 transition-transform duration-150" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-accent transition-colors duration-150">
                          {citation.title}
                        </p>
                        {citation.content && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {citation.content}
                          </p>
                        )}
                        <p className="text-xs text-accent/70 mt-1.5 truncate">
                          {(() => {
                            try {
                              return new URL(citation.url).hostname;
                            } catch {
                              return 'URL inválida';
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
              {message.attachments.map((attachment) => (
                <AttachmentPreview
                  key={attachment.id}
                  attachment={attachment}
                  onViewImage={onViewImage}
                />
              ))}
            </div>
          )}

          {/* Generated Images */}
          {message.generatedImages && message.generatedImages.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                Imagens Geradas pela IA
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {message.generatedImages.map((image) => (
                  <button
                    key={image.id}
                    onClick={() => onViewImage?.(image.url, `generated_${image.id}`)}
                    className="relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-all duration-200 bg-muted group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt="Imagem gerada pela IA"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!isEditing && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <button
                onClick={handleCopy}
                className={`p-2 rounded-lg transition-all duration-150 ${
                  copied
                    ? 'text-accent bg-accent/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title="Copiar"
              >
                {copied ? (
                  <Check className="w-4 h-4 animate-in zoom-in duration-200" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>

              {isUser && (
                <button
                  onClick={onRegenerateRequest}
                  disabled={savingMessageIds.has(message.id)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={savingMessageIds.has(message.id) ? "Salvando..." : "Regenerar resposta"}
                >
                  {savingMessageIds.has(message.id) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
              )}

              <button
                onClick={handleEdit}
                disabled={savingMessageIds.has(message.id)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                title={savingMessageIds.has(message.id) ? "Salvando..." : "Editar"}
              >
                {savingMessageIds.has(message.id) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Edit2 className="w-4 h-4" />
                )}
              </button>

              <button
                onClick={onDeleteRequest}
                disabled={savingMessageIds.has(message.id)}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                title={savingMessageIds.has(message.id) ? "Salvando..." : "Deletar"}
              >
                {savingMessageIds.has(message.id) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>

              {/* Usage Button (only for assistant messages with usage data) */}
              {!isUser && message.usage && (
                <button
                  onClick={() => setUsageModalOpen(true)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors duration-150"
                  title="Ver custos do request"
                >
                  <DollarSign className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Usage Modal */}
      {usageModalOpen && message.usage && (
        <MessageUsageModal
          isOpen={usageModalOpen}
          onClose={() => setUsageModalOpen(false)}
          message={message}
        />
      )}
    </div>
  );
}

// Attachment Preview Component
function AttachmentPreview({
  attachment,
  onViewImage,
}: {
  attachment: {
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
  };
  onViewImage?: (url: string, name: string) => void;
}) {
  const isImage = attachment.type.startsWith('image/');

  if (isImage) {
    return (
      <div
        className="relative group aspect-square rounded-lg overflow-hidden border border-border hover:border-primary/30 cursor-pointer transition-all duration-200"
        onClick={() => onViewImage?.(attachment.url, attachment.name)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-foreground/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
          <Maximize2 className="w-6 h-6 text-background" />
        </div>
      </div>
    );
  }

  return (
    <a
      href={attachment.url}
      download={attachment.name}
      className="flex items-center gap-2 p-3 bg-muted border border-border rounded-lg hover:bg-muted/80 hover:border-primary/30 transition-colors duration-150"
    >
      <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{attachment.name}</p>
        <p className="text-xs text-muted-foreground">
          {(attachment.size / 1024).toFixed(1)} KB
        </p>
      </div>
      <Download className="w-4 h-4 text-muted-foreground shrink-0" />
    </a>
  );
}

// Typing Indicator Component
function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-in fade-in duration-300">
      <div className="w-8 h-8 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
        <Bot className="w-5 h-5" />
      </div>

      <div className="bg-card border border-primary/20 shadow-sm rounded-2xl px-5 py-3">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
}

// Chat Loading State Component
function ChatLoadingState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-20 h-20 mb-6 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
        <Sparkles className="w-10 h-10 text-primary" />
      </div>
      
      <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
      <p className="text-foreground font-medium mb-1">Carregando conversa...</p>
      <p className="text-sm text-muted-foreground">Aguarde um momento</p>
      
      {/* Skeleton messages */}
      <div className="max-w-4xl w-full mt-8 space-y-4 px-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="w-8 h-8 shrink-0 rounded-full bg-muted" />
            <div className="flex-1">
              <div className="h-4 bg-muted rounded w-32 mb-2" />
              <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-5/6" />
                <div className="h-3 bg-muted rounded w-4/6" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState({ incognitoMode = false, aiName = 'Haumea' }: { incognitoMode?: boolean; aiName?: string }) {
  const suggestions = incognitoMode
    ? [
        {
          icon: ShieldOff,
          title: 'Sem Salvamento',
          description: 'Suas mensagens não são salvas no servidor',
        },
        {
          icon: Users,
          title: 'Sem Apelido',
          description: 'Seu nome e apelido não são enviados para a IA',
        },
        {
          icon: Brain,
          title: 'Sem Memórias',
          description: 'Memórias globais e personalizadas não são usadas',
        },
        {
          icon: EyeOff,
          title: 'Privacidade Total',
          description: 'Conversação privada sem personalização',
        },
      ]
    : [
        {
          icon: Code,
          title: 'Ajuda com Código',
          description: 'Explique, revise ou crie código em qualquer linguagem',
        },
        {
          icon: FileText,
          title: 'Escrever Conteúdo',
          description: 'Artigos, emails, documentos e mais',
        },
        {
          icon: Sparkles,
          title: 'Ideias Criativas',
          description: 'Brainstorm, planejamento e soluções inovadoras',
        },
        {
          icon: ExternalLink,
          title: 'Pesquisa na Web',
          description: 'Busque informações atualizadas da internet',
        },
      ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className={`w-20 h-20 mb-6 rounded-full flex items-center justify-center ${
        incognitoMode ? 'bg-primary/10 ring-2 ring-primary/20' : 'bg-primary/10'
      }`}>
        {incognitoMode ? (
          <EyeOff className="w-10 h-10 text-primary" />
        ) : (
          <Sparkles className="w-10 h-10 text-primary" />
        )}
      </div>

      <h2 className="text-2xl font-semibold text-foreground mb-2">
        {incognitoMode ? 'Modo Incógnito Ativo' : `Bem-vindo à ${aiName}`}
      </h2>

      <p className="text-muted-foreground mb-8 max-w-md">
        {incognitoMode 
          ? 'Converse livremente sem que suas mensagens sejam salvas ou dados pessoais enviados.'
          : 'Chat com múltiplos modelos de IA, busca web, anexos e muito mais.'
        }
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
        {suggestions.map((suggestion, i) => (
          <div
            key={i}
            className={`p-4 text-left bg-card border rounded-xl transition-all duration-200 ${
              incognitoMode
                ? 'border-primary/20 bg-primary/5'
                : 'border-border hover:border-primary/30 hover:shadow-md'
            }`}
          >
            <div className="flex items-start gap-3">
              <suggestion.icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground mb-1">{suggestion.title}</p>
                <p className="text-sm text-muted-foreground">{suggestion.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
