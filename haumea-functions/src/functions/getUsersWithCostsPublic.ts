import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

// Função auxiliar para calcular estatísticas de todos os usuários
async function calculateLeaderboardData() {
  try {
    logger.info('Iniciando cálculo do leaderboard...');
    
    // Buscar todos os usuários
    const usersSnapshot = await db.collection('users').get();
    logger.info(`Processando ${usersSnapshot.size} usuários`);

    const usersWithCosts = await Promise.all(
      usersSnapshot.docs.map(async (doc) => {
        const userData = doc.data();

        // Buscar todos os chats do usuário
        const chatsSnapshot = await db
          .collection('users')
          .doc(doc.id)
          .collection('chats')
          .get();

        // Somar o totalCost de todos os chats e contar modelos
        let totalCost = 0;
        let totalTokens = 0;
        let totalChats = chatsSnapshot.size;
        let totalMessages = 0;
        const modelCount: Record<string, number> = {};

        chatsSnapshot.docs.forEach((chatDoc) => {
          const chatData = chatDoc.data();
          totalCost += chatData.totalCost || 0;
          totalTokens += chatData.totalTokens || 0;
          totalMessages += chatData.messageCount || 0;
          
          // Contar uso de modelos
          const model = chatData.selectedModel || chatData.model || 'Desconhecido';
          modelCount[model] = (modelCount[model] || 0) + 1;
        });

        // Encontrar modelo mais usado
        let mostUsedModel = 'N/A';
        let maxCount = 0;
        Object.entries(modelCount).forEach(([model, count]) => {
          if (count > maxCount) {
            maxCount = count;
            mostUsedModel = model;
          }
        });

        // Calcular custo médio por mensagem
        const avgCostPerMessage = totalMessages > 0 ? totalCost / totalMessages : 0;

        return {
          uid: doc.id,
          email: userData.email,
          displayName: userData.displayName,
          totalCost,
          totalTokens,
          totalChats,
          totalMessages,
          mostUsedModel,
          avgCostPerMessage,
        };
      })
    );

    // Ordenar por custo total (maior primeiro)
    usersWithCosts.sort((a, b) => b.totalCost - a.totalCost);

    // Salvar no Firestore
    await db.collection('system').doc('leaderboard').set({
      data: usersWithCosts,
      lastUpdated: FieldValue.serverTimestamp(),
    });

    logger.info('Leaderboard atualizado com sucesso');
    return usersWithCosts;
  } catch (error) {
    logger.error('Erro ao calcular leaderboard:', error);
    throw error;
  }
}

// Função scheduled que roda todos os dias às 4h da manhã (horário de Brasília)
export const updateLeaderboardScheduled = onSchedule(
  {
    schedule: '0 4 * * *', // Cron: todos os dias às 4:00 AM
    timeZone: 'America/Sao_Paulo',
    memory: '512MiB',
    timeoutSeconds: 540, // 9 minutos
  },
  async () => {
    logger.info('Executando atualização agendada do leaderboard às 4 h da manhã');
    await calculateLeaderboardData();
  }
);

// Função pública para ler o leaderboard (muito mais rápida - apenas 1 leitura!)
export const getUsersWithCostsPublic = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 10,
  },
  async (request) => {
    // Require authentication - any logged in user can view the leaderboard
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    try {
      // Ler do cache (apenas 1 leitura do Firestore!)
      const leaderboardDoc = await db.collection('system').doc('leaderboard').get();

      if (!leaderboardDoc.exists) {
        // Primeira vez - calcular e salvar
        logger.info('Leaderboard não existe, calculando pela primeira vez...');
        const users = await calculateLeaderboardData();
        return { users, lastUpdated: new Date().toISOString() };
      }

      const data = leaderboardDoc.data();
      return { 
        users: data?.data || [],
        lastUpdated: data?.lastUpdated?.toDate?.()?.toISOString() || null
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('Erro ao buscar leaderboard:', errorMessage);
      throw new HttpsError('internal', errorMessage);
    }
  }
);
