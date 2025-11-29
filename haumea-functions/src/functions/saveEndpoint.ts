import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { encrypt } from '../utils/encryption';
import { validate } from '../utils/validation';
import { UnauthorizedError } from '../utils/errors';
import { db } from '../config/firebase';
import { logger } from '../utils/logger';

const SaveEndpointSchema = z.object({
  name: z.string().min(1).max(50),
  url: z.string().url(),
  apiKey: z.string().min(10),
  defaultModel: z.string().min(1),
  provider: z.enum(['openrouter', 'anthropic', 'openai', 'custom']),
});

export const saveEndpoint = onCall(async (request) => {
  if (!request.auth) {
    throw new UnauthorizedError();
  }
  
  const userId = request.auth.uid;
  const data = validate(SaveEndpointSchema, request.data);
  
  // Criptografar API Key
  const encryptedKey = encrypt(data.apiKey);
  
  const endpointId = `endpoint_${Date.now()}`;
  
  await db.collection('users')
    .doc(userId)
    .collection('endpoints')
    .doc(endpointId)
    .set({
      name: data.name,
      url: data.url,
      apiKey: encryptedKey,
      defaultModel: data.defaultModel,
      provider: data.provider,
      isActive: true,
      createdAt: new Date(),
    });
  
  logger.info('Endpoint saved', { userId, endpointId });
  
  return { success: true, endpointId };
});
