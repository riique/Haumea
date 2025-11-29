import { db } from '../config/firebase';
import { decrypt } from './encryption';
import { logger } from './logger';

// Interface para API Key do Firestore
type TranscriptionProvider = 'openrouter' | 'gemini';

interface FirestoreApiKeyData {
  id: string;
  name: string;
  encryptedKey: string;
  provider: TranscriptionProvider; // Provider type
  isActive: boolean;
  createdAt: Date | { toDate(): Date };
  lastUsedAt?: Date | { toDate(): Date };
}

/**
 * Busca e descriptografa a API Key do OpenRouter de um usuário
 * 
 * Esta função é usada internamente pelo backend para obter a API Key
 * descriptografada quando necessário (ex: chatWithAI)
 * 
 * Suporta tanto o formato antigo (openRouterApiKey) quanto o novo (openRouterApiKeys array)
 * 
 * @param userId - ID do usuário
 * @returns API Key descriptografada ou null se não encontrada
 */
export async function getUserApiKey(userId: string): Promise<string | null> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      logger.warn('Usuário não encontrado', { userId });
      return null;
    }
    
    const userData = userDoc.data();
    
    // Primeiro, tenta buscar do novo formato (array de chaves)
    const apiKeys = userData?.openRouterApiKeys || [];
    
    if (apiKeys.length > 0) {
      // Encontrar a chave ativa
      const activeKey = apiKeys.find((key: FirestoreApiKeyData) => key.isActive);
      
      if (!activeKey) {
        logger.warn('Nenhuma API Key ativa encontrada, usando a primeira', { userId });
        // Se nenhuma está marcada como ativa, usa a primeira
        const firstKey = apiKeys[0];
        const encryptedKey = firstKey.encryptedKey;
        
        if (!encryptedKey) {
          logger.error('API Key sem campo encryptedKey', { userId });
          return null;
        }
        
        const decryptedKey = decrypt(encryptedKey);
        logger.debug('API Key descriptografada (primeira do array)', { userId, keyId: firstKey.id });
        return decryptedKey;
      }
      
      const encryptedKey = activeKey.encryptedKey;
      
      if (!encryptedKey) {
        logger.error('API Key ativa sem campo encryptedKey', { userId, keyId: activeKey.id });
        return null;
      }
      
      // Descriptografar API Key
      const decryptedKey = decrypt(encryptedKey);
      logger.debug('API Key ativa descriptografada com sucesso', { userId, keyId: activeKey.id });
      
      return decryptedKey;
    }
    
    // Fallback: Formato antigo (openRouterApiKey)
    const encryptedApiKey = userData?.openRouterApiKey;
    
    if (!encryptedApiKey) {
      logger.info('API Key não configurada para o usuário', { userId });
      return null;
    }
    
    // Se a API Key não contém ':', ela não está criptografada (backward compatibility)
    if (!encryptedApiKey.includes(':')) {
      logger.warn('API Key não criptografada encontrada (legacy)', { userId });
      return encryptedApiKey;
    }
    
    // Descriptografar API Key
    const decryptedKey = decrypt(encryptedApiKey);
    
    logger.debug('API Key descriptografada com sucesso (formato antigo)', { userId });
    
    return decryptedKey;
  } catch (error) {
    logger.error('Erro ao obter API Key do usuário', { userId, error });
    throw error;
  }
}

/**
 * Busca o nome da API Key ativa do usuário
 * 
 * @param userId - ID do usuário
 * @returns Nome da API Key ativa ou 'Desconhecida' se não encontrada
 */
export async function getActiveApiKeyName(userId: string): Promise<string> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      logger.warn('Usuário não encontrado ao buscar nome da API Key', { userId });
      return 'Desconhecida';
    }
    
    const userData = userDoc.data();
    
    // Primeiro, tenta buscar do novo formato (array de chaves)
    const apiKeys = userData?.openRouterApiKeys || [];
    
    if (apiKeys.length > 0) {
      // Encontrar a chave ativa
      const activeKey = apiKeys.find((key: FirestoreApiKeyData) => key.isActive);
      
      if (activeKey && activeKey.name) {
        return activeKey.name;
      }
      
      // Se nenhuma está marcada como ativa, usa o nome da primeira
      if (apiKeys[0] && apiKeys[0].name) {
        return apiKeys[0].name;
      }
    }
    
    // Formato antigo não tem nome
    if (userData?.openRouterApiKey) {
      return 'API Key Padrão';
    }
    
    return 'Desconhecida';
  } catch (error) {
    logger.error('Erro ao obter nome da API Key do usuário', { userId, error });
    return 'Desconhecida';
  }
}

