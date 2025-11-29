import { z } from 'zod';
import { ValidationError } from './errors';

// Schema para attachment
const AttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(), // MIME type (image/*, application/pdf, audio/*, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain)
  size: z.number(),
  url: z.string(),
  base64: z.string().optional(), // Para áudios
  isActive: z.boolean().optional().default(true), // Whether attachment is active in context
});

// Schema para mensagem do histórico
const ConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  attachments: z.array(AttachmentSchema).optional(),
});

// Schema para memória
const MemorySchema = z.object({
  id: z.string(),
  content: z.string(),
  color: z.string(),
  createdAt: z.union([z.date(), z.string()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ),
});

// Schema para personalidade da IA
const AIPersonalitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  isActive: z.boolean(),
  createdAt: z.union([z.date(), z.string()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ),
  updatedAt: z.union([z.date(), z.string()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ),
});

// Schema para Persona (identity replacement, not personality add-on)
const PersonaConfigSchema = z.object({
  personaId: z.string(),
  name: z.string(),
  personality: z.string(),
  description: z.string(),
  dialogExamples: z.string().optional(),
  firstMessage: z.string().optional(),
  alwaysDo: z.string().optional(),
  neverDo: z.string().optional(),
  maxTokens: z.number().optional(),
});

// Schema para mensagem de chat com suporte multimodal
export const ChatMessageSchema = z.object({
  chatId: z.string().min(1, 'chatId é obrigatório'),
  message: z.string().min(1, 'message vazio'), // SEM LIMITE de caracteres
  userId: z.string().min(1),
  userName: z.string().optional(), // User's display name
  userNickname: z.string().optional(), // User's preferred nickname for AI to use
  userAbout: z.string().optional(), // Additional information about the user
  model: z.string().optional().default('google/gemini-2.5-flash'),
  apiKey: z.string().optional(),
  // Conversation history for context
  conversationHistory: z.array(ConversationMessageSchema).optional(),
  // Attachments multimodais
  attachments: z.array(AttachmentSchema).optional(),
  // PDF Engine configuration
  pdfEngine: z.enum(['pdf-text', 'mistral-ocr', 'native']).optional().default('pdf-text'),
  webSearchEnabled: z.boolean().default(false),
  // Reasoning configuration (OpenRouter unified API)
  reasoning: z.object({
    enabled: z.boolean(),
    effort: z.enum(['low', 'medium', 'high']).optional(),
    max_tokens: z.number().optional(),
    exclude: z.boolean().optional(),
  }).optional(),
  // Web search configuration
  webSearch: z.object({
    enabled: z.boolean(),
    engine: z.enum(['native', 'exa']).optional(),
    max_results: z.number().optional(),
    search_prompt: z.string().optional(),
  }).optional(),
  // Guided study mode
  guidedStudy: z.boolean().optional(),
  // Memories
  globalMemories: z.array(MemorySchema).optional(),
  chatMemories: z.array(MemorySchema).optional(),
  // AI Personalities
  aiPersonalities: z.array(AIPersonalitySchema).optional(),
  // Persona configuration (complete identity replacement)
  personaConfig: PersonaConfigSchema.optional(),
  // Image generation
  generateImages: z.boolean().optional(),
  // Auto-naming system
  isFirstMessage: z.boolean().optional(),
  isAutoCreatedChat: z.boolean().optional(),
  // Chat generation settings
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(128000).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  repetitionPenalty: z.number().min(0).max(2).optional(),
});

export type ChatMessageRequest = z.infer<typeof ChatMessageSchema>;

// Schema para transcrição de áudio
export const TranscribeAudioSchema = z.object({
  userId: z.string().min(1, 'User ID é obrigatório'),
  audioBase64: z.string().min(1, 'Áudio base64 é obrigatório'),
  model: z.string().min(1, 'Modelo é obrigatório'),
  storagePath: z.string().optional(),
  audioDurationSeconds: z.number().optional(),
  fileSize: z.number().optional(),
});

export type TranscribeAudioRequest = z.infer<typeof TranscribeAudioSchema>;

// Schema para retry de transcrição com falha
export const RetryTranscriptionSchema = z.object({
  failedTranscriptionId: z.string().min(1, 'ID da transcrição com falha é obrigatório'),
});

export type RetryTranscriptionRequest = z.infer<typeof RetryTranscriptionSchema>;

// Schema para deletar transcrição com falha
export const DeleteFailedTranscriptionSchema = z.object({
  failedTranscriptionId: z.string().min(1, 'ID da transcrição com falha é obrigatório'),
});

export type DeleteFailedTranscriptionRequest = z.infer<typeof DeleteFailedTranscriptionSchema>;

// Schema para deletar todas transcrições com falha
export const DeleteAllFailedTranscriptionsSchema = z.object({
  userId: z.string().min(1, 'User ID é obrigatório'),
});

export type DeleteAllFailedTranscriptionsRequest = z.infer<typeof DeleteAllFailedTranscriptionsSchema>;

// Validar request
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Log detailed validation errors for debugging
      console.error('❌ Validation failed:', JSON.stringify(error.issues, null, 2));
      console.error('📦 Data that failed validation:', JSON.stringify(data, null, 2));
      throw new ValidationError('Dados inválidos', error.issues);
    }
    throw error;
  }
}
