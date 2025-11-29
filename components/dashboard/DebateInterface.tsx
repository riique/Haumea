'use client';

import React from 'react';
import { Loader2, User, ChevronDown, Copy, Check, Trash2 } from 'lucide-react';
import { DebateMessage, DebateConfig } from '@/types/chat';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { useChatAutoScroll } from '@/hooks/useChatAutoScroll';

interface DebateInterfaceProps {
  messages: DebateMessage[];
  config: DebateConfig;
  isLoading?: boolean;
  currentTurn?: 'participant1' | 'participant2' | null;
  onDeleteMessage?: (messageId: string) => void | Promise<void>;
}

export function DebateInterface({
  messages,
  config,
  isLoading = false,
  currentTurn,
  onDeleteMessage,
}: DebateInterfaceProps) {
  const { messagesEndRef, containerRef, scrollToBottom } = useChatAutoScroll(
    messages.length,
    isLoading,
    'debate'
  );
  
  const [showScrollButton, setShowScrollButton] = React.useState(false);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const checkScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setShowScrollButton(distanceFromBottom > 200);
    };

    checkScroll();
    container.addEventListener('scroll', checkScroll);
    return () => container.removeEventListener('scroll', checkScroll);
  }, [containerRef]);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <main
      ref={containerRef}
      className="flex-1 bg-muted overflow-y-auto relative"
    >
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-4">
        {messages.map((message) => (
          <DebateMessageCard
            key={message.id}
            message={message}
            config={config}
            formatTime={formatTime}
            onDeleteMessage={onDeleteMessage}
          />
        ))}

        {/* Only show typing indicator if there's no streaming message already */}
        {isLoading && currentTurn && !messages.some(m => m.isStreaming) && (
          <DebateTypingIndicator
            participantName={
              currentTurn === 'participant1'
                ? config.participant1.name
                : config.participant2.name
            }
            participantNumber={currentTurn === 'participant1' ? 1 : 2}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-24 right-6 w-12 h-12 bg-card border border-border shadow-lg hover:shadow-xl rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}
    </main>
  );
}

// Debate Message Card Component
interface DebateMessageCardProps {
  message: DebateMessage;
  config: DebateConfig;
  formatTime: (date: Date) => string;
  onDeleteMessage?: (messageId: string) => void | Promise<void>;
}

