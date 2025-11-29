import { useState, useCallback, useRef, useEffect } from 'react';
import { DebateConfig, DebateMessage, DebateSession } from '@/types/chat';
import { processDebateTurn } from '@/lib/services/debate-service';
import * as chatService from '@/lib/services/chat-service';
import * as messageService from '@/lib/services/message-service';

export function useDebateMode(userId: string | undefined) {
  const [debateActive, setDebateActive] = useState(false);
  const [debateSession, setDebateSession] = useState<DebateSession | null>(null);
  const [debateMessages, setDebateMessages] = useState<DebateMessage[]>([]);
  const [isDebateLoading, setIsDebateLoading] = useState(false);
  const [debateChatId, setDebateChatId] = useState<string | null>(null);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [totalTokens, setTotalTokens] = useState<number>(0);
  const [exchangesStarted, setExchangesStarted] = useState(false); // Flag for actual debate exchanges
  const isProcessingTurnRef = useRef(false);
  const messagesRef = useRef<DebateMessage[]>([]);
  const debateSessionRef = useRef<DebateSession | null>(null);
  const debateChatIdRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    messagesRef.current = debateMessages;
  }, [debateMessages]);

  useEffect(() => {
    debateSessionRef.current = debateSession;
  }, [debateSession]);

  useEffect(() => {
    debateChatIdRef.current = debateChatId;
  }, [debateChatId]);

  const startDebate = useCallback(async (config: DebateConfig) => {
    if (!userId) {
      return;
    }

    try {
      console.log('🎭 [Debate] Creating chat for debate...', { userId, topic: config.topic });
      
      // Create chat for debate (name without emoji prefix for cleaner sidebar)
      const chatId = await chatService.createChat(userId, {
        name: config.topic,
        systemPrompt: `🎭 Debate entre ${config.participant1.name} (${config.participant1.position}) e ${config.participant2.name} (${config.participant2.position})`,
        context: `Tema: ${config.topic}\nPautas: ${config.points.join(', ')}`,
        password: '',
        latexEnabled: false,
        latexLevel: 'medio',
        temperature: 1.0,
        frequencyPenalty: 0,
        repetitionPenalty: 0,
        maxTokens: 4096,
        memories: [],
        isDebate: true, // Mark as debate
        debateConfig: config, // Store debate configuration
      });

      console.log('✅ [Debate] Chat created successfully:', { chatId });

      setDebateChatId(chatId);
      setTotalCost(0);
      setTotalTokens(0);

      const session: DebateSession = {
        id: chatId,
        config,
        messages: [],
        currentTurn: null,
        isActive: true,
        isPaused: false,
        hasStarted: false,
        createdAt: new Date(),
        systemPromptTemplate: '', // Will be set by backend
      };

      setDebateSession(session);
      setDebateMessages([]);
      setDebateActive(true);
      setExchangesStarted(false); // Presentations only, not exchanges yet
      
      // Update refs immediately
      debateSessionRef.current = session;
      debateChatIdRef.current = chatId;
      messagesRef.current = [];
    } catch (error) {
      alert('Erro ao criar chat do debate. Tente novamente.');
      throw error; // Re-throw to prevent continuing
    }
  }, [userId]);

  const stopDebate = useCallback(async () => {
    // Save debate state before stopping (don't delete)
    if (userId && debateChatId) {
      try {
        console.log('🛑 [Debate] Stopping debate, saving final state:', {
          chatId: debateChatId,
          messageCount: messagesRef.current.length,
          totalCost,
          totalTokens,
        });
        
        // Save final messages
        const messages = messagesRef.current.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt,
          participantName: msg.participantName,
          debateRole: msg.debateRole,
        }));
        
        if (messages.length > 0) {
          await messageService.saveMessages(userId, debateChatId, messages);
          console.log('✅ [Debate] Final messages saved');
        }

        // Save final cost and tokens
        if (totalCost > 0 || totalTokens > 0) {
          await chatService.updateChat(userId, debateChatId, {
            totalCost,
            totalTokens,
          });
          console.log('✅ [Debate] Final costs saved');
        }
      } catch (error) {
        console.error('❌ [Debate] Error saving final state:', error);
      }
    }

    // Clear debate state
    setDebateActive(false);
    setDebateSession(null);
    setDebateMessages([]);
    setDebateChatId(null);
    setTotalCost(0);
    setTotalTokens(0);
    setExchangesStarted(false);
    setIsDebateLoading(false);
    isProcessingTurnRef.current = false;
  }, [userId, debateChatId, totalCost, totalTokens]);

  const pauseDebate = useCallback(() => {
    if (debateSession) {
      const newPausedState = !debateSession.isPaused;
      
      console.log(`⏸️ [Debate] ${newPausedState ? 'Pausing' : 'Resuming'} debate`);
      
      setDebateSession({
        ...debateSession,
        isPaused: newPausedState,
      });
      
      // When resuming, the useEffect will automatically trigger the next turn
      if (!newPausedState) {
        console.log('▶️ [Debate] Resumed - useEffect will trigger next turn');
      }
    }
  }, [debateSession]);

  const selectDebatePoint = useCallback(async (pointIndex: number) => {
    if (!debateSession || !userId || !debateChatId) {
      return;
    }

    const selectedPoint = debateSession.config.points[pointIndex];

    // Check if this point was already selected (prevent duplicate messages)
    const lastMessage = messagesRef.current[messagesRef.current.length - 1];
    if (lastMessage?.content.includes(selectedPoint) && 
        lastMessage.debateRole === 'moderator' &&
        Date.now() - lastMessage.createdAt.getTime() < 2000) {
      console.log('🚫 [Debate] Point already selected recently, skipping duplicate');
      return;
    }

    // Add system message from moderator (similar to moderator intervention)
    const systemMessage: DebateMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: `## MENSAGEM DO SISTEMA:\n\nA pauta em discussão foi atualizada para: **${selectedPoint}**`,
      createdAt: new Date(),
      participantName: debateSession.config.moderatorName,
      debateRole: 'moderator',
    };

    // Update messages state
    setDebateMessages(prev => {
      const updated = [...prev, systemMessage];
      
      // Update ref immediately
      messagesRef.current = updated;
      
      // Save to Firestore/Storage immediately
      (async () => {
        try {
          const messages = updated.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt,
            participantName: msg.participantName,
            debateRole: msg.debateRole,
          }));
          
          await messageService.saveMessages(userId, debateChatId, messages);
          console.log('✅ [Debate] Point selection message saved');
        } catch (error) {
          console.error('❌ [Debate] Error saving point selection:', error);
        }
      })();
      
      return updated;
    });
  }, [debateSession, userId, debateChatId]);

  const addDebatePoint = useCallback(async (point: string) => {
    if (!debateSession || !userId || !debateChatId) {
      return;
    }

    console.log('➕ [Debate] Adding new point:', { point, chatId: debateChatId });

    // Add point to config
    const updatedConfig = {
      ...debateSession.config,
      points: [...debateSession.config.points, point],
    };

    // Update session state
    setDebateSession({
      ...debateSession,
      config: updatedConfig,
    });

    // Save updated config to Firestore
    try {
      await chatService.updateChat(userId, debateChatId, {
        debateConfig: updatedConfig,
      });
      console.log('✅ [Debate] Config updated in Firestore with new point');
    } catch (error) {
      console.error('❌ [Debate] Error updating config in Firestore:', error);
    }

    // Add system message
    const systemMessage: DebateMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content: `## MENSAGEM DO SISTEMA:\n\nA pauta em discussão foi atualizada para: **${point}**.\n\nAgora, todos os participantes devem direcionar suas falas e contribuições conforme esta nova pauta.\nPor favor, mantenham o foco no tema proposto para garantir um debate organizado e produtivo.`,
      createdAt: new Date(),
      debateRole: undefined,
      participantName: 'Sistema',
    };

    // Update messages state
    setDebateMessages(prev => {
      const updated = [...prev, systemMessage];
      
      // Update ref immediately
      messagesRef.current = updated;
      
      // Save to Firestore/Storage immediately
      (async () => {
        try {
          const messages = updated.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt,
            participantName: msg.participantName,
            debateRole: msg.debateRole,
          }));
          
          await messageService.saveMessages(userId, debateChatId, messages);
          console.log('✅ [Debate] Point addition message saved');
        } catch (error) {
          console.error('❌ [Debate] Error saving point addition:', error);
        }
      })();
      
      return updated;
    });
  }, [debateSession, userId, debateChatId]);

  const processTurn = useCallback(async (participant: 1 | 2): Promise<void> => {
    // Use refs to get latest values
    const currentSession = debateSessionRef.current;
    const currentChatId = debateChatIdRef.current;
    
    if (!userId || !currentSession || !currentChatId || isProcessingTurnRef.current) {
      return;
    }

    isProcessingTurnRef.current = true;
    setIsDebateLoading(true);
    setDebateSession(prev => prev ? { ...prev, currentTurn: participant === 1 ? 'participant1' : 'participant2' } : null);

    // Create placeholder message
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const participantName = participant === 1 
      ? currentSession.config.participant1.name 
      : currentSession.config.participant2.name;

    // Alternate roles to satisfy LLM requirements (no two 'assistant' in a row)
    // Participant 1 = 'user', Participant 2 = 'assistant'
    const placeholderMessage: DebateMessage = {
      id: messageId,
      role: participant === 1 ? 'user' : 'assistant',
      content: '',
      createdAt: new Date(),
      isStreaming: true,
      participantName,
      debateRole: participant === 1 ? 'participant1' : 'participant2',
    };

    setDebateMessages(prev => [...prev, placeholderMessage]);

    let fullContent = '';
    let messageCost = 0;
    let messageTokens = 0;

    // Return a promise that resolves when the turn is complete
    return new Promise<void>((resolve, reject) => {
      const currentMessages = messagesRef.current;
      
      processDebateTurn({
        userId,
        config: currentSession.config,
        conversationHistory: currentMessages,
        currentParticipant: participant,
        onChunk: (chunk) => {
          fullContent += chunk;
          setDebateMessages(prev =>
            prev.map(msg =>
              msg.id === messageId
                ? { ...msg, content: fullContent }
                : msg
            )
          );
        },
        onUsage: (data) => {
          // Track cost and tokens
          messageCost += data.cost;
          messageTokens += data.tokens;
          
          setTotalCost(prev => prev + data.cost);
          setTotalTokens(prev => prev + data.tokens);
        },
        onComplete: () => {
          // Update messages state and wait for it to propagate
          setDebateMessages(prev => {
            const updated = prev.map(msg =>
              msg.id === messageId
                ? { ...msg, isStreaming: false }
                : msg
            );
            
            // Update ref immediately so next turn sees this message
            messagesRef.current = updated;
            return updated;
          });
          
          // Save message to chat (non-blocking)
          (async () => {
            try {
              // Get the latest messages from ref
              const latestMessages = messagesRef.current;
              
              console.log('🎭 [Debate] Saving messages to storage:', {
                chatId: currentChatId,
                messageCount: latestMessages.length,
                lastMessage: latestMessages[latestMessages.length - 1]?.id,
              });
              
              // Save without participant name prefix (DebateInterface will show it)
              const messages = latestMessages.map(msg => ({
                id: msg.id,
                role: msg.role,
                content: msg.content, // Don't include participant name
                createdAt: msg.createdAt,
                participantName: msg.participantName,
                debateRole: msg.debateRole,
              }));
              
              await messageService.saveMessages(userId, currentChatId, messages);
              console.log('✅ [Debate] Messages saved successfully');
              
              // Update chat costs
              const newTotalCost = totalCost + messageCost;
              const newTotalTokens = totalTokens + messageTokens;
              
              await chatService.updateChat(userId, currentChatId, {
                totalCost: newTotalCost,
                totalTokens: newTotalTokens,
                lastMessage: `${participantName}: ${fullContent.substring(0, 100)}...`,
              });
              console.log('✅ [Debate] Chat updated with costs');
            } catch (error) {
              console.error('❌ [Debate] Error saving messages:', error);
              console.error('Details:', {
                userId,
                chatId: currentChatId,
                messageCount: messagesRef.current.length,
              });
            }
          })();
          
          setIsDebateLoading(false);
          isProcessingTurnRef.current = false;
          setDebateSession(prev => prev ? { ...prev, currentTurn: null } : null);
          
          resolve();
        },
        onError: (error) => {
          alert(`Erro ao processar turno: ${error.message}`);
          setIsDebateLoading(false);
          isProcessingTurnRef.current = false;
          setDebateSession(prev => prev ? { ...prev, currentTurn: null } : null);
          reject(error);
        },
      }).catch((error) => {
        setIsDebateLoading(false);
        isProcessingTurnRef.current = false;
        setDebateSession(prev => prev ? { ...prev, currentTurn: null } : null);
        reject(error);
      });
    });
  }, [userId, totalCost, totalTokens]);

  const startInitialPresentations = useCallback(async () => {
    setDebateSession(prev => {
      if (!prev) return null;
      return { ...prev, hasStarted: true };
    });

    // Small delay to ensure state update
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      await processTurn(1);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await processTurn(2);
    } catch (error) {
      throw error;
    }
  }, [processTurn]);

  const startDebateExchanges = useCallback(async (firstParticipant: 1 | 2) => {
    setExchangesStarted(true);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Process first turn
    await processTurn(firstParticipant);
  }, [processTurn]);

  const moderatorIntervention = useCallback((message: string, nextParticipant: 1 | 2) => {
    if (!debateSession) return;

    // Format moderator intervention message
    const formattedContent = `## Intervenção do Moderador\n\nO moderador disse: "${message}"\nPor favor, considerem e sigam as orientações apresentadas, ajustando seus argumentos e falas conforme a direção indicada.\nEssa intervenção tem como objetivo manter o foco, a clareza e o bom andamento do debate.`;

    const moderatorMessage: DebateMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: formattedContent,
      createdAt: new Date(),
      participantName: debateSession.config.moderatorName,
      debateRole: 'moderator',
    };

    setDebateMessages(prev => [...prev, moderatorMessage]);

    // Process the next participant's response
    setTimeout(() => {
      processTurn(nextParticipant);
    }, 500);
  }, [debateSession, processTurn]);

  const continueDebate = useCallback(async () => {
    if (!debateSession || debateSession.isPaused || !debateSession.hasStarted) return;

    // Alternate turns automatically - use ref for latest messages
    const currentMessages = messagesRef.current;
    const lastMessage = currentMessages[currentMessages.length - 1];
    if (!lastMessage || lastMessage.isStreaming) return;

    let nextParticipant: 1 | 2;
    
    if (lastMessage.debateRole === 'participant1') {
      nextParticipant = 2;
    } else if (lastMessage.debateRole === 'participant2') {
      nextParticipant = 1;
    } else {
      // If last was moderator, continue with participant 1 by default
      nextParticipant = 1;
    }

    await processTurn(nextParticipant);
  }, [debateSession, processTurn]);

  useEffect(() => {
    if (!debateActive || !exchangesStarted || debateSession?.isPaused || isDebateLoading) {
      return;
    }

    const lastMessage = debateMessages[debateMessages.length - 1];
    
    if (!lastMessage || lastMessage.isStreaming || isProcessingTurnRef.current) {
      return;
    }

    // If no debate role (shouldn't happen) or currently processing, skip
    if (!lastMessage.debateRole) {
      return;
    }

    let nextParticipant: 1 | 2;
    
    // Determine next participant based on last message
    if (lastMessage.debateRole === 'participant1') {
      nextParticipant = 2;
    } else if (lastMessage.debateRole === 'participant2') {
      nextParticipant = 1;
    } else if (lastMessage.debateRole === 'moderator') {
      // If moderator spoke (point change or intervention), start with participant 1
      nextParticipant = 1;
      console.log('🔄 [Debate] Moderator message detected, next turn: Participant 1');
    } else {
      return;
    }
    
    const timer = setTimeout(() => {
      processTurn(nextParticipant);
    }, 1500);

    return () => clearTimeout(timer);
  }, [debateActive, exchangesStarted, debateSession, debateMessages, isDebateLoading, processTurn]);

  const deleteDebateMessage = useCallback(async (messageId: string) => {
    if (!userId || !debateChatId) {
      console.error('❌ [Debate] Cannot delete message: missing userId or chatId');
      return;
    }

    try {
      console.log('🗑️ [Debate] Deleting message:', { messageId, chatId: debateChatId });

      // Remove message from state
      setDebateMessages(prev => {
        const updated = prev.filter(msg => msg.id !== messageId);
        messagesRef.current = updated;
        return updated;
      });

      // Save updated messages to storage
      const updatedMessages = messagesRef.current.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
        participantName: msg.participantName,
        debateRole: msg.debateRole,
      }));

      await messageService.saveMessages(userId, debateChatId, updatedMessages);
      console.log('✅ [Debate] Message deleted successfully');
    } catch (error) {
      console.error('❌ [Debate] Error deleting message:', error);
      alert('Erro ao deletar mensagem. Tente novamente.');
    }
  }, [userId, debateChatId]);

  const loadDebateMessages = useCallback((messages: DebateMessage[]) => {
    setDebateMessages(messages);
    messagesRef.current = messages;
  }, []);

  const restoreDebate = useCallback(async (chatId: string, config: DebateConfig, messages: DebateMessage[], existingCost?: number, existingTokens?: number) => {

    const session: DebateSession = {
      id: chatId,
      config,
      messages: [],
      currentTurn: null,
      isActive: true,
      isPaused: true, // Restored debates start paused
      hasStarted: true, // Debate has already started
      createdAt: new Date(),
      systemPromptTemplate: '',
    };

    setDebateSession(session);
    setDebateMessages(messages);
    setDebateActive(true);
    setDebateChatId(chatId);
    setExchangesStarted(true); // Debate was already in progress
    setTotalCost(existingCost || 0);
    setTotalTokens(existingTokens || 0);
    
    // Update refs immediately
    debateSessionRef.current = session;
    debateChatIdRef.current = chatId;
    messagesRef.current = messages;
  }, []);

  return {
    debateActive,
    debateSession,
    debateMessages,
    isDebateLoading,
    totalCost,
    totalTokens,
    debateChatId,
    startDebate,
    stopDebate,
    pauseDebate,
    addDebatePoint,
    selectDebatePoint,
    startInitialPresentations,
    startDebateExchanges,
    moderatorIntervention,
    continueDebate,
    loadDebateMessages,
    restoreDebate,
    deleteDebateMessage,
  };
}
