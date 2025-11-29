import { onRequest } from 'firebase-functions/v2/https';
import { validate, ChatMessageSchema } from '../utils/validation';
import { configureCORS } from '../middleware/cors';
import { handleError } from '../middleware/errorHandler';
import { rateLimitChat } from '../middleware/rateLimit';
import { aiService } from '../services/aiService';
import { logger } from '../utils/logger';
import { UnauthorizedError } from '../utils/errors';
import { getUserApiKey } from '../utils/apiKeyManager';

/**
 * Cloud Function para chat com IA usando streaming
 * 
 * Endpoint: POST /chatWithAI
 * 
 * Body:
 * {
 *   chatId: string;
 *   message: string;
 *   userId: string;
 *   model?: string;
 *   apiKey: string;
 *   attachments?: Array<{id, type, url}>;
 *   webSearchEnabled?: boolean;
 * }
 * 
 * Response: Server-Sent Events (SSE) stream
 * - data: { content: string, finish_reason: string | null }
 * - data: [DONE]
 * - data: { error: {...}, finish_reason: 'error' }
 */
export const chatWithAI = onRequest(
  {
    region: 'us-central1',
    memory: '2GiB', // Aumentado para conversas longas com muito histórico
    timeoutSeconds: 900, // 15 minutos - Sem limite para conversas longas
    concurrency: 80,
    cors: false, // Configurado manualmente
  },
  async (req, res) => {
    try {
      // CORS - Retornar se for preflight
      if (configureCORS(req, res)) return;

      // Rate Limiting - 100 mensagens por minuto por usuário
      rateLimitChat(req, res);

      // Validar método
      if (req.method !== 'POST') {
        res.status(405).json({ 
          error: { 
            message: 'Método não permitido', 
            code: 'METHOD_NOT_ALLOWED' 
          } 
        });
        return;
      }

      logger.info('Chat request recebida', {
        userId: req.body.userId,
        chatId: req.body.chatId,
        hasAttachments: !!req.body.attachments && req.body.attachments.length > 0,
      });

      // Validar dados do request
      const validatedData = validate(ChatMessageSchema, req.body);

      // Buscar API Key do usuário (criptografada no Firestore)
      // Prioridade: 1) API Key do usuário no Firestore, 2) API Key do request (backward compatibility), 3) API Key do ambiente
      let apiKey = await getUserApiKey(validatedData.userId);
      
      if (!apiKey) {
        apiKey = req.body.apiKey || process.env.OPENROUTER_API_KEY;
      }
      
      if (!apiKey) {
        throw new UnauthorizedError('API Key não configurada. Configure sua API Key nas configurações.');
      }

      // Log da requisição
      logger.info('Processando mensagem', {
        userId: validatedData.userId,
        chatId: validatedData.chatId,
        model: validatedData.model,
        messageLength: validatedData.message.length,
        attachments: validatedData.attachments?.length || 0,
        pdfEngine: validatedData.pdfEngine,
        isFirstMessage: validatedData.isFirstMessage,
        isAutoCreatedChat: validatedData.isAutoCreatedChat,
      });

      // Processar mensagem com streaming (multimodal + reasoning + web search + conversation history + guided study + memories + image generation + personas)
      await aiService.processMessageWithStreaming(
        {
          chatId: validatedData.chatId,
          userId: validatedData.userId,
          userName: validatedData.userName,
          userNickname: validatedData.userNickname,
          userAbout: validatedData.userAbout,
          message: validatedData.message,
          conversationHistory: validatedData.conversationHistory,
          model: validatedData.model,
          apiKey,
          attachments: validatedData.attachments,
          pdfEngine: validatedData.pdfEngine,
          reasoning: validatedData.reasoning,
          webSearch: validatedData.webSearch,
          guidedStudy: validatedData.guidedStudy,
          globalMemories: validatedData.globalMemories,
          chatMemories: validatedData.chatMemories,
          aiPersonalities: validatedData.aiPersonalities,
          personaConfig: validatedData.personaConfig,
          generateImages: validatedData.generateImages,
          isFirstMessage: validatedData.isFirstMessage,
          isAutoCreatedChat: validatedData.isAutoCreatedChat,
        },
        res
      );

    } catch (error) {
      // Tratar erro
      handleError(error, res);
    }
  }
);
