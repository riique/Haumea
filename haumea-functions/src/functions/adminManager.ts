import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, auth, storage } from '../config/firebase';
import { getAdminPassword } from '../utils/envValidator';
import { logger } from '../utils/logger';

// Obter senha de administrador das variáveis de ambiente
const ADMIN_PASSWORD = getAdminPassword();

type ActionType =
  | 'verifyAdminPassword'
  | 'listUsers'
  | 'toggleUserBlock'
  | 'deleteUserAccount'
  | 'getUsersWithCosts';

interface AdminManagerData {
  action: ActionType;
  adminPassword?: string;
  password?: string;
  code?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  block?: boolean;
}

export const adminManager = onCall<AdminManagerData>(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    const { action } = request.data;

    if (!action) {
      throw new HttpsError('invalid-argument', 'Ação não especificada');
    }

    try {
      switch (action) {
        case 'verifyAdminPassword':
          if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Usuário não autenticado');
          }
          return handleVerifyAdminPassword(request.data.password);

        case 'listUsers':
          if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Usuário não autenticado');
          }
          verifyAdminPassword(request.data.adminPassword);
          return await handleListUsers();

        case 'toggleUserBlock':
          if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Usuário não autenticado');
          }
          verifyAdminPassword(request.data.adminPassword);
          return await handleToggleUserBlock(request.data.userId, request.data.block);

        case 'deleteUserAccount':
          if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Usuário não autenticado');
          }
          verifyAdminPassword(request.data.adminPassword);
          return await handleDeleteUserAccount(request.data.userId);

        case 'getUsersWithCosts':
          if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Usuário não autenticado');
          }
          verifyAdminPassword(request.data.adminPassword);
          return await handleGetUsersWithCosts();

        default:
          throw new HttpsError('invalid-argument', `Ação inválida: ${action}`);
      }
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      throw new HttpsError('internal', errorMessage);
    }
  }
);

// ========== HELPER FUNCTIONS ==========

function verifyAdminPassword(password?: string): void {
  if (!password) {
    throw new HttpsError('invalid-argument', 'Senha de administrador não fornecida');
  }
  if (password !== ADMIN_PASSWORD) {
    throw new HttpsError('permission-denied', 'Senha de administrador incorreta');
  }
}


// ========== USER MANAGEMENT HANDLERS ==========

function handleVerifyAdminPassword(password?: string) {
  if (!password) {
    throw new HttpsError('invalid-argument', 'Senha não fornecida');
  }

  const isValid = password === ADMIN_PASSWORD;

  return { valid: isValid };
}

async function handleListUsers() {
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
}

async function handleToggleUserBlock(userId?: string, block?: boolean) {
  if (!userId) {
    throw new HttpsError('invalid-argument', 'ID do usuário não fornecido');
  }

  // Bloquear/desbloquear usuário no Firebase Auth
  await auth.updateUser(userId, {
    disabled: block,
  });

  return {
    success: true,
    message: block ? 'Usuário bloqueado com sucesso' : 'Usuário desbloqueado com sucesso'
  };
}

async function handleDeleteUserAccount(userId?: string) {
  if (!userId) {
    throw new HttpsError('invalid-argument', 'ID do usuário não fornecido');
  }

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
}

async function handleGetUsersWithCosts() {
  // Buscar todos os usuários
  const usersSnapshot = await db.collection('users').get();

  const usersWithCosts = await Promise.all(
    usersSnapshot.docs.map(async (doc) => {
      const userData = doc.data();

      // Buscar todos os chats do usuário
      const chatsSnapshot = await db
        .collection('users')
        .doc(doc.id)
        .collection('chats')
        .get();

      // Somar o totalCost de todos os chats (excluindo Personas e Debates)
      let totalCost = 0;
      let totalTokens = 0;
      let totalChats = 0;
      let totalMessages = 0;

      chatsSnapshot.docs.forEach((chatDoc) => {
        const chatData = chatDoc.data();
        
        // Excluir Personas e Debates da contagem
        if (chatData.isPersona || chatData.isDebate) {
          return;
        }
        
        totalChats++;
        totalCost += chatData.totalCost || 0;
        totalTokens += chatData.totalTokens || 0;
        totalMessages += chatData.messageCount || 0;
      });

      return {
        uid: doc.id,
        email: userData.email,
        displayName: userData.displayName,
        totalCost,
        totalTokens,
        totalChats,
        totalMessages,
        createdAt: userData.createdAt?.toDate?.()?.toISOString() || null,
      };
    })
  );

  // Ordenar por custo total (maior primeiro)
  usersWithCosts.sort((a, b) => b.totalCost - a.totalCost);

  return { users: usersWithCosts };
}
