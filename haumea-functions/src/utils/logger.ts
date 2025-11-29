import { logger as functionsLogger } from 'firebase-functions';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDev = process.env.NODE_ENV === 'development';
  
  debug(message: string, context?: LogContext) {
    if (this.isDev) {
      functionsLogger.debug(message, context);
    }
  }
  
  info(message: string, context?: LogContext) {
    functionsLogger.info(message, context);
  }
  
  warn(message: string, context?: LogContext) {
    functionsLogger.warn(message, context);
  }
  
  error(message: string, error: Error | unknown, context?: LogContext) {
    functionsLogger.error(message, {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      ...context,
    });
  }
}

export const logger = new Logger();
