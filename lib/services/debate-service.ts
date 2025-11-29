/**
 * Service for managing debate mode functionality
 */

import { DebateConfig, DebateMessage } from '@/types/chat';

export interface DebateTurnParams {
  userId: string;
  config: DebateConfig;
  conversationHistory: DebateMessage[];
  currentParticipant: 1 | 2;
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  onUsage?: (data: { cost: number; tokens: number }) => void;
}

/**
 * Process a debate turn by calling the backend function
 */
export async function processDebateTurn(params: DebateTurnParams): Promise<void> {
  const {
    userId,
    config,
    conversationHistory,
    currentParticipant,
    onChunk,
    onComplete,
    onError,
    onUsage,
  } = params;

  const functionUrl = process.env.NEXT_PUBLIC_DEBATE_FUNCTION_URL;

  if (!functionUrl) {
    onError(new Error('NEXT_PUBLIC_DEBATE_FUNCTION_URL não configurada'));
    return;
  }

  const requestBody = JSON.stringify({
    userId,
    config,
    conversationHistory,
    currentParticipant,
  });

  try {

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    // Check for HTTP errors
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

    // Read stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body não disponível');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode chunk
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        while (true) {
          const lineEnd = buffer.indexOf('\n');
          if (lineEnd === -1) break;

          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);

          // Ignore empty lines
          if (!line) continue;

          // Process SSE data line
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            // Check for stream end
            if (data === '[DONE]') {
              onComplete();
              return;
            }

            try {
              const parsed = JSON.parse(data);

              // Check for error during streaming
              if (parsed.error) {
                throw new Error(parsed.error.message);
              }

              // Process content
              if (parsed.content) {
                onChunk(parsed.content);
              }

              // Process usage data (cost and tokens)
              if (parsed.usage && onUsage) {
                onUsage({
                  cost: parsed.usage.cost || 0,
                  tokens: parsed.usage.tokens || 0,
                });
              }

            } catch {
              // Silent parsing error
            }
          }
        }
      }

      // If we got here without [DONE], consider it complete
      onComplete();

    } finally {
      reader.cancel().catch(() => {
        // Ignore cancel errors
      });
    }

  } catch (error) {
    onError(error instanceof Error ? error : new Error('Erro desconhecido'));
  }
}
