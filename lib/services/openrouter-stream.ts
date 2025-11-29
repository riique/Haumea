/**
 * Cliente para fazer streaming de mensagens do OpenRouter via Firebase Functions
 */

import { Attachment, PDFEngine, ReasoningConfig, WebSearchConfig, Memory, AIPersonality, PersonaConfig } from '@/types/chat';
import { logger } from '@/lib/utils/logger';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
}

export interface UsageData {
  cost: number; // Cost in credits/dollars
  tokens: number; // Total tokens
  promptTokens: number; // Input tokens
  completionTokens: number; // Output tokens
  reasoningTokens?: number; // Reasoning tokens (thinking)
  cachedTokens?: number; // Cached tokens
  upstreamCost?: number; // Upstream cost (BYOK)
  apiKeyName?: string; // Name of the API Key used
  // Legacy fields for backward compatibility
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
    audio_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
  cost_details?: {
    upstream_inference_cost?: number;
  };
}

export interface GeneratedImage {
  type: 'image_url';
  image_url: {
    url: string; // Base64 data URL
  };
}

export interface StreamChatParams {
  chatId: string;
  message: string;
  userId: string;
  userName?: string; // User's display name
  userNickname?: string; // User's preferred nickname for AI to use
  userAbout?: string; // Additional information about the user
  apiKey: string;
  model?: string;
  conversationHistory?: ConversationMessage[]; // Previous messages for context
  attachments?: Attachment[];
  pdfEngine?: PDFEngine;
  reasoning?: ReasoningConfig;
  webSearch?: WebSearchConfig;
  guidedStudy?: boolean;
  globalMemories?: Memory[]; // User's global memories
  chatMemories?: Memory[]; // Chat-specific memories
  aiPersonalities?: AIPersonality[]; // User's custom AI personalities
  personaConfig?: PersonaConfig; // Persona configuration (complete identity replacement)
  generateImages?: boolean; // Enable image generation if model supports it
  isFirstMessage?: boolean; // If true, this is the first message of the chat
  isAutoCreatedChat?: boolean; // If true, chat was created automatically (not via modal)
  // Chat generation settings
  temperature?: number; // Model temperature (0.0-2.0)
  maxTokens?: number; // Max tokens for response
  frequencyPenalty?: number; // Frequency penalty (-2.0 to 2.0)
  repetitionPenalty?: number; // Repetition penalty (0.0 to 2.0)
  onChunk: (chunk: string) => void;
  onReasoning?: (reasoning: string) => void; // Callback for reasoning tokens
  onImages?: (images: GeneratedImage[]) => void; // Callback for generated images
  onChatNameUpdate?: (chatName: string, cleanedResponse: string) => void; // Callback for auto-naming
  onAnnotations?: (annotations: Array<{ type?: string; url_citation?: {
    title?: string;
    url?: string;
    content?: string;
    start_index?: number;
    end_index?: number;
  } }>) => void; // Callback for web search citations
  onUsage?: (usage: UsageData) => void; // Callback for usage data (cost, tokens)
  onComplete: () => void;
  onError: (error: Error) => void;
}

interface StreamResponse {
  content?: string;
  reasoning?: string; // Reasoning tokens from OpenRouter
  images?: GeneratedImage[]; // Generated images from OpenRouter
  annotations?: Array<{ type?: string; url_citation?: {
    title?: string;
    url?: string;
    content?: string;
    start_index?: number;
    end_index?: number;
  } }>; // Web search citations from OpenRouter
  usage?: UsageData; // Usage data (cost, tokens)
  finish_reason?: string | null;
  chatName?: string; // Auto-generated chat name
  cleanedResponse?: string; // Response with name tags removed
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Helper function to create a fetch request with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Tempo limite de conexão excedido. Tente novamente.');
    }
    throw error;
  }
}

/**
 * Helper function to check if an error is retryable
 */
function isRetryableError(error: Error): boolean {
  const retryableErrors = [
    'Failed to fetch',
    'NetworkError',
    'Network request failed',
    'ERR_CONNECTION_CLOSED',
    'ERR_CONNECTION_RESET',
    'ERR_NETWORK',
    'ECONNRESET',
    'ETIMEDOUT',
  ];
  
  return retryableErrors.some(msg => 
    error.message.includes(msg) || error.name.includes(msg)
  );
}

