import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { TooManyRequestsError } from '../utils/errors';

/**
 * Rate Limiter básico usando Map em memória
 * 
 * Em produção, considere usar Redis ou Firestore para rate limiting
 * distribuído entre múltiplas instâncias da Cloud Function
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// Armazenar contadores em memória
const rateLimitStore = new Map<string, RateLimitRecord>();

// Limpar registros expirados a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // 5 minutos

export interface RateLimitOptions {
  /**
   * Número máximo de requisições permitidas no período
   * @default 60
   */
  maxRequests?: number;
  
  /**
   * Janela de tempo em milissegundos
   * @default 60000 (1 minuto)
   */
  windowMs?: number;
  
  /**
   * Identificador customizado (ex: userId, IP)
   * Se não fornecido, usa userId do request ou IP
   */
  keyGenerator?: (req: Request) => string;
  
  /**
   * Mensagem de erro customizada
   */
  message?: string;
}

/**
 * Middleware de Rate Limiting
 * 
 * Limita o número de requisições por usuário/IP em um período de tempo
 * 
 * @example
 * ```ts
 * export const myFunction = onRequest(async (req, res) => {
 *   rateLimit(req, res, { maxRequests: 10, windowMs: 60000 });
 *   // ... resto da função
 * });
 * ```
 */
export function rateLimit(
  req: Request,
  res: Response,
  options: RateLimitOptions = {}
): void {
  const {
    maxRequests = 60,
    windowMs = 60000, // 1 minuto
    keyGenerator,
    message = 'Muitas requisições. Tente novamente mais tarde.',
  } = options;
  
  // Gerar chave única para o rate limit
  const key = keyGenerator 
    ? keyGenerator(req) 
    : (req.body?.userId || req.headers['x-forwarded-for'] || req.ip || 'anonymous');
  
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    // Criar novo registro
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    
    // Adicionar headers informativos
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - 1).toString());
    res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
    
    return;
  }
  
  // Incrementar contador
  record.count++;
  
  // Adicionar headers informativos
  res.setHeader('X-RateLimit-Limit', maxRequests.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count).toString());
  res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());
  
  // Verificar se excedeu o limite
  if (record.count > maxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter.toString());
    
    throw new TooManyRequestsError(message);
  }
}

/**
 * Rate limiter específico para chat
 * Limite mais generoso para permitir conversas longas
 */
export function rateLimitChat(req: Request, res: Response): void {
  rateLimit(req, res, {
    maxRequests: 100, // 100 mensagens por minuto
    windowMs: 60000, // 1 minuto
    keyGenerator: (r) => r.body?.userId || 'anonymous',
    message: 'Você está enviando mensagens muito rapidamente. Aguarde um momento.',
  });
}

/**
 * Rate limiter específico para autenticação
 * Limite mais restritivo para prevenir brute force
 */
export function rateLimitAuth(req: Request, res: Response): void {
  rateLimit(req, res, {
    maxRequests: 5, // 5 tentativas por minuto
    windowMs: 60000, // 1 minuto
    keyGenerator: (r) => {
      // Usar email + IP para rate limiting de auth
      const email = r.body?.email || 'anonymous';
      const ip = r.headers['x-forwarded-for'] || r.ip || 'unknown';
      return `${email}:${ip}`;
    },
    message: 'Muitas tentativas de login. Tente novamente em 1 minuto.',
  });
}

/**
 * Rate limiter para operações administrativas
 * Limite moderado para ações sensíveis
 */
export function rateLimitAdmin(req: Request, res: Response): void {
  rateLimit(req, res, {
    maxRequests: 30, // 30 operações por minuto
    windowMs: 60000, // 1 minuto
    keyGenerator: (r) => r.body?.userId || r.body?.adminPassword || 'anonymous',
    message: 'Muitas operações administrativas. Aguarde um momento.',
  });
}

/**
 * Rate limiter específico para transcrição de áudio
 * Limite moderado devido ao custo de processamento
 */
export function rateLimitTranscription(req: Request, res: Response): void {
  rateLimit(req, res, {
    maxRequests: 20, // 20 transcrições por minuto
    windowMs: 60000, // 1 minuto
    keyGenerator: (r) => r.body?.userId || 'anonymous',
    message: 'Você está transcrevendo áudios muito rapidamente. Aguarde um momento.',
  });
}