/**
 * Verifica se o usuário tem uma API Key configurada
 * 
 * Suporta tanto o formato antigo (openRouterApiKey) quanto o novo (openRouterApiKeys array)
 * 
 * @param userId - ID do usuário
 * @returns true se o usuário tem API Key configurada
 */
export async function hasUserApiKey(userId: string): Promise<boolean> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    // Verifica novo formato
    const apiKeys = userData?.openRouterApiKeys || [];
    if (apiKeys.length > 0) {
      return true;
    }
    
    // Verifica formato antigo
    return !!userData?.openRouterApiKey;
  } catch (error) {
    logger.error('Erro ao verificar API Key do usuário', { userId, error });
    return false;
  }
}

/**
 * Busca e descriptografa a API Key de transcrição baseada no provider
 * 
 * Esta função retorna a API Key ativa do provider especificado (Gemini ou OpenRouter).
 * Se nenhuma key do provider estiver ativa, retorna a primeira disponível.
 * 
 * @param userId - ID do usuário
 * @param provider - Provider desejado ('gemini' ou 'openrouter')
 * @returns Objeto com API Key descriptografada e provider, ou null se não encontrada
 */
export async function getTranscriptionApiKey(
  userId: string,
  provider: TranscriptionProvider
): Promise<{ apiKey: string; provider: TranscriptionProvider; keyId: string } | null> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      logger.warn('Usuário não encontrado', { userId });
      return null;
    }
    
    const userData = userDoc.data();
    const apiKeys = userData?.openRouterApiKeys || [];
    
    if (apiKeys.length === 0) {
      logger.info('Nenhuma API Key configurada para transcrição', { userId, provider });
      return null;
    }
    
    // Filtrar keys do provider especificado
    const providerKeys = apiKeys.filter(
      (key: FirestoreApiKeyData) => (key.provider || 'openrouter') === provider
    );
    
    if (providerKeys.length === 0) {
      logger.info(`Nenhuma API Key do provider ${provider} encontrada`, { userId, provider });
      return null;
    }
    
    // Encontrar a chave ativa do provider
    const activeKey = providerKeys.find((key: FirestoreApiKeyData) => key.isActive);
    
    const selectedKey = activeKey || providerKeys[0];
    const encryptedKey = selectedKey.encryptedKey;
    
    if (!encryptedKey) {
      logger.error('API Key sem campo encryptedKey', { userId, keyId: selectedKey.id });
      return null;
    }
    
    // Descriptografar API Key
    const decryptedKey = decrypt(encryptedKey);
    
    logger.debug(`API Key do provider ${provider} descriptografada com sucesso`, {
      userId,
      provider,
      keyId: selectedKey.id,
      isActive: selectedKey.isActive,
    });
    
    return {
      apiKey: decryptedKey,
      provider: provider,
      keyId: selectedKey.id,
    };
  } catch (error) {
    logger.error('Erro ao obter API Key de transcrição', { userId, provider, error });
    throw error;
  }
}

/**
 * Verifica se o usuário tem API Key do provider especificado
 * 
 * @param userId - ID do usuário
 * @param provider - Provider para verificar ('gemini' ou 'openrouter')
 * @returns true se o usuário tem API Key do provider
 */
export async function hasProviderApiKey(
  userId: string,
  provider: TranscriptionProvider
): Promise<boolean> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    const apiKeys = userData?.openRouterApiKeys || [];
    
    // Verificar se existe alguma key do provider especificado
    const hasKey = apiKeys.some(
      (key: FirestoreApiKeyData) => (key.provider || 'openrouter') === provider
    );
    
    return hasKey;
  } catch (error) {
    logger.error('Erro ao verificar API Key do provider', { userId, provider, error });
    return false;
  }
}
