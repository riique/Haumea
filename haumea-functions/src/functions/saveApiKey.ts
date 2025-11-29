import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { encrypt } from '../utils/encryption';
import { validate } from '../utils/validation';
import { UnauthorizedError } from '../utils/errors';
import { db } from '../config/firebase';
import { logger } from '../utils/logger';

const SaveApiKeySchema = z.object({
  apiKey: z.string().min(10, 'API Key deve ter pelo menos 10 caracteres'),
});

/**
 * Cloud Function para salvar API Key do OpenRouter criptografada
 * 
 * A API Key é criptografada usando AES-256-GCM antes de ser salva no Firestore
 * 
 * @param {string} apiKey - API Key do OpenRouter a ser salva
 * @returns {object} { success: boolean }
 */
export const saveApiKey = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
  if (!request.auth) {
    throw new UnauthorizedError('Usuário não autenticado');
  }
  
  const userId = request.auth.uid;
  const data = validate(SaveApiKeySchema, request.data);
  
  try {
    // Criptografar API Key usando AES-256-GCM
    const encryptedKey = encrypt(data.apiKey);
    
    // Salvar no Firestore
    await db.collection('users')
      .doc(userId)
      .update({
        openRouterApiKey: encryptedKey,
        updatedAt: new Date(),
      });
    
    logger.info('API Key salva com sucesso (criptografada)', { userId });
    
    return { 
      success: true,
      message: 'API Key salva com sucesso'
    };
  } catch (error) {
    logger.error('Erro ao salvar API Key', { userId, error });
    throw error;
  }
  }
);
