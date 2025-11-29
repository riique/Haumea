/**
 * Model Reasoning Utilities
 * 
 * Utilities to detect and configure reasoning/deep thinking for different AI models
 */

import type { OpenRouterModel } from '@/lib/services/openrouter-service';

// Cache para armazenar modelos com reasoning nativo
let nativeReasoningModelsCache: Set<string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hora

/**
 * Check if a model has native reasoning based on OpenRouter API data
 * This checks the model's pricing for internal_reasoning costs
 */
export function hasNativeReasoningFromAPI(model: OpenRouterModel): boolean {
  // Se o modelo cobra por internal_reasoning tokens, ele tem reasoning nativo
  if (model.pricing?.internal_reasoning && parseFloat(model.pricing.internal_reasoning) > 0) {
    return true;
  }
  
  // Verificar se 'reasoning' está nos supported_parameters
  if (model.supported_parameters?.includes('reasoning')) {
    return true;
  }
  
  return false;
}

/**
 * Update the native reasoning models cache with fresh data from API
 */
export function updateNativeReasoningCache(models: OpenRouterModel[]): void {
  nativeReasoningModelsCache = new Set();
  
  models.forEach(model => {
    if (hasNativeReasoningFromAPI(model)) {
      nativeReasoningModelsCache!.add(model.id.toLowerCase());
    }
  });
  
  cacheTimestamp = Date.now();
}

/**
 * Get cached native reasoning status for a model ID
 */
function getCachedNativeReasoning(modelId: string): boolean | null {
  // Se o cache expirou ou não existe, retorna null
  if (!nativeReasoningModelsCache || Date.now() - cacheTimestamp > CACHE_TTL) {
    return null;
  }
  
  return nativeReasoningModelsCache.has(modelId.toLowerCase());
}

/**
 * Debug function to list all models with native reasoning
 * Usage: console.log(listNativeReasoningModels())
 */
export function listNativeReasoningModels(): string[] {
  if (!nativeReasoningModelsCache) {
    return [];
  }
  
  return Array.from(nativeReasoningModelsCache);
}

/**
 * Get cache status and information
 */
export function getReasoningCacheInfo(): { 
  isValid: boolean; 
  modelCount: number; 
  age: number;
  expiresIn: number;
} {
  const age = Date.now() - cacheTimestamp;
  const isValid = nativeReasoningModelsCache !== null && age < CACHE_TTL;
  
  return {
    isValid,
    modelCount: nativeReasoningModelsCache?.size || 0,
    age,
    expiresIn: Math.max(0, CACHE_TTL - age),
  };
}

/**
 * Check if a model has native reasoning that does NOT return reasoning tokens
 * According to OpenRouter docs: "Some reasoning models do not return their reasoning tokens"
 * These models include:
 * - OpenAI o-series (o1, o3)
 * - Gemini Flash Thinking
 * 
 * For these models, reasoning is always active but tokens are not returned.
 * Other reasoning models (like DeepSeek R1, Claude, etc.) DO return reasoning tokens.
 */
export function hasNonReturnableReasoning(modelId: string): boolean {
  const lowerModelId = modelId.toLowerCase();
  
  // OpenAI o-series models (o1, o3, GPT-5) - do not return reasoning tokens
  if (lowerModelId.includes('/o1') || lowerModelId.includes('/o3') || lowerModelId.includes('/gpt-5')) {
    return true;
  }
  
  // Gemini Flash Thinking - does not return reasoning tokens
  if (lowerModelId.includes('gemini') && lowerModelId.includes('thinking')) {
    return true;
  }
  
  return false;
}

/**
 * Check if a model has native reasoning that is ALWAYS active
 * These models always use reasoning by default (unlike opt-in models)
 * 
 * This function uses a hybrid approach:
 * 1. First checks the cached API data (if available)
 * 2. Falls back to hardcoded model names if cache is not available
 */
