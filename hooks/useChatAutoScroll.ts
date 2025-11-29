import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Hook para gerenciar auto-scroll no chat
 */
export function useChatAutoScroll(messagesLength: number, isLoading: boolean, chatId?: string) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const hasScrolledInitially = useRef(false);
  const lastChatId = useRef(chatId);

  // Resetar flag quando mudar de chat
  useEffect(() => {
    if (chatId !== lastChatId.current) {
      hasScrolledInitially.current = false;
      lastChatId.current = chatId;
    }
  }, [chatId]);

  // Scroll inicial apenas quando o chat carrega (não em novas mensagens)
  useEffect(() => {
    if (messagesEndRef.current && messagesLength > 0 && !hasScrolledInitially.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
      hasScrolledInitially.current = true;
    }
  }, [messagesLength]);

  // Detectar se usuário scrollou pra cima
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    setShowScrollButton(distanceFromBottom > 200);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return {
    messagesEndRef,
    containerRef,
    showScrollButton,
    scrollToBottom,
    handleScroll,
  };
}
