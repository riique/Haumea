import type { CallableRequest } from 'firebase-functions/v2/https';
import { auth as firebaseAuth } from '../config/firebase';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';
import { getAdminPassword } from '../utils/envValidator';

/**
 * Middleware de autenticação para Cloud Functions
 * 
 * Verifica se o usuário está autenticado e opcionalmente valida claims customizadas
 */

export interface AuthOptions {
  /**
   * Requer que o usuário seja administrador
   */
  requireAdmin?: boolean;
  
  /**
   * Claims customizadas requeridas
   */
  requiredClaims?: Record<string, unknown>;
}

/**
 * Verifica autenticação do usuário
 * 
 * @param request - Request da Cloud Function
 * @param options - Opções de autenticação
 * @throws {UnauthorizedError} Se não autenticado
 * @throws {ForbiddenError} Se não tem permissões necessárias
 */
export async function requireAuth(
  request: CallableRequest,
  options: AuthOptions = {}
): Promise<void> {
  // Verificar se usuário está autenticado
  if (!request.auth) {
    logger.warn('Tentativa de acesso não autenticada');
    throw new UnauthorizedError('Usuário não autenticado');
  }
  
  const { requireAdmin, requiredClaims } = options;
  
  // Verificar se é admin (se requerido)
  if (requireAdmin) {
    const userRecord = await firebaseAuth.getUser(request.auth.uid);
    const isAdmin = userRecord.customClaims?.admin === true;
    
    if (!isAdmin) {
      logger.warn('Tentativa de acesso administrativo sem permissão', {
        userId: request.auth.uid,
        email: userRecord.email,
      });
      throw new ForbiddenError('Acesso restrito a administradores');
    }
  }
  
  // Verificar claims customizadas (se requeridas)
  if (requiredClaims) {
    const userRecord = await firebaseAuth.getUser(request.auth.uid);
    const userClaims = userRecord.customClaims || {};
    
    for (const [claim, value] of Object.entries(requiredClaims)) {
      if (userClaims[claim] !== value) {
        logger.warn('Usuário não tem claim necessária', {
          userId: request.auth.uid,
          requiredClaim: claim,
          requiredValue: value,
          actualValue: userClaims[claim],
        });
        throw new ForbiddenError(`Permissão insuficiente: ${claim}`);
      }
    }
  }
  
  logger.debug('Autenticação verificada com sucesso', {
    userId: request.auth.uid,
  });
}

/**
 * Verifica se usuário tem permissão para acessar recurso de outro usuário
 * 
 * @param request - Request da Cloud Function
 * @param resourceUserId - ID do usuário dono do recurso
 * @param allowAdmin - Se true, administradores podem acessar recursos de outros usuários
 * @throws {ForbiddenError} Se não tem permissão
 */
export async function requireResourceAccess(
  request: CallableRequest,
  resourceUserId: string,
  allowAdmin: boolean = true
): Promise<void> {
  if (!request.auth) {
    throw new UnauthorizedError('Usuário não autenticado');
  }
  
  // Usuário pode acessar seus próprios recursos
  if (request.auth.uid === resourceUserId) {
    return;
  }
  
  // Verificar se é admin (se permitido)
  if (allowAdmin) {
    const userRecord = await firebaseAuth.getUser(request.auth.uid);
    const isAdmin = userRecord.customClaims?.admin === true;
    
    if (isAdmin) {
      logger.info('Administrador acessando recurso de outro usuário', {
        adminId: request.auth.uid,
        resourceUserId,
      });
      return;
    }
  }
  
  // Usuário não tem permissão
  logger.warn('Tentativa de acesso não autorizado a recurso', {
    userId: request.auth.uid,
    resourceUserId,
  });
  throw new ForbiddenError('Você não tem permissão para acessar este recurso');
}

/**
 * Verifica senha administrativa
 * 
 * IMPORTANTE: Em produção, use um sistema de autenticação mais robusto
 * com hash de senhas e tokens de sessão
 * 
 * @param providedPassword - Senha fornecida
 * @throws {UnauthorizedError} Se senha incorreta
 */
export function verifyAdminPassword(providedPassword?: string): void {
  const ADMIN_PASSWORD = getAdminPassword();
  
  if (!providedPassword) {
    logger.warn('Tentativa de acesso admin sem senha');
    throw new UnauthorizedError('Senha de administrador não fornecida');
  }
  
  if (providedPassword !== ADMIN_PASSWORD) {
    logger.warn('Tentativa de acesso admin com senha incorreta');
    throw new UnauthorizedError('Senha de administrador incorreta');
  }
  
  logger.debug('Senha administrativa verificada com sucesso');
}

/**
 * Valida que o usuário está autenticado e retorna o userId
 * 
 * @param request - Request da Cloud Function
 * @returns userId do usuário autenticado
 * @throws {UnauthorizedError} Se não autenticado
 */
export function getAuthenticatedUserId(request: CallableRequest): string {
  if (!request.auth) {
    throw new UnauthorizedError('Usuário não autenticado');
  }
  
  return request.auth.uid;
}