export function hasNativeReasoning(modelId: string): boolean {
  const lowerModelId = modelId.toLowerCase();
  
  // Try to get from cache first
  const cachedResult = getCachedNativeReasoning(lowerModelId);
  if (cachedResult !== null) {
    return cachedResult;
  }
  
  // Fallback to hardcoded detection if cache not available
  // OpenAI o-series (o1, o3, GPT-5) - always use reasoning
  if (lowerModelId.includes('/o1') || lowerModelId.includes('/o3') || lowerModelId.includes('/gpt-5')) {
    return true;
  }
  
  // Gemini 2.5 Pro ONLY (not Flash or Flash Lite) - always uses reasoning
  // Flash and Flash Lite can have reasoning disabled
  if ((lowerModelId.includes('gemini-2.5-pro') || lowerModelId.includes('gemini-2.5-pro-exp')) 
      && !lowerModelId.includes('flash')) {
    return true;
  }
  
  // Gemini Thinking models - always use reasoning
  if (lowerModelId.includes('gemini') && lowerModelId.includes('thinking')) {
    return true;
  }
  
  // DeepSeek R1 - always uses reasoning
  if (lowerModelId.includes('deepseek') && lowerModelId.includes('r1')) {
    return true;
  }
  
  return false;
}

/**
 * Check if a model supports reasoning (with returnable tokens)
 * These models can use reasoning and return the reasoning tokens in the response
 */
export function supportsReasoning(modelId: string): boolean {
  const lowerModelId = modelId.toLowerCase();
  
  // DeepSeek R1 supports reasoning with returnable tokens
  if (lowerModelId.includes('deepseek') && lowerModelId.includes('r1')) {
    return true;
  }
  
  // OpenAI reasoning models (but don't return tokens)
  if (lowerModelId.includes('/o1') || lowerModelId.includes('/o3') || lowerModelId.includes('/gpt-5')) {
    return true;
  }
  
  // Grok models support reasoning
  if (lowerModelId.includes('grok')) {
    return true;
  }
  
  // Gemini thinking models
  if (lowerModelId.includes('gemini') && lowerModelId.includes('thinking')) {
    return true;
  }
  
  // Anthropic Claude reasoning models
  if (lowerModelId.includes('anthropic') || lowerModelId.includes('claude')) {
    return true;
  }
  
  // Google Gemini models (support reasoning via max_tokens)
  if (lowerModelId.includes('google') || lowerModelId.includes('gemini')) {
    return true;
  }
  
  // Qwen models
  if (lowerModelId.includes('qwen')) {
    return true;
  }
  
  return false;
}

/**
 * Check if a model uses max_tokens for reasoning configuration
 * (instead of effort levels)
 */
export function usesMaxTokensForReasoning(modelId: string): boolean {
  const provider = modelId.split('/')[0].toLowerCase();
  
  // Google Gemini models use max_tokens
  if (provider === 'google') {
    return true;
  }
  
  // Anthropic Claude models use max_tokens
  if (provider === 'anthropic') {
    return true;
  }
  
  // Some Alibaba Qwen models use max_tokens
  if (provider === 'qwen') {
    return true;
  }
  
  return false;
}

/**
 * Check if a model uses effort levels for reasoning configuration
 */
export function usesEffortForReasoning(modelId: string): boolean {
  const provider = modelId.split('/')[0].toLowerCase();
  
  // OpenAI models use effort levels
  if (provider === 'openai') {
    return true;
  }
  
  // Default to effort if not using max_tokens
  return !usesMaxTokensForReasoning(modelId);
}

/**
 * Get default max_tokens value based on model provider
 */
export function getDefaultMaxTokens(modelId: string): number {
  const provider = modelId.split('/')[0].toLowerCase();
  
  // Default values per provider
  if (provider === 'google') {
    return 8000;
  }
  
  if (provider === 'anthropic') {
    return 4000;
  }
  
  if (provider === 'qwen') {
    return 6000;
  }
  
  // Fallback default
  return 8000;
}

/**
 * Get min/max bounds for max_tokens slider
 */
export function getMaxTokensBounds(modelId: string): { min: number; max: number } {
  const provider = modelId.split('/')[0].toLowerCase();
  
  if (provider === 'google') {
    return { min: 1000, max: 32000 };
  }
  
  if (provider === 'anthropic') {
    return { min: 1000, max: 16000 };
  }
  
  if (provider === 'qwen') {
    return { min: 1000, max: 16000 };
  }
  
  // Fallback
  return { min: 1000, max: 32000 };
}

/**
 * Get reasoning configuration type for a model
 * All models can be configured with reasoning, just using different parameters
 */
export type ReasoningConfigType = 'effort' | 'max_tokens';

export function getReasoningConfigType(modelId: string): ReasoningConfigType {
  if (usesMaxTokensForReasoning(modelId)) {
    return 'max_tokens';
  }
  
  return 'effort';
}
