import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, auth, storage } from '../config/firebase';
import { logger } from '../utils/logger';
import { getAdminPassword } from '../utils/envValidator';

interface DeleteUserAccountData {
  adminPassword: string;
  userId: string;
}

// Obter senha de administrador das variáveis de ambiente
const ADMIN_PASSWORD = getAdminPassword();

export const deleteUserAccount = onCall<DeleteUserAccountData>(
  {
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    const { adminPassword, userId } = request.data;

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
      // 1. Verificar se o usuário existe
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'Usuário não encontrado');
      }

      // 2. Deletar subcoleções do usuário em batches (Firestore limita 500 operações por batch)
      const deleteCollection = async (collectionName: string) => {
        const snapshot = await db.collection('users').doc(userId).collection(collectionName).get();
        
        if (snapshot.empty) {
          return;
        }

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      };

      await deleteCollection('chats');
      await deleteCollection('folders');
      await deleteCollection('tags');
      await deleteCollection('endpoints');

      // 3. Deletar arquivos do Storage
      try {
        const bucket = storage.bucket();
        const [files] = await bucket.getFiles({ prefix: `users/${userId}/` });
        
        if (files.length > 0) {
          await Promise.all(files.map(file => file.delete()));
        }
      } catch (storageError) {
        logger.error('Erro ao deletar arquivos do storage', { userId, error: storageError });
        // Continuar mesmo se houver erro no storage
      }

      // 4. Deletar usuário do Firebase Auth ANTES do documento (para não perder referência)
      try {
        await auth.deleteUser(userId);
      } catch (error) {
        // Se o usuário já não existe no Auth, continuar
        const authError = error as { code?: string; message?: string };
        if (authError.code !== 'auth/user-not-found') {
          logger.error('Erro ao deletar do Auth', { userId, error: authError });
          throw error;
        }
      }

      // 5. Deletar documento do usuário (por último, para garantir que tudo foi deletado)
      await db.collection('users').doc(userId).delete();

      logger.info('Conta excluída com sucesso', { userId });

      return { 
        success: true,
        message: 'Conta excluída com sucesso'
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('Erro ao deletar conta', { userId, error });
      throw new HttpsError('internal', `Erro ao deletar conta do usuário: ${errorMessage}`);
    }
  }
);
