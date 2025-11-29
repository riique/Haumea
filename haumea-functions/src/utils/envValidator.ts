/**
 * Environment Variables Validator
 * Valida variáveis de ambiente críticas no startup
 */

import { logger } from './logger';

/**
 * Detecta se está rodando no ambiente Cloud Functions
 */
function isCloudFunctionsEnvironment(): boolean {
  return !!(
    process.env.FUNCTION_NAME ||
    process.env.K_SERVICE ||
    process.env.FUNCTION_TARGET
  );
}

/**
 * Valida e retorna variável de ambiente obrigatória
 */
function getRequiredEnv(key: string, allowEmpty = false): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    if (allowEmpty) {
      return '';
    }
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value.trim();
}

/**
 * Valida formato da ENCRYPTION_KEY
 */
function validateEncryptionKey(key: string): void {
  if (!key) return; // Skip validation if empty (during build/deploy)
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes)');
  }
}

/**
 * Valida todas as variáveis de ambiente críticas
 * Deve ser chamado no início da aplicação
 */
export function validateEnvironment(): void {
  try {
    logger.info('Validating environment variables...');

    // Durante build/deploy, não validar estritamente
    const isProduction = isCloudFunctionsEnvironment();
    
    if (!isProduction) {
      logger.info('Build/deploy environment detected, skipping strict validation');
      return;
    }

    // Validar ENCRYPTION_KEY
    const encryptionKey = getRequiredEnv('ENCRYPTION_KEY');
    validateEncryptionKey(encryptionKey);
    logger.info('ENCRYPTION_KEY validated successfully');

    // Validar ADMIN_PASSWORD
    const adminPassword = getRequiredEnv('ADMIN_PASSWORD');
    if (adminPassword.length < 8) {
      throw new Error('ADMIN_PASSWORD must be at least 8 characters long');
    }
    logger.info('ADMIN_PASSWORD validated successfully');

    logger.info('All environment variables validated successfully');
  } catch (error) {
    logger.error('Environment validation failed', error);
    throw error;
  }
}

/**
 * Obtém ADMIN_PASSWORD validada
 */
export function getAdminPassword(): string {
  // Durante build/deploy, retornar valor placeholder
  if (!isCloudFunctionsEnvironment()) {
    return process.env.ADMIN_PASSWORD || 'placeholder-password-for-build';
  }
  return getRequiredEnv('ADMIN_PASSWORD');
}

/**
 * Obtém ENCRYPTION_KEY validada
 */
export function getEncryptionKey(): string {
  // Durante build/deploy, retornar valor placeholder
  if (!isCloudFunctionsEnvironment()) {
    return process.env.ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000000';
  }
  return getRequiredEnv('ENCRYPTION_KEY');
}
