/**
 * Error Service - Tratamento Centralizado de Erros
 * 
 * Objetivos:
 * - Tratamento consistente de erros
 * - Mensagens amigáveis ao usuário
 * - Logging estruturado
 * - Integração futura com Sentry/monitoring
 */

import { logger } from '@/lib/utils/logger';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface AppError {
  code: string;
  message: string;
  userMessage: string;
  severity: ErrorSeverity;
  context?: Record<string, unknown>;
  originalError?: Error;
}

/**
 * Tipos de erros da aplicação
 */
export const ErrorCodes = {
  // Autenticação
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // API
  API_KEY_MISSING: 'API_KEY_MISSING',
  API_REQUEST_FAILED: 'API_REQUEST_FAILED',
  API_RATE_LIMIT: 'API_RATE_LIMIT',
  
  // Firebase
  FIRESTORE_ERROR: 'FIRESTORE_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  
  // Cache
  CACHE_ERROR: 'CACHE_ERROR',
  INDEXEDDB_ERROR: 'INDEXEDDB_ERROR',
  
  // Upload
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_TYPE_INVALID: 'FILE_TYPE_INVALID',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  
  // Chat
  CHAT_NOT_FOUND: 'CHAT_NOT_FOUND',
  MESSAGE_SEND_FAILED: 'MESSAGE_SEND_FAILED',
  STREAMING_ERROR: 'STREAMING_ERROR',
  
  // Network
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  
  // Generic
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Mapeamento de códigos de erro para mensagens amigáveis
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Autenticação
  AUTH_FAILED: 'Falha na autenticação. Por favor, faça login novamente.',
  AUTH_REQUIRED: 'Você precisa estar logado para acessar esta funcionalidade.',
  INVALID_CREDENTIALS: 'Email ou senha incorretos.',
  
  // API
  API_KEY_MISSING: 'Por favor, configure sua OpenRouter API Key nas configurações.',
  API_REQUEST_FAILED: 'Erro ao comunicar com a API. Tente novamente.',
  API_RATE_LIMIT: 'Limite de requisições atingido. Aguarde alguns instantes.',
  
  // Firebase
  FIRESTORE_ERROR: 'Erro ao acessar o banco de dados. Verifique sua conexão.',
  STORAGE_ERROR: 'Erro ao acessar o armazenamento. Tente novamente.',
  
  // Cache
  CACHE_ERROR: 'Erro no cache local. Os dados serão recarregados.',
  INDEXEDDB_ERROR: 'Erro no armazenamento local. Funcionalidade offline pode estar comprometida.',
  
  // Upload
  FILE_TOO_LARGE: 'Arquivo muito grande. Por favor, use um arquivo menor.',
  FILE_TYPE_INVALID: 'Tipo de arquivo não suportado.',
  UPLOAD_FAILED: 'Erro ao fazer upload do arquivo. Tente novamente.',
  
  // Chat
  CHAT_NOT_FOUND: 'Chat não encontrado.',
  MESSAGE_SEND_FAILED: 'Erro ao enviar mensagem. Tente novamente.',
  STREAMING_ERROR: 'Erro durante o streaming da resposta.',
  
  // Network
  NETWORK_ERROR: 'Erro de conexão. Verifique sua internet.',
  TIMEOUT_ERROR: 'Tempo limite excedido. Tente novamente.',
  
  // Generic
  UNKNOWN_ERROR: 'Ocorreu um erro inesperado. Tente novamente.',
};

/**
 * Determinar severidade do erro baseado no código
 */
function getSeverity(code: ErrorCode): ErrorSeverity {
  const criticalErrors: ErrorCode[] = [
    ErrorCodes.AUTH_FAILED,
    ErrorCodes.FIRESTORE_ERROR,
    ErrorCodes.INDEXEDDB_ERROR,
  ];
  
  const highErrors: ErrorCode[] = [
    ErrorCodes.API_KEY_MISSING,
    ErrorCodes.MESSAGE_SEND_FAILED,
    ErrorCodes.UPLOAD_FAILED,
  ];
  
  const mediumErrors: ErrorCode[] = [
    ErrorCodes.API_REQUEST_FAILED,
    ErrorCodes.NETWORK_ERROR,
    ErrorCodes.CACHE_ERROR,
  ];
  
  if (criticalErrors.includes(code)) return ErrorSeverity.CRITICAL;
  if (highErrors.includes(code)) return ErrorSeverity.HIGH;
  if (mediumErrors.includes(code)) return ErrorSeverity.MEDIUM;
  return ErrorSeverity.LOW;
}

