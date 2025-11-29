import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { encrypt } from '../utils/encryption';
import { validate } from '../utils/validation';
import { UnauthorizedError, ValidationError } from '../utils/errors';
import { db } from '../config/firebase';
import { logger } from '../utils/logger';

// Interface para API Key do Firestore
type TranscriptionProvider = 'openrouter' | 'gemini';

interface FirestoreApiKeyData {
  id: string;
  name: string;
  encryptedKey: string;
  provider: TranscriptionProvider; // Provider type: 'openrouter' or 'gemini'
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
}

// Schema principal para validação de ações
const ManageApiKeysSchema = z.object({
  action: z.enum(['add', 'remove', 'setActive', 'updateName', 'migrate']),
  apiKey: z.string().optional(),
  name: z.string().optional(),
  provider: z.enum(['openrouter', 'gemini']).optional(),
  keyId: z.string().optional(),
});

/**
 * Cloud Function consolidada para gerenciar API Keys de Transcrição
 * 
 * Suporta múltiplos providers: OpenRouter e Gemini
 * Permite ter uma chave ativa de cada provider simultaneamente.
 * 
 * Ações disponíveis:
 * - add: Adicionar nova API Key (requer: apiKey, name, provider)
 * - remove: Remover API Key existente (requer: keyId)
 * - setActive: Definir API Key ativa por provider (requer: keyId)
 * - updateName: Atualizar nome da API Key (requer: keyId, name)
 * - migrate: Migrar API Key antiga para novo formato (sem parâmetros)
 */
