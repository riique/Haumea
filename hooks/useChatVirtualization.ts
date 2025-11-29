import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Message } from '@/types/chat';

// Configurações de virtualização
const WORD_COUNT_THRESHOLD = 10000; // Ativa virtualização após 10k palavras
const WINDOW_SIZE = 50; // Mensagens principais renderizadas
const BUFFER_SIZE = 10; // Buffer antes e depois
const ESTIMATED_MESSAGE_HEIGHT = 120; // Altura estimada inicial por mensagem (px)
const SCROLL_DEBOUNCE_MS = 150; // Debounce para scroll
const BUFFER_MARGIN_PX = 500; // Margem de pré-carregamento

interface VirtualizationState {
  isVirtualized: boolean;
  renderStart: number;
  renderEnd: number;
  totalWords: number;
}

interface MessageHeightCache {
  [messageId: string]: number;
}

/**
 * Hook para virtualização de mensagens do chat
 * Otimiza renderização quando o total de palavras ultrapassa o threshold
 */
export function useChatVirtualization(messages: Message[]) {
  const [state, setState] = useState<VirtualizationState>({
    isVirtualized: false,
    renderStart: 0,
    renderEnd: messages.length,
    totalWords: 0,
  });

  const heightCacheRef = useRef<MessageHeightCache>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isScrollingRef = useRef(false);

  // Função para contar palavras em uma mensagem
  const countWords = useCallback((text: string): number => {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }, []);

  // Calcular total de palavras em todas as mensagens
  const totalWords = useMemo(() => {
    return messages.reduce((total, msg) => {
      return total + countWords(msg.content);
    }, 0);
  }, [messages, countWords]);

  // Determinar se deve ativar virtualização
  const shouldVirtualize = totalWords > WORD_COUNT_THRESHOLD;

  // Obter altura de uma mensagem (do cache ou estimativa)
  const getMessageHeight = useCallback((messageId: string): number => {
    return heightCacheRef.current[messageId] || ESTIMATED_MESSAGE_HEIGHT;
  }, []);

  // Registrar altura real de uma mensagem
  const registerMessageHeight = useCallback((messageId: string, element: HTMLDivElement | null) => {
    if (element) {
      messageRefs.current.set(messageId, element);
      const height = element.getBoundingClientRect().height;
      if (height > 0 && heightCacheRef.current[messageId] !== height) {
        heightCacheRef.current[messageId] = height;
      }
    } else {
      messageRefs.current.delete(messageId);
    }
  }, []);

  // Calcular altura total de um range de mensagens
  const calculateRangeHeight = useCallback((start: number, end: number): number => {
    let totalHeight = 0;
    for (let i = start; i < end && i < messages.length; i++) {
      totalHeight += getMessageHeight(messages[i].id);
    }
    return totalHeight;
  }, [messages, getMessageHeight]);

  // Calcular nova janela de renderização baseada no scroll
  const calculateRenderWindow = useCallback((): { start: number; end: number } => {
    if (!containerRef.current || !shouldVirtualize) {
      return { start: 0, end: messages.length };
    }

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;
    const scrollHeight = container.scrollHeight;
    
    // Encontrar índice central da viewport
    let accumulatedHeight = 0;
    let centerIndex = messages.length - 1; // Default para última mensagem

    for (let i = 0; i < messages.length; i++) {
      const messageHeight = getMessageHeight(messages[i].id);
      accumulatedHeight += messageHeight;
      
      if (accumulatedHeight >= scrollTop + viewportHeight / 2) {
        centerIndex = i;
        break;
      }
    }

    // Se estiver no final do scroll, garantir que mostra as últimas mensagens
    const isAtBottom = scrollHeight - scrollTop - viewportHeight < 100;
    if (isAtBottom) {
      centerIndex = messages.length - 1;
    }

    // Calcular janela ao redor do centro
    const halfWindow = Math.floor(WINDOW_SIZE / 2);
    let start = Math.max(0, centerIndex - halfWindow - BUFFER_SIZE);
    let end = Math.min(messages.length, centerIndex + halfWindow + BUFFER_SIZE);

    // Garantir que sempre mostra pelo menos WINDOW_SIZE mensagens
    if (end - start < WINDOW_SIZE && messages.length >= WINDOW_SIZE) {
      if (end === messages.length) {
        start = Math.max(0, end - WINDOW_SIZE - BUFFER_SIZE);
      } else {
        end = Math.min(messages.length, start + WINDOW_SIZE + BUFFER_SIZE);
      }
    }

    return { start, end };
  }, [messages, shouldVirtualize, getMessageHeight]);

  // Handler de scroll com debounce leve
  const handleScroll = useCallback(() => {
    if (!shouldVirtualize) return;

    isScrollingRef.current = true;

    // Limpar timeout anterior
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Atualizar janela com pequeno delay
    scrollTimeoutRef.current = setTimeout(() => {
      const { start, end } = calculateRenderWindow();
      setState(prev => {
        // Só atualizar se realmente mudou
        if (prev.renderStart !== start || prev.renderEnd !== end) {
          return {
            ...prev,
            renderStart: start,
            renderEnd: end,
          };
        }
        return prev;
      });
      isScrollingRef.current = false;
    }, SCROLL_DEBOUNCE_MS);
  }, [shouldVirtualize, calculateRenderWindow]);

  // Atualizar estado de virtualização quando mensagens ou total de palavras mudar
  useEffect(() => {
    setState(prev => {
      if (!shouldVirtualize) {
        // Desativar virtualização - renderizar todas as mensagens
        return {
          isVirtualized: false,
          renderStart: 0,
          renderEnd: messages.length,
          totalWords,
        };
      }

      // Ativar virtualização
      if (!prev.isVirtualized) {
        // Primeira ativação - mostrar últimas mensagens
        const start = Math.max(0, messages.length - WINDOW_SIZE - BUFFER_SIZE);
        return {
          isVirtualized: true,
          renderStart: start,
          renderEnd: messages.length,
          totalWords,
        };
      }

      // Já virtualizado - detectar se há novas mensagens
      const hasNewMessages = messages.length > prev.renderEnd;
      
      if (hasNewMessages) {
        // Nova mensagem adicionada - atualizar IMEDIATAMENTE
        // Cancelar qualquer scroll pendente para priorizar nova mensagem
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
          isScrollingRef.current = false;
        }
        
        // Manter janela rolando para baixo
        const start = Math.max(0, messages.length - WINDOW_SIZE - BUFFER_SIZE);
        return {
          ...prev,
          renderStart: start,
          renderEnd: messages.length,
          totalWords,
        };
      }

      // Apenas atualizar o final da janela
      return {
        ...prev,
        renderEnd: messages.length,
        totalWords,
      };
    });
  }, [messages.length, shouldVirtualize, totalWords]);

  // Auto-scroll para novas mensagens
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      
      // Se virtualizado, ajustar janela para mostrar últimas mensagens
      if (shouldVirtualize) {
        const start = Math.max(0, messages.length - WINDOW_SIZE - BUFFER_SIZE);
        setState(prev => ({
          ...prev,
          renderStart: start,
          renderEnd: messages.length,
        }));
      }
    }
  }, [shouldVirtualize, messages.length]);

  // Scroll para mensagem específica
  const scrollToMessage = useCallback((messageId: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    if (shouldVirtualize) {
      // Calcular nova janela centralizada na mensagem
      const halfWindow = Math.floor(WINDOW_SIZE / 2);
      const start = Math.max(0, messageIndex - halfWindow - BUFFER_SIZE);
      const end = Math.min(messages.length, messageIndex + halfWindow + BUFFER_SIZE);

      setState(prev => ({
        ...prev,
        renderStart: start,
        renderEnd: end,
      }));

      // Aguardar render e scrollar
      setTimeout(() => {
        const element = messageRefs.current.get(messageId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    } else {
      const element = messageRefs.current.get(messageId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [messages, shouldVirtualize]);

  // Calcular alturas dos placeholders
  const topPlaceholderHeight = useMemo(() => {
    if (!state.isVirtualized) return 0;
    return calculateRangeHeight(0, state.renderStart);
  }, [state.isVirtualized, state.renderStart, calculateRangeHeight]);

  const bottomPlaceholderHeight = useMemo(() => {
    if (!state.isVirtualized) return 0;
    return calculateRangeHeight(state.renderEnd, messages.length);
  }, [state.isVirtualized, state.renderEnd, messages.length, calculateRangeHeight]);

  // Mensagens a serem renderizadas
  const renderedMessages = useMemo(() => {
    if (!state.isVirtualized) {
      return messages;
    }
    return messages.slice(state.renderStart, state.renderEnd);
  }, [messages, state.isVirtualized, state.renderStart, state.renderEnd]);

  // Limpar cache quando mensagens são deletadas
  useEffect(() => {
    const currentMessageIds = new Set(messages.map(m => m.id));
    const cachedIds = Object.keys(heightCacheRef.current);
    
    cachedIds.forEach(id => {
      if (!currentMessageIds.has(id)) {
        delete heightCacheRef.current[id];
      }
    });
  }, [messages]);

  // Cleanup de timeouts pendentes
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current !== null) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Estado
    isVirtualized: state.isVirtualized,
    totalWords: state.totalWords,
    
    // Mensagens
    renderedMessages,
    allMessages: messages, // Para enviar à API
    
    // Placeholders
    topPlaceholderHeight,
    bottomPlaceholderHeight,
    
    // Refs
    containerRef,
    registerMessageHeight,
    
    // Funções
    handleScroll,
    scrollToBottom,
    scrollToMessage,
  };
}
