/**
 * Stats Service - Chat Statistics Calculation and Storage
 * 
 * Calculates and persists chat statistics to Firestore
 */

import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { Message, ChatStats } from '@/types/chat';

/**
 * Calcula estatísticas completas de um chat
 */
export function calculateChatStats(messages: Message[]): ChatStats {
  const totalMessages = messages.length;
  const userMessages = messages.filter((m) => m.role === 'user');
  const aiMessages = messages.filter((m) => m.role === 'assistant');

  // Caracteres
  const userCharacters = userMessages.reduce((sum, m) => sum + m.content.length, 0);
  const aiCharacters = aiMessages.reduce((sum, m) => sum + m.content.length, 0);
  const totalCharacters = userCharacters + aiCharacters;

  // Palavras
  const allWords = messages.map(m => m.content).join(' ').toLowerCase();
  const words = allWords.match(/\b[a-záàâãéêíóôõúçA-ZÁÀÂÃÉÊÍÓÔÕÚÇ]+\b/g) || [];
  const totalWords = words.length;

  // Frases (contando pontos finais, interrogações e exclamações)
  const totalSentences = messages.reduce((sum, m) => {
    const sentences = m.content.match(/[.!?]+/g);
    return sum + (sentences ? sentences.length : 1);
  }, 0);
  const avgSentencesPerMessage = totalMessages > 0 ? totalSentences / totalMessages : 0;

  // Tempo de leitura (assumindo 200 palavras por minuto)
  const estimatedReadingTimeMinutes = Math.ceil(totalWords / 200);

  // Frequência de palavras
  const wordFrequency: Record<string, number> = {};
  const stopWords = new Set([
    'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 
    'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 
    'ao', 'ele', 'das', 'tem', 'à', 'seu', 'sua', 'ou', 'ser', 'quando', 'muito', 
    'há', 'nos', 'já', 'está', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso', 
    'ela', 'entre', 'era', 'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem', 
    'nas', 'me', 'esse', 'eles', 'estão', 'você', 'tinha', 'foram', 'essa', 'num', 
    'nem', 'suas', 'meu', 'às', 'minha', 'têm', 'numa', 'pelos', 'elas', 'havia', 
    'seja', 'qual', 'será', 'nós', 'tenho', 'lhe', 'deles', 'essas', 'esses', 
    'pelas', 'este', 'fosse', 'dele', 'são', 'the', 'and', 'or', 'in', 'on', 'at',
    'to', 'for', 'of', 'with', 'from', 'by', 'is', 'was', 'be', 'been', 'being',
    'have', 'has', 'had', 'this', 'that', 'these', 'those', 'it', 'its', 'can',
    'could', 'would', 'should', 'may', 'might', 'must', 'will', 'shall'
  ]);

  words.forEach(word => {
    if (word.length > 3 && !stopWords.has(word)) {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    }
  });

  return {
    totalCharacters,
    userCharacters,
    aiCharacters,
    avgSentencesPerMessage,
    estimatedReadingTimeMinutes,
    wordFrequency,
    lastUpdated: new Date(),
  };
}

/**
 * Salva estatísticas do chat no Firestore
 */
export async function saveChatStats(
  userId: string,
  chatId: string,
  stats: ChatStats
): Promise<void> {
  const chatRef = doc(firestore, `users/${userId}/chats/${chatId}`);
  
  await updateDoc(chatRef, {
    stats: {
      ...stats,
      lastUpdated: Timestamp.now(),
    },
  });
}

/**
 * Calcula e salva estatísticas do chat (função combinada)
 */
export async function calculateAndSaveChatStats(
  userId: string,
  chatId: string,
  messages: Message[]
): Promise<ChatStats> {
  const stats = calculateChatStats(messages);
  await saveChatStats(userId, chatId, stats);
  return stats;
}

/**
 * Verifica se as estatísticas precisam ser recalculadas
 * (se foram atualizadas há mais de 1 hora ou não existem)
 */
export function shouldRecalculateStats(lastUpdated?: Date): boolean {
  if (!lastUpdated) return true;
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return lastUpdated < oneHourAgo;
}
