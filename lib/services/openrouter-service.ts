/**
 * OpenRouter API Service
 * Fetches available AI models from OpenRouter
 * Uses IndexedDB cache for improved performance
 */

import { fetchModelsWithCache, invalidateModelsCache as invalidateCache } from '@/lib/db/models-cache';

export interface OpenRouterModel {
  id: string;
  name: string;
  canonical_slug?: string | null;
  created: number;
  description: string;
  context_length: number | null;
  architecture: {
    input_modalities: string[];
    output_modalities: string[];
    tokenizer: string;
    instruct_type: string | null;
  };
  pricing: {
    prompt: string;
    completion: string;
    image: string;
    request: string;
    input_cache_read?: string | null;
    input_cache_write?: string | null;
    web_search: string;
    internal_reasoning: string;
  };
  top_provider: {
    context_length: number | null;
    max_completion_tokens: number | null;
    is_moderated: boolean;
  };
  supported_parameters: string[];
}

export interface ModelsResponse {
  data: OpenRouterModel[];
}

/**
 * Fetch all available models from OpenRouter (raw API call)
 */
async function fetchModelsFromAPI(): Promise<OpenRouterModel[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    console.log('[OpenRouter] Iniciando requisição para /api/v1/models');
    const startTime = performance.now();
    
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    const endTime = performance.now();
    console.log(`[OpenRouter] Resposta recebida em ${(endTime - startTime).toFixed(2)}ms - Status: ${response.status}`);
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[OpenRouter] Erro HTTP ${response.status}: ${response.statusText}`);
      const errorText = await response.text();
      console.error('[OpenRouter] Corpo da resposta:', errorText);
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data: ModelsResponse = await response.json();
    console.log(`[OpenRouter] ${data.data.length} modelos carregados com sucesso`);
    return data.data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[OpenRouter] Erro na requisição:', error);
    if ((error as Error).name === 'AbortError') {
      throw new Error('Request timeout: Failed to fetch models from OpenRouter');
    }
    throw error;
  }
}

/**
 * Fetch all available models from OpenRouter
 * Uses IndexedDB cache for instant loading
 * @param skipCache - If true, always fetch from API and update cache
 */
export async function fetchAvailableModels(skipCache = false): Promise<OpenRouterModel[]> {
  try {
    const { models } = await fetchModelsWithCache(fetchModelsFromAPI, skipCache);
    return models;
  } catch (error) {
    throw error;
  }
}

/**
 * Invalidate models cache (force refresh on next request)
 */
export async function invalidateModelsCache(): Promise<void> {
  await invalidateCache();
}

/**
 * Parse pricing string to number (handles scientific notation)
 */
export const DEFAULT_PRICE_PER_MILLION = 0.6;

/**
 * Parse pricing string (per token) to value per million tokens.
 * Returns null when the pricing is invalid or negative.
 */
export function parsePricing(priceString: string | undefined | null): number | null {
  if (!priceString) return null;
  const numeric = Number(priceString);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return numeric * 1_000_000;
}

/**
 * Format pricing for display (per million tokens) with graceful fallbacks.
 */
export function formatPricing(priceString: string | undefined | null): string {
  const pricePerMillion = parsePricing(priceString) ?? DEFAULT_PRICE_PER_MILLION;

  if (pricePerMillion === 0) return 'Free';
  if (pricePerMillion < 1) return `$${pricePerMillion.toFixed(3)}/M`;
  return `$${pricePerMillion.toFixed(2)}/M`;
}

/**
 * Check if model has specific capability
 */
export function hasCapability(model: OpenRouterModel, capability: string): boolean {
  return (
    model.architecture.input_modalities.includes(capability) ||
    model.architecture.output_modalities.includes(capability)
  );
}

/**
 * Get model provider name from ID
 */
export function getProviderName(modelId: string): string {
  const provider = modelId.split('/')[0];
  const providerMap: Record<string, string> = {
    'openai': 'OpenAI',
    'anthropic': 'Anthropic',
    'google': 'Google',
    'meta-llama': 'Meta',
    'mistralai': 'Mistral AI',
    'cohere': 'Cohere',
    'deepseek': 'DeepSeek',
    'x-ai': 'xAI',
    'perplexity': 'Perplexity',
    'qwen': 'Qwen',
  };
  
  return providerMap[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

/**
 * Get model short name (without provider prefix)
 */
export function getModelShortName(modelId: string): string {
  return modelId.split('/')[1] || modelId;
}

/**
 * Get model full name by ID (async - fetches from API if not cached)
 */
let modelsCache: OpenRouterModel[] | null = null;

export async function getModelName(modelId: string): Promise<string> {
  try {
    // Use cache if available
    if (!modelsCache) {
      modelsCache = await fetchAvailableModels();
    }
    
    const model = modelsCache.find(m => m.id === modelId);
    return model?.name || getModelShortName(modelId);
  } catch {
    return getModelShortName(modelId);
  }
}

/**
 * OpenRouter Credits Response Interface
 */
export interface OpenRouterCreditsResponse {
  success: boolean;
  total_credits: number;
  total_usage: number;
  balance: number;
}

/**
 * Fetch OpenRouter credits balance
 * Calls the Firebase Cloud Function
 */
export async function fetchOpenRouterCredits(): Promise<number> {
  try {
    const { functions } = await import('@/lib/firebase');
    const { httpsCallable } = await import('firebase/functions');
    
    const openRouterCreditsFunction = httpsCallable<void, OpenRouterCreditsResponse>(
      functions,
      'openRouterCredits'
    );
    
    const result = await openRouterCreditsFunction();
    
    if (result.data.success) {
      return result.data.balance;
    }
    
    throw new Error('Failed to fetch credits');
  } catch (error) {
    throw error;
  }
}

/**
 * Fetch models that support audio input
 * Filters models by input_modalities containing "audio"
 */
export async function getAudioSupportedModels(): Promise<OpenRouterModel[]> {
  try {
    const allModels = await fetchAvailableModels();
    
    // Filter models that have "audio" in input_modalities
    const audioModels = allModels.filter(model => 
      model.architecture?.input_modalities?.includes('audio')
    );
    
    return audioModels;
  } catch (error) {
    throw error;
  }
}
