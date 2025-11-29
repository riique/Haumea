import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { auth } from '../config/firebase';

interface ToggleUserBlockData {
  adminPassword: string;
  userId: string;
  block: boolean;
}

// Senha de administrador - ALTERE ISSO!
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'haumea2025';

export const toggleUserBlock = onCall<ToggleUserBlockData>(
  {
    memory: '256MiB',
    timeoutSeconds: 10,
  },
  async (request) => {
    const { adminPassword, userId, block } = request.data;

    // Verificar autenticação
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    // Verificar senha de admin
    if (adminPassword !== ADMIN_PASSWORD) {
      throw new HttpsError('permission-denied', 'Senha de administrador incorreta');
    }

    if (!userId) {
      throw new HttpsError('invalid-argument', 'ID do usuário não fornecido');
    }

    try {
      // Bloquear/desbloquear usuário no Firebase Auth
      await auth.updateUser(userId, {
        disabled: block,
      });

      return { 
        success: true,
        message: block ? 'Usuário bloqueado com sucesso' : 'Usuário desbloqueado com sucesso'
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Erro ao atualizar status do usuário');
    }
  }
);
