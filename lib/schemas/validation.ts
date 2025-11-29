/**
 * Schemas Zod para Validação Runtime
 * 
 * Garante type-safety em runtime e facilita validação de dados externos
 */

import { z } from 'zod';

/**
 * Message Schema
 */
export const AttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  size: z.number(),
  url: z.string().url(),
  storageRef: z.string().optional(),
  base64: z.string().optional(),
  preview: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

export const CitationSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  content: z.string().optional(),
  snippet: z.string().optional(),
  start_index: z.number().optional(),
  end_index: z.number().optional(),
});

export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.date(),
  model: z.string().optional(),
  reasoning: z.string().optional(),
  isStreaming: z.boolean().optional(),
  attachments: z.array(AttachmentSchema).optional(),
  citations: z.array(CitationSchema).optional(),
  webSearchEnabled: z.boolean().optional(),
});

/**
 * Chat Schema
 */
export const MemorySchema = z.object({
  id: z.string(),
  content: z.string(),
  color: z.string().optional(),
  createdAt: z.date(),
});

export const ChatConfigSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  systemPrompt: z.string().optional(),
  context: z.string().optional(),
  password: z.string().optional(),
  latexEnabled: z.boolean().optional(),
  latexLevel: z.enum(['baixo', 'medio', 'alto']).optional(),
  temperature: z.number().min(0).max(2).optional(),
  frequencyPenalty: z.number().min(0).max(2).optional(),
  repetitionPenalty: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  memories: z.array(MemorySchema).optional(),
});

export const ChatSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.date(),
  lastMessageAt: z.date(),
  lastMessage: z.string().optional(),
  messageCount: z.number().int().nonnegative(),
  systemPrompt: z.string().optional(),
  context: z.string().optional(),
  password: z.string().optional(),
  latexEnabled: z.boolean().optional(),
  latexLevel: z.enum(['baixo', 'medio', 'alto']).optional(),
  temperature: z.number().optional(),
  frequencyPenalty: z.number().optional(),
  repetitionPenalty: z.number().optional(),
  maxTokens: z.number().optional(),
  selectedModel: z.string().optional(),
  guidedStudyEnabled: z.boolean().optional(),
  folderId: z.string().nullable().optional(),
  isArchived: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  isProtected: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  totalCost: z.number().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
  memories: z.array(MemorySchema).optional(),
  order: z.number().optional(),
});

/**
 * Folder Schema (recursivo)
 * Tipo inferido automaticamente para evitar uso de any
 */
interface FolderType {
  id: string;
  name: string;
  color?: string;
  password?: string;
  isExpanded?: boolean;
  createdAt: Date;
  parentFolderId?: string | null;
  chats: z.infer<typeof ChatSchema>[];
  subfolders?: FolderType[];
}

export const FolderSchema: z.ZodType<FolderType> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string().min(1, 'Nome é obrigatório'),
    color: z.string().optional(),
    password: z.string().optional(),
    isExpanded: z.boolean().optional(),
    createdAt: z.date(),
    parentFolderId: z.string().nullable().optional(),
    chats: z.array(ChatSchema),
    subfolders: z.array(FolderSchema).optional(),
  })
);

/**
 * User Profile Schema
 */
export const UserProfileSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  photoURL: z.string().url().optional(),
  photoStoragePath: z.string().optional(),
  openRouterApiKey: z.string().optional(),
  pdfEngine: z.enum(['pdf-text', 'llamaparse']).optional(),
  defaultModel: z.string().optional(),
  transcriptionModel: z.string().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().int().positive().optional(),
  theme: z.enum(['light', 'dark', 'dracula']).optional(),
  favoriteModels: z.array(z.string()).optional(),
  globalMemories: z.array(MemorySchema).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * API Responses
 */
export const OpenRouterUsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
  cost: z.number().nonnegative(),
  prompt_tokens_details: z
    .object({
      cached_tokens: z.number().optional(),
      audio_tokens: z.number().optional(),
    })
    .optional(),
  completion_tokens_details: z
    .object({
      reasoning_tokens: z.number().optional(),
    })
    .optional(),
  cost_details: z
    .object({
      upstream_inference_cost: z.number().optional(),
    })
    .optional(),
});

/**
 * Helper functions para validação
 */
export function validateMessage(data: unknown): z.infer<typeof MessageSchema> {
  return MessageSchema.parse(data);
}

export function validateChat(data: unknown): z.infer<typeof ChatSchema> {
  return ChatSchema.parse(data);
}

export function validateUserProfile(data: unknown): z.infer<typeof UserProfileSchema> {
  return UserProfileSchema.parse(data);
}

/**
 * Safe parse com error handling
 */
export function safeParseMessage(data: unknown) {
  return MessageSchema.safeParse(data);
}

export function safeParseChat(data: unknown) {
  return ChatSchema.safeParse(data);
}

export function safeParseUserProfile(data: unknown) {
  return UserProfileSchema.safeParse(data);
}

/**
 * Type exports
 */
export type Message = z.infer<typeof MessageSchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type Chat = z.infer<typeof ChatSchema>;
export type ChatConfig = z.infer<typeof ChatConfigSchema>;
export type Folder = z.infer<typeof FolderSchema>;
export type Memory = z.infer<typeof MemorySchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type OpenRouterUsage = z.infer<typeof OpenRouterUsageSchema>;
