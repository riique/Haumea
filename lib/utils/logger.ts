/**
 * Logger Customizado com Controle por Ambiente
 * 
 * - Em desenvolvimento: Logs completos
 * - Em produção: Apenas erros e warnings críticos
 * - Integração futura com Sentry/monitoring
 */

const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';

export type LogLevel = 'debug' | 'info' | 'log' | 'warn' | 'error';

interface LogContext {
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: unknown[];
}

// Buffer de logs para debugging em produção (últimos 100 logs)
const logBuffer: LogContext[] = [];
const MAX_LOG_BUFFER = 100;

function addToBuffer(level: LogLevel, message: string, data?: unknown[]) {
  if (isProd) {
    logBuffer.push({
      timestamp: Date.now(),
      level,
      message: String(message),
      data,
    });
    
    if (logBuffer.length > MAX_LOG_BUFFER) {
      logBuffer.shift();
    }
  }
}

export const logger = {
  /**
   * Debug: Apenas em desenvolvimento
   */
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug('[DEBUG]', ...args);
    }
    addToBuffer('debug', String(args[0]), args.slice(1));
  },
  
  /**
   * Info: Apenas em desenvolvimento
   */
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info('[INFO]', ...args);
    }
    addToBuffer('info', String(args[0]), args.slice(1));
  },
  
  /**
   * Log: Apenas em desenvolvimento
   */
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log('[LOG]', ...args);
    }
    addToBuffer('log', String(args[0]), args.slice(1));
  },
  
  /**
   * Warning: Em desenvolvimento e produção
   */
  warn: (...args: unknown[]) => {
    console.warn('[WARN]', ...args);
    addToBuffer('warn', String(args[0]), args.slice(1));
    
    // TODO: Enviar para monitoring em produção
    if (isProd) {
      // Sentry.captureMessage(String(args[0]), 'warning');
    }
  },
  
  /**
   * Error: Sempre logado e enviado para monitoring
   */
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args);
    addToBuffer('error', String(args[0]), args.slice(1));
    
    // TODO: Enviar para monitoring em produção
    if (isProd) {
      // Sentry.captureException(args[0]);
    }
  },
  
  /**
   * Obter buffer de logs (útil para debug em produção)
   */
  getLogBuffer: (): LogContext[] => {
    return [...logBuffer];
  },
  
  /**
   * Limpar buffer de logs
   */
  clearLogBuffer: () => {
    logBuffer.length = 0;
  },
};
