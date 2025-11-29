/**
 * Anthropic Cache Control
 * Used for prompt caching with Anthropic models
 */
export interface CacheControl {
  type: 'ephemeral';
}

/**
 * OpenRouter Content Types (Multimodal)
 */
export type OpenRouterContent = 
  | { type: 'text'; text: string; cache_control?: CacheControl }
  | { type: 'image_url'; image_url: { url: string }; cache_control?: CacheControl }
  | { type: 'file'; file: { filename: string; file_data: string }; cache_control?: CacheControl }
  | { type: 'input_audio'; input_audio: { data: string; format: 'wav' | 'mp3' }; cache_control?: CacheControl };

/**
 * OpenRouter Message (supports string or multimodal content)
 */
export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | OpenRouterContent[];
}

/**
 * OpenRouter Plugin Configuration
 */
export type OpenRouterPlugin = 
  | {
      id: 'file-parser';
      pdf?: {
        engine: 'pdf-text' | 'mistral-ocr' | 'native';
      };
    }
  | {
      id: 'web';
      engine?: 'native' | 'exa';
      max_results?: number;
      search_prompt?: string;
    };

/**
 * OpenRouter Reasoning Config
 */
export interface OpenRouterReasoning {
  enabled: boolean;
  effort?: 'low' | 'medium' | 'high';
  max_tokens?: number;
  exclude?: boolean;
}

/**
 * OpenRouter Usage Accounting Config
 */
export interface OpenRouterUsageConfig {
  include: boolean;
}

/**
 * OpenRouter Usage Response
 */
export interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number; // Cost in credits
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

/**
 * OpenRouter API Request
 */
export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  plugins?: OpenRouterPlugin[];
  reasoning?: OpenRouterReasoning;
  usage?: OpenRouterUsageConfig; // Enable usage accounting
  modalities?: string[]; // Image generation support (e.g., ['image', 'text'])
  include_reasoning?: boolean; // Control inclusion of reasoning traces in the response
}

/**
 * Generated Image from OpenRouter
 */
export interface OpenRouterImage {
  type: 'image_url';
  image_url: {
    url: string; // Base64 data URL
  };
}

export type OpenRouterReasoningChunk =
  | string
  | {
      type?: string;
      text?: string;
      output_text?: string;
      reasoning_text?: string;
      content?: OpenRouterReasoningChunk | OpenRouterReasoningChunk[];
      messages?: OpenRouterReasoningChunk | OpenRouterReasoningChunk[];
      steps?: OpenRouterReasoningChunk | OpenRouterReasoningChunk[];
    }
  | OpenRouterReasoningChunk[];

export interface OpenRouterStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  provider?: string;
  choices: {
    index: number;
    delta: {
      content?: string;
      role?: string;
      reasoning?: OpenRouterReasoningChunk; // Reasoning tokens from OpenRouter
      images?: OpenRouterImage[]; // Generated images
    };
    finish_reason?: string | null;
  }[];
  message?: {
    role: string;
    content: string;
    images?: OpenRouterImage[]; // Generated images
    annotations?: Array<{
      type: 'url_citation';
      url_citation?: {
        url: string;
        title: string;
        content?: string;
        start_index?: number;
        end_index?: number;
      };
    }>;
  };
  usage?: OpenRouterUsage; // Usage information (tokens, cost)
  error?: {
    code: string;
    message: string;
  };
}

export interface OpenRouterError {
  error: {
    code: number;
    message: string;
  };
}

export interface AIServiceConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}