/**
 * Helper function to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function streamChat(params: StreamChatParams): Promise<void> {
  const {
    chatId,
    message,
    userId,
    userName,
    userNickname,
    userAbout,
    apiKey,
    model = 'google/gemini-2.5-flash',
    conversationHistory,
    attachments,
    pdfEngine,
    reasoning,
    webSearch,
    guidedStudy,
    globalMemories,
    chatMemories,
    aiPersonalities,
    personaConfig,
    generateImages,
    isFirstMessage,
    isAutoCreatedChat,
    temperature,
    maxTokens,
    frequencyPenalty,
    repetitionPenalty,
    onChunk,
    onReasoning,
    onImages,
    onAnnotations,
    onUsage,
    onChatNameUpdate,
    onComplete,
    onError,
  } = params;

  const functionUrl = process.env.NEXT_PUBLIC_CHAT_FUNCTION_URL;

  if (!functionUrl) {
    onError(new Error('NEXT_PUBLIC_CHAT_FUNCTION_URL não configurada'));
    return;
  }

  const requestBody = JSON.stringify({
    chatId,
    message,
    userId,
    userName,
    userNickname,
    userAbout,
    apiKey,
    model,
    conversationHistory,
    attachments,
    pdfEngine,
    reasoning,
    webSearch,
    guidedStudy,
    globalMemories,
    chatMemories,
    aiPersonalities,
    personaConfig,
    generateImages,
    isFirstMessage,
    isAutoCreatedChat,
    temperature,
    maxTokens,
    frequencyPenalty,
    repetitionPenalty,
  });

  // Retry configuration
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second
  const requestTimeout = 600000; // 10 minutes (600 seconds) - Sem limite para conversas longas

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Fazer requisição com timeout
      const response = await fetchWithTimeout(
        functionUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: requestBody,
          // Keep connection alive for long requests
          keepalive: false, // Desabilitado para payloads grandes (>64KB limit no Chrome)
        },
        requestTimeout
      );

      // Verificar erro HTTP
      if (!response.ok) {
        let errorMessage = 'Erro desconhecido';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
        } catch {
          errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Ler stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body não disponível');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let hasReceivedData = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          hasReceivedData = true;

          // Decodificar chunk
          buffer += decoder.decode(value, { stream: true });

          // Processar linhas completas
          while (true) {
            const lineEnd = buffer.indexOf('\n');
            if (lineEnd === -1) break;

            const line = buffer.slice(0, lineEnd).trim();
            buffer = buffer.slice(lineEnd + 1);

            // Ignorar linhas vazias
            if (!line) continue;

            // Processar linha de dados SSE
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              // Verificar final do stream
              if (data === '[DONE]') {
                onComplete();
                return;
              }

              try {
                const parsed: StreamResponse = JSON.parse(data);

                // Verificar erro durante streaming
                if (parsed.error) {
                  throw new Error(parsed.error.message);
                }

                // Processar conteúdo
                if (parsed.content) {
                  onChunk(parsed.content);
                }

                // Processar reasoning tokens
                if (parsed.reasoning && onReasoning) {
                  onReasoning(parsed.reasoning);
                }

                // Processar imagens geradas
                if (parsed.images && onImages) {
                  onImages(parsed.images);
                }

                // Processar annotations (web search citations)
                if (parsed.annotations && onAnnotations) {
                  onAnnotations(parsed.annotations);
                }

                // Processar usage data (cost, tokens)
                if (parsed.usage && onUsage) {
                  onUsage(parsed.usage);
                }
                
                // Processar evento de nomeação automática
                if (parsed.finish_reason === 'chat_name_updated' && parsed.chatName && onChatNameUpdate) {
                  onChatNameUpdate(parsed.chatName, parsed.cleanedResponse || '');
                }

                // NÃO dar return aqui! O usage vem DEPOIS do finish_reason
                // Só terminar quando receber [DONE]

              } catch (parseError) {
                // Log para debug mas não quebra o stream
                // Isso pode acontecer com chunks parciais de JSON
                if (data.length > 100) {
                  logger.debug('Failed to parse SSE data chunk (truncated):', data.substring(0, 100) + '...', parseError);
                } else {
                  logger.debug('Failed to parse SSE data chunk:', data, parseError);
                }
              }
            }
          }
        }

        // Se chegou aqui e não recebeu [DONE], considera completo
        if (hasReceivedData) {
          onComplete();
          return;
        }

      } finally {
        reader.cancel().catch(() => {
          // Ignore cancel errors
        });
      }

      // Se chegou aqui sem erros, sucesso!
      return;

    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      const currentError = error instanceof Error ? error : new Error('Erro desconhecido');

      // Se é o último retry ou não é um erro recuperável, propaga o erro
      if (isLastAttempt || !isRetryableError(currentError)) {
        onError(currentError);
        return;
      }

      // Aguardar antes de tentar novamente (exponential backoff)
      const delayTime = baseDelay * Math.pow(2, attempt);
      await delay(delayTime);
    }
  }
}
