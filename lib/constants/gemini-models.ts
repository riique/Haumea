/**
 * Gemini Audio Transcription Models
 * 
 * Modelos do Google Gemini que suportam transcrição de áudio via API.
 * 
 * Documentação: https://ai.google.dev/gemini-api/docs/audio
 * Pricing: https://ai.google.dev/pricing
 */

export interface GeminiModel {
  id: string;
  name: string;
  description: string;
  rpm: number; // Requests per minute
  rpd: number; // Requests per day
  maxAudioDuration: number; // Em horas
  recommended?: boolean;
}

export const GEMINI_AUDIO_MODELS: readonly GeminiModel[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Modelo rápido e eficiente de última geração',
    rpm: 15,
    rpd: 1500,
    maxAudioDuration: 9.5,
    recommended: true,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Versão leve e ultra-rápida para transcrições simples',
    rpm: 20,
    rpd: 2000,
    maxAudioDuration: 9.5,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Modelo mais avançado com melhor qualidade e precisão',
    rpm: 2,
    rpd: 50,
    maxAudioDuration: 9.5,
  },
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash (Experimental)',
    description: 'Modelo experimental mais rápido e eficiente',
    rpm: 15,
    rpd: 1500,
    maxAudioDuration: 9.5,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Modelo rápido e econômico (geração anterior)',
    rpm: 15,
    rpd: 1500,
    maxAudioDuration: 9.5,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'Modelo avançado (geração anterior)',
    rpm: 2,
    rpd: 50,
    maxAudioDuration: 9.5,
  },
] as const;

/**
 * Verifica se um modelo é do Gemini
 */
export function isGeminiModel(modelId: string): boolean {
  return modelId.startsWith('gemini-');
}

/**
 * Busca informações de um modelo Gemini pelo ID
 */
export function getGeminiModelInfo(modelId: string): GeminiModel | undefined {
  return GEMINI_AUDIO_MODELS.find(m => m.id === modelId);
}

/**
 * Retorna o modelo Gemini recomendado para transcrição
 */
export function getRecommendedGeminiModel(): GeminiModel {
  return GEMINI_AUDIO_MODELS.find(m => m.recommended) || GEMINI_AUDIO_MODELS[0];
}
