import type { Response } from 'express';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export function handleError(error: unknown, res: Response) {
  logger.error('Request failed', error);
  
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
      },
    });
    return;
  }
  
  res.status(500).json({
    error: {
      message: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR',
    },
  });
}
