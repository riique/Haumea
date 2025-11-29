import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, auth } from '../config/firebase';

interface ListUsersData {
  adminPassword: string;
}

// Senha de administrador - ALTERE ISSO!
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'haumea2025';

export const listUsers = onCall<ListUsersData>(
  {
    memory: '512MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
    const { adminPassword } = request.data;

    // Verificar autenticação
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    // Verificar senha de admin
    if (adminPassword !== ADMIN_PASSWORD) {
      throw new HttpsError('permission-denied', 'Senha de administrador incorreta');
    }

    try {
      // Buscar todos os usuários do Firestore
      const usersSnapshot = await db.collection('users').get();
      
      const users = await Promise.all(
        usersSnapshot.docs.map(async (doc) => {
          const userData = doc.data();
          

          // Buscar informações de autenticação do usuário
          let authData = null;
          try {
            const userRecord = await auth.getUser(doc.id);
            authData = {
              disabled: userRecord.disabled,
              emailVerified: userRecord.emailVerified,
            };
          } catch (error) {
            // Usuário pode não existir no Auth
          }

          return {
            uid: doc.id,
            email: userData.email,
            displayName: userData.displayName,
            disabled: authData?.disabled || false,
            emailVerified: authData?.emailVerified || false,
            createdAt: userData.createdAt?.toDate?.()?.toISOString() || null,
          };
        })
      );

      return { users };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Erro ao listar usuários');
    }
  }
);
