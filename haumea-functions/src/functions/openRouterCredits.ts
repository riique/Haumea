import { onCall } from 'firebase-functions/v2/https';
import { UnauthorizedError, APIError } from '../utils/errors';
import { logger } from '../utils/logger';
import { getUserApiKey } from '../utils/apiKeyManager';

interface OpenRouterCreditsResponse {
  data: {
    total_credits: number;
    total_usage: number;
  };
}

/**
 * Busca o saldo de créditos do OpenRouter
 * Retorna: total_credits - total_usage
 */
export const openRouterCredits = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
  if (!request.auth) {
    throw new UnauthorizedError();
  }
  
  const userId = request.auth.uid;
  
  try {
    logger.info('Fetching OpenRouter credits', { userId });
    
    // Buscar e descriptografar API Key do usuário
    const apiKey = await getUserApiKey(userId);
    
    if (!apiKey) {
      logger.warn('No OpenRouter API Key found', { userId });
      throw new APIError('Nenhuma API Key do OpenRouter configurada. Configure nas configurações.', 'OpenRouter');
    }
    
    // Fazer requisição para OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/credits', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://haumea.fun',
        'X-Title': 'Haumea',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenRouter API error', new Error(errorText), {
        userId,
        status: response.status,
      });
      throw new APIError(
        `Falha ao buscar créditos: ${response.status}`,
        'OpenRouter'
      );
    }
    
    const data: OpenRouterCreditsResponse = await response.json();
    
    // Calcular saldo disponível
    const balance = data.data.total_credits - data.data.total_usage;
    
    logger.info('OpenRouter credits fetched successfully', {
      userId,
      total_credits: data.data.total_credits,
      total_usage: data.data.total_usage,
      balance,
    });
    
    return {
      success: true,
      total_credits: data.data.total_credits,
      total_usage: data.data.total_usage,
      balance,
    };
    
  } catch (error) {
    logger.error('Failed to fetch OpenRouter credits', error, { userId });
    
    if (error instanceof APIError || error instanceof UnauthorizedError) {
      throw error;
    }
    
    throw new APIError(
      'Erro ao buscar créditos do OpenRouter',
      'OpenRouter'
    );
  }
  }
);