/**
 * Classe principal do Error Service
 */
class ErrorService {
  /**
   * Criar AppError a partir de código
   */
  createError(
    code: ErrorCode,
    context?: Record<string, unknown>,
    originalError?: Error
  ): AppError {
    return {
      code,
      message: code,
      userMessage: ERROR_MESSAGES[code],
      severity: getSeverity(code),
      context,
      originalError,
    };
  }
  
  /**
   * Tratar erro e logar apropriadamente
   */
  handleError(
    error: Error | AppError | unknown,
    context?: string
  ): AppError {
    // Se já é um AppError, apenas logar
    if (this.isAppError(error)) {
      this.logError(error, context);
      return error;
    }
    
    // Converter Error genérico para AppError
    const appError = this.convertToAppError(error, context);
    this.logError(appError, context);
    return appError;
  }
  
  /**
   * Verificar se é AppError
   */
  private isAppError(error: unknown): error is AppError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'userMessage' in error
    );
  }
  
  /**
   * Converter erro genérico para AppError
   */
  private convertToAppError(error: unknown, context?: string): AppError {
    // Error nativo do JavaScript
    if (error instanceof Error) {
      return this.createError(
        this.mapErrorToCode(error),
        { context, errorName: error.name },
        error
      );
    }
    
    // String
    if (typeof error === 'string') {
      return this.createError(
        ErrorCodes.UNKNOWN_ERROR,
        { context, message: error }
      );
    }
    
    // Unknown
    return this.createError(
      ErrorCodes.UNKNOWN_ERROR,
      { context, error: String(error) }
    );
  }
  
  /**
   * Mapear Error para código específico
   */
  private mapErrorToCode(error: Error): ErrorCode {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('conexão')
    ) {
      return ErrorCodes.NETWORK_ERROR;
    }
    
    // Timeout errors
    if (message.includes('timeout') || message.includes('tempo limite')) {
      return ErrorCodes.TIMEOUT_ERROR;
    }
    
    // Firebase errors
    if (message.includes('firestore') || message.includes('firebase')) {
      return ErrorCodes.FIRESTORE_ERROR;
    }
    
    // Storage errors
    if (message.includes('storage')) {
      return ErrorCodes.STORAGE_ERROR;
    }
    
    // Auth errors
    if (message.includes('auth') || message.includes('login')) {
      return ErrorCodes.AUTH_FAILED;
    }
    
    return ErrorCodes.UNKNOWN_ERROR;
  }
  
  /**
   * Logar erro baseado na severidade
   */
  private logError(error: AppError, context?: string) {
    const logData = {
      code: error.code,
      severity: error.severity,
      context: context || error.context,
      message: error.message,
      originalError: error.originalError?.message,
    };
    
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        logger.error('Error:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('Warning:', logData);
        break;
      case ErrorSeverity.LOW:
        logger.info('Info:', logData);
        break;
    }
  }
  
  /**
   * Obter mensagem amigável para o usuário
   */
  getUserMessage(error: Error | AppError | unknown): string {
    if (this.isAppError(error)) {
      return error.userMessage;
    }
    
    const appError = this.convertToAppError(error);
    return appError.userMessage;
  }
  
  /**
   * Verificar se deve mostrar retry
   */
  shouldShowRetry(error: AppError): boolean {
    const retryableErrors: ErrorCode[] = [
      ErrorCodes.API_REQUEST_FAILED,
      ErrorCodes.NETWORK_ERROR,
      ErrorCodes.TIMEOUT_ERROR,
      ErrorCodes.MESSAGE_SEND_FAILED,
      ErrorCodes.UPLOAD_FAILED,
    ];
    
    return retryableErrors.includes(error.code as ErrorCode);
  }
}

// Export singleton instance
export const errorService = new ErrorService();

// Export helper functions
export function handleError(error: unknown, context?: string): AppError {
  return errorService.handleError(error, context);
}

export function createError(
  code: ErrorCode,
  context?: Record<string, unknown>,
  originalError?: Error
): AppError {
  return errorService.createError(code, context, originalError);
}

export function getUserMessage(error: unknown): string {
  return errorService.getUserMessage(error);
}

export function shouldShowRetry(error: AppError): boolean {
  return errorService.shouldShowRetry(error);
}
