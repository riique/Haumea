import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, storage } from '../config/firebase';
import { logger } from '../utils/logger';
import { FieldValue } from 'firebase-admin/firestore';

interface AcceptShareInviteData {
  inviteCode: string;
}

interface AcceptShareInviteResult {
  success: boolean;
  chatId: string;
  shareType: 'copy' | 'collaborative';
  chatName: string;
  message: string;
}

export const acceptShareInvite = onCall<AcceptShareInviteData>(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async (request): Promise<AcceptShareInviteResult> => {
    // Verificar autenticação
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    const { inviteCode } = request.data;
    const userId = request.auth.uid;
    const userEmail = request.auth.token.email || '';

    if (!inviteCode) {
      throw new HttpsError('invalid-argument', 'Código de convite não fornecido');
    }

    try {
      logger.info(`Processando convite: ${inviteCode} para usuário ${userId}`);

      // Buscar compartilhamento pelo código de convite
      const sharesSnapshot = await db
        .collection('sharedChats')
        .where('inviteCode', '==', inviteCode)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (sharesSnapshot.empty) {
        throw new HttpsError('not-found', 'Convite inválido ou expirado');
      }

      const shareDoc = sharesSnapshot.docs[0];
      const shareData = shareDoc.data();
      const shareId = shareDoc.id;

      // Verificar expiração
      if (shareData.expiresAt && shareData.expiresAt.toDate() < new Date()) {
        await shareDoc.ref.update({ isActive: false });
        throw new HttpsError('failed-precondition', 'Convite expirado');
      }

      // Verificar se o usuário já é membro
      if (shareData.members && shareData.members.includes(userId)) {
        throw new HttpsError('already-exists', 'Você já tem acesso a este chat');
      }

      // Verificar se o usuário não é o próprio dono
      if (shareData.ownerId === userId) {
        throw new HttpsError('failed-precondition', 'Você não pode aceitar seu próprio convite');
      }

      const shareType = shareData.shareType;
      const chatId = shareData.chatId;
      const ownerId = shareData.ownerId;
      const chatName = shareData.chatMetadata?.name || 'Chat Compartilhado';

      // Processar baseado no tipo de compartilhamento
      if (shareType === 'copy') {
        // Modo Cópia: Duplicar chat completo
        await duplicateChatForUser(ownerId, chatId, userId, userEmail, chatName);
        
        // Marcar compartilhamento como usado (one-time use para cópias)
        await shareDoc.ref.update({
          isActive: false,
          usedBy: userId,
          usedAt: FieldValue.serverTimestamp(),
        });

        logger.info(`Chat copiado com sucesso: ${chatId} de ${ownerId} para ${userId}`);

        return {
          success: true,
          chatId: chatId, // O novo chat terá um ID diferente, mas usamos este para referência
          shareType: 'copy',
          chatName,
          message: 'Chat copiado com sucesso! Você agora tem uma cópia independente.',
        };
      } else {
        // Modo Colaborativo: Adicionar usuário aos membros
        const shareRef = db.collection('sharedChats').doc(shareId);
        const shareDoc = await shareRef.get();

        if (!shareDoc.exists) {
          throw new HttpsError('not-found', 'Compartilhamento não encontrado');
        }

        const shareData = shareDoc.data();
        if (!shareData) {
          throw new HttpsError('internal', 'Dados de compartilhamento inválidos');
        }

        // Verificar se já é membro
        if (shareData.members && shareData.members.includes(userId)) {
          throw new HttpsError('already-exists', 'Você já tem acesso a este chat');
        }

        // Adicionar usuário aos membros
        await shareRef.update({
          members: FieldValue.arrayUnion(userId),
        });

        // Para chats colaborativos, não desativamos o share (pode ser usado por múltiplos usuários)
        // Apenas registramos que um novo membro foi adicionado
        logger.info(`Usuário ${userId} adicionado ao chat colaborativo ${chatId}`);

        return {
          success: true,
          chatId,
          shareType: 'collaborative',
          chatName,
          message: 'Acesso concedido! Você agora pode colaborar neste chat.',
        };
      }
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('Erro ao aceitar convite:', { error: error instanceof Error ? error.message : String(error) });
      throw new HttpsError('internal', 'Erro ao processar convite');
    }
  }
);

/**
 * Duplica chat completo para outro usuário (modo cópia)
 */
async function duplicateChatForUser(
  ownerId: string,
  chatId: string,
  targetUserId: string,
  targetUserEmail: string,
  chatName: string
): Promise<string> {
  try {
    // Buscar metadata do chat original
    const originalChatRef = db.collection('users').doc(ownerId).collection('chats').doc(chatId);
    const originalChatDoc = await originalChatRef.get();

    if (!originalChatDoc.exists) {
      throw new HttpsError('not-found', 'Chat original não encontrado');
    }

    const originalChatData = originalChatDoc.data();
    if (!originalChatData) {
      throw new HttpsError('internal', 'Dados do chat inválidos');
    }

    // Criar novo chat para o usuário destino
    const newChatRef = db.collection('users').doc(targetUserId).collection('chats').doc();
    const newChatId = newChatRef.id;

    // Preparar dados do novo chat (remover campos sensíveis)
    const newChatData = {
      ...originalChatData,
      name: `${chatName} (cópia)`,
      password: null, // Remover senha
      createdAt: FieldValue.serverTimestamp(),
      lastMessageAt: FieldValue.serverTimestamp(),
      isSharedCopy: true, // Marcar como cópia compartilhada
      originalOwnerId: ownerId, // Referência ao dono original
      originalChatId: chatId, // Referência ao chat original
    };

    await newChatRef.set(newChatData);

    // Copiar mensagens do Storage
    try {
      const originalMessagesPath = `users/${ownerId}/chats/${chatId}/messages.json`;
      const newMessagesPath = `users/${targetUserId}/chats/${newChatId}/messages.json`;

      // Baixar mensagens originais
      const [messagesBuffer] = await storage.bucket().file(originalMessagesPath).download();
      const messagesData = messagesBuffer.toString('utf-8');

      // Upload para novo local
      await storage.bucket().file(newMessagesPath).save(messagesData, {
        contentType: 'application/json',
        metadata: {
          metadata: {
            copiedFrom: originalMessagesPath,
            copiedAt: new Date().toISOString(),
          },
        },
      });

      logger.info(`Mensagens copiadas: ${originalMessagesPath} -> ${newMessagesPath}`);
    } catch (storageError) {
      logger.warn('Erro ao copiar mensagens, criando chat vazio:', { error: storageError instanceof Error ? storageError.message : String(storageError) });
      // Se não conseguir copiar mensagens, criar chat vazio
      const emptyMessages = JSON.stringify([]);
      const newMessagesPath = `users/${targetUserId}/chats/${newChatId}/messages.json`;
      await storage.bucket().file(newMessagesPath).save(emptyMessages, {
        contentType: 'application/json',
      });
    }

    logger.info(`Chat duplicado: ${chatId} -> ${newChatId} para usuário ${targetUserId}`);
    return newChatId;
  } catch (error) {
    logger.error('Erro ao duplicar chat:', { error: error instanceof Error ? error.message : String(error) });
    throw new HttpsError('internal', 'Erro ao copiar chat');
  }
}