function DebateMessageCard({ message, config, formatTime, onDeleteMessage }: DebateMessageCardProps) {
  const [copied, setCopied] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Remove participant name from content if it's prefixed (for backward compatibility)
  const cleanContent = (content: string, participantName?: string): string => {
    if (!participantName) return content;
    
    let cleanedContent = content;
    let previousContent = '';
    
    // Keep removing until no more prefixes found (handles multiple duplications)
    while (cleanedContent !== previousContent) {
      previousContent = cleanedContent;
      
      const patterns = [
        `**${participantName}**: `,
        `**${participantName}:**`,
        `${participantName}: `,
        `${participantName}:`,
      ];
      
      for (const pattern of patterns) {
        if (cleanedContent.startsWith(pattern)) {
          cleanedContent = cleanedContent.slice(pattern.length).trim();
          break;
        }
      }
    }
    
    return cleanedContent;
  };

  const displayContent = cleanContent(message.content, message.participantName);

  const handleCopy = () => {
    navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!onDeleteMessage || isDeleting) return;
    
    if (confirm('Tem certeza que deseja deletar esta mensagem?')) {
      setIsDeleting(true);
      try {
        await onDeleteMessage(message.id);
      } catch (error) {
        console.error('Error deleting message:', error);
        setIsDeleting(false);
      }
    }
  };

  // Determine message colors and participant info
  let participantColor = 'gray';
  let participantName = 'Sistema';
  let participantLabel = '';

  if (message.debateRole === 'participant1') {
    participantColor = 'blue';
    participantName = config.participant1.name;
    participantLabel = 'Participante 1';
  } else if (message.debateRole === 'participant2') {
    participantColor = 'red';
    participantName = config.participant2.name;
    participantLabel = 'Participante 2';
  } else if (message.debateRole === 'moderator') {
    participantColor = 'green';
    participantName = config.moderatorName;
    participantLabel = 'Moderador';
  }

  const colorClasses = {
    blue: {
      bg: 'bg-blue-500/5',
      border: 'border-blue-500/20 border-l-blue-500',
      dot: 'bg-blue-500',
      text: 'text-blue-600',
      avatar: 'bg-blue-500/10 text-blue-600',
    },
    red: {
      bg: 'bg-red-500/5',
      border: 'border-red-500/20 border-l-red-500',
      dot: 'bg-red-500',
      text: 'text-red-600',
      avatar: 'bg-red-500/10 text-red-600',
    },
    green: {
      bg: 'bg-green-500/5',
      border: 'border-green-500/20 border-l-green-500',
      dot: 'bg-green-500',
      text: 'text-green-600',
      avatar: 'bg-green-500/10 text-green-600',
    },
    gray: {
      bg: 'bg-muted',
      border: 'border-border',
      dot: 'bg-muted-foreground',
      text: 'text-muted-foreground',
      avatar: 'bg-muted text-muted-foreground',
    },
  };

  const colors = colorClasses[participantColor as keyof typeof colorClasses];

  return (
    <div className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Avatar */}
      <div
        className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${colors.avatar}`}
      >
        <User className="w-5 h-5" />
      </div>

      {/* Message Card */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
            <span className={`text-sm font-semibold ${colors.text}`}>
              {participantName}
            </span>
          </div>
          {participantLabel && (
            <span className="text-xs text-muted-foreground">
              • {participantLabel}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
        </div>

        {/* Content Card */}
        <div
          className={`border shadow-sm rounded-2xl p-4 hover:shadow-md transition-shadow duration-200 break-words overflow-hidden border-l-[3px] ${colors.border} ${colors.bg}`}
        >
          {/* Message Content or Thinking Indicator */}
          {displayContent ? (
            <div className="text-foreground">
              <MarkdownRenderer content={displayContent} />
            </div>
          ) : message.isStreaming ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm">Pensando...</span>
            </div>
          ) : null}

          {/* Streaming Indicator (cursor) - only when there's content */}
          {message.isStreaming && displayContent && (
            <span className="inline-block ml-1 w-1.5 h-4 bg-primary animate-pulse" />
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
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

            {/* Delete Button - Only for participant messages */}
            {onDeleteMessage && (message.debateRole === 'participant1' || message.debateRole === 'participant2') && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className={`p-2 rounded-lg transition-all duration-150 ${
                  isDeleting
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                }`}
                title="Deletar mensagem"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Debate Typing Indicator Component
interface DebateTypingIndicatorProps {
  participantName: string;
  participantNumber: 1 | 2;
}

function DebateTypingIndicator({
  participantName,
  participantNumber,
}: DebateTypingIndicatorProps) {
  const color = participantNumber === 1 ? 'blue' : 'red';
  const colorClasses = {
    blue: {
      avatar: 'bg-blue-500/10 text-blue-600',
      border: 'border-blue-500/20',
      dot: 'bg-blue-500',
      text: 'text-blue-600',
    },
    red: {
      avatar: 'bg-red-500/10 text-red-600',
      border: 'border-red-500/20',
      dot: 'bg-red-500',
      text: 'text-red-600',
    },
  };
  
  const colors = colorClasses[color];

  return (
    <div className="flex items-start gap-3 animate-in fade-in duration-300">
      <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${colors.avatar}`}>
        <User className="w-5 h-5" />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
          <span className={`text-sm font-semibold ${colors.text}`}>
            {participantName}
          </span>
        </div>

        <div className={`bg-card border ${colors.border} shadow-sm rounded-2xl px-5 py-3 inline-flex items-center gap-2`}>
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Pensando...</span>
        </div>
      </div>
    </div>
  );
}