export const manageApiKeys = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
  if (!request.auth) {
    throw new UnauthorizedError('Usuário não autenticado');
  }
  
  const userId = request.auth.uid;
  const data = validate(ManageApiKeysSchema, request.data);
  
  const userRef = db.collection('users').doc(userId);
  
  try {
    switch (data.action) {
      case 'add': {
        // Validar parâmetros específicos
        if (!data.apiKey || !data.name || !data.provider) {
          throw new ValidationError('apiKey, name e provider são obrigatórios para adicionar');
        }

        const userDoc = await userRef.get();
        if (!userDoc.exists) {
          throw new ValidationError('Usuário não encontrado');
        }

        const userData = userDoc.data();
        const existingKeys = userData?.openRouterApiKeys || [];

        // Criptografar a nova API Key
        const encryptedKey = encrypt(data.apiKey);

        // Criar objeto da nova chave
        const newKey: FirestoreApiKeyData = {
          id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          name: data.name,
          encryptedKey: encryptedKey,
          provider: data.provider,
          isActive: existingKeys.length === 0, // Primeira chave é ativa por padrão
          createdAt: new Date(),
        };

        // Adicionar nova chave ao array
        await userRef.update({
          openRouterApiKeys: [...existingKeys, newKey],
          updatedAt: new Date(),
        });

        logger.info('API Key adicionada com sucesso', { userId, keyId: newKey.id, provider: data.provider });

        return {
          success: true,
          message: 'API Key adicionada com sucesso',
          keyId: newKey.id,
        };
      }

      case 'remove': {
        // Validar parâmetros específicos
        if (!data.keyId) {
          throw new ValidationError('keyId é obrigatório para remover');
        }

        const userDoc = await userRef.get();
        if (!userDoc.exists) {
          throw new ValidationError('Usuário não encontrado');
        }

        const userData = userDoc.data();
        const existingKeys = userData?.openRouterApiKeys || [];

        // Encontrar a chave a ser removida
        const keyToRemove = existingKeys.find((k: FirestoreApiKeyData) => k.id === data.keyId);

        if (!keyToRemove) {
          throw new ValidationError('API Key não encontrada');
        }

        // Remover a chave do array
        const updatedKeys = existingKeys.filter((k: FirestoreApiKeyData) => k.id !== data.keyId);

        // Se a chave removida era ativa e ainda há chaves, ativar a primeira
        if (keyToRemove.isActive && updatedKeys.length > 0) {
          updatedKeys[0].isActive = true;
        }

        await userRef.update({
          openRouterApiKeys: updatedKeys,
          updatedAt: new Date(),
        });

        logger.info('API Key removida com sucesso', { userId, keyId: data.keyId });

        return {
          success: true,
          message: 'API Key removida com sucesso',
        };
      }

      case 'setActive': {
        // Validar parâmetros específicos
        if (!data.keyId) {
          throw new ValidationError('keyId é obrigatório para ativar');
        }

        const userDoc = await userRef.get();
        if (!userDoc.exists) {
          throw new ValidationError('Usuário não encontrado');
        }

        const userData = userDoc.data();
        const existingKeys = userData?.openRouterApiKeys || [];

        // Verificar se a chave existe
        const keyToActivate = existingKeys.find((k: FirestoreApiKeyData) => k.id === data.keyId);

        if (!keyToActivate) {
          throw new ValidationError('API Key não encontrada');
        }

        // Desativar apenas as chaves do MESMO provider, permitindo uma Gemini e uma OpenRouter ativas simultaneamente
        const providerToActivate = keyToActivate.provider || 'openrouter';
        
        const updatedKeys = existingKeys.map((k: FirestoreApiKeyData): FirestoreApiKeyData => {
          const isBeingActivated = k.id === data.keyId;
          const isSameProvider = (k.provider || 'openrouter') === providerToActivate;
          
          const updatedKey: FirestoreApiKeyData = {
            ...k,
            // Ativa se for a key selecionada, desativa apenas se for do mesmo provider
            isActive: isBeingActivated || (!isSameProvider && k.isActive),
          };
          
          // Só incluir lastUsedAt se estiver ativando (evita undefined no Firestore)
          if (isBeingActivated) {
            updatedKey.lastUsedAt = new Date();
          } else if (k.lastUsedAt) {
            // Manter o valor existente se houver
            updatedKey.lastUsedAt = k.lastUsedAt;
          }
          
          return updatedKey;
        });

        await userRef.update({
          openRouterApiKeys: updatedKeys,
          updatedAt: new Date(),
        });

        logger.info('API Key ativada com sucesso', { userId, keyId: data.keyId });

        return {
          success: true,
          message: 'API Key ativada com sucesso',
        };
      }

      case 'updateName': {
        // Validar parâmetros específicos
        if (!data.keyId || !data.name) {
          throw new ValidationError('keyId e name são obrigatórios para atualizar');
        }

        const userDoc = await userRef.get();
        if (!userDoc.exists) {
          throw new ValidationError('Usuário não encontrado');
        }

        const userData = userDoc.data();
        const existingKeys = userData?.openRouterApiKeys || [];

        // Verificar se a chave existe
        const keyExists = existingKeys.some((k: FirestoreApiKeyData) => k.id === data.keyId);

        if (!keyExists) {
          throw new ValidationError('API Key não encontrada');
        }

        // Atualizar o nome da chave
        const updatedKeys = existingKeys.map((k: FirestoreApiKeyData): FirestoreApiKeyData => ({
          ...k,
          name: k.id === data.keyId ? data.name! : k.name,
        }));

        await userRef.update({
          openRouterApiKeys: updatedKeys,
          updatedAt: new Date(),
        });

        logger.info('Nome da API Key atualizado com sucesso', { userId, keyId: data.keyId });

        return {
          success: true,
          message: 'Nome atualizado com sucesso',
        };
      }

      case 'migrate': {
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
          throw new ValidationError('Usuário não encontrado');
        }

        const userData = userDoc.data();
        const oldKey = userData?.openRouterApiKey;
        const newKeys = userData?.openRouterApiKeys || [];

        // Se não há chave antiga ou já foi migrada, retornar
        if (!oldKey || newKeys.length > 0) {
          return {
            success: true,
            message: 'Nenhuma migração necessária',
            migrated: false,
          };
        }

        // Criar objeto da chave migrada
        // Se a chave antiga já está criptografada (contém ':'), mantém, senão criptografa
        const encryptedKey = oldKey.includes(':') ? oldKey : encrypt(oldKey);

        const migratedKey: FirestoreApiKeyData = {
          id: `key_${Date.now()}_migrated`,
          name: 'Chave Principal',
          encryptedKey: encryptedKey,
          provider: 'openrouter', // Keys antigas são sempre OpenRouter
          isActive: true,
          createdAt: new Date(),
        };

        // Salvar no novo formato
        await userRef.update({
          openRouterApiKeys: [migratedKey],
          updatedAt: new Date(),
        });

        logger.info('API Key migrada com sucesso', { userId });

        return {
          success: true,
          message: 'API Key migrada com sucesso',
          migrated: true,
        };
      }

      default:
        throw new ValidationError('Ação inválida');
    }
  } catch (error) {
    logger.error('Erro ao gerenciar API Keys', { userId, action: data.action, error });
    throw error;
  }
  }
);
