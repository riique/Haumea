import { firestore, functions } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { FailedTranscription } from '@/types/chat';
import { logger } from '@/lib/utils/logger';

export function subscribeToFailedTranscriptions(
  userId: string,
  onUpdate: (transcriptions: FailedTranscription[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const failedTranscriptionsRef = collection(firestore, 'users', userId, 'failed-transcriptions');
    const q = query(failedTranscriptionsRef, orderBy('recordedAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const transcriptions: FailedTranscription[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId,
            storagePath: data.storagePath,
            audioFileName: data.audioFileName,
            audioDurationSeconds: data.audioDurationSeconds,
            errorMessage: data.errorMessage,
            errorType: data.errorType,
            recordedAt: data.recordedAt?.toDate() || new Date(),
            failedAt: data.failedAt?.toDate() || new Date(),
            retryCount: data.retryCount || 0,
            lastRetryAt: data.lastRetryAt?.toDate(),
            fileSize: data.fileSize || 0,
          };
        });

        onUpdate(transcriptions);
      },
      (error) => {
        logger.error('Error subscribing to failed transcriptions:', error);
        if (onError) {
          onError(error);
        }
      }
    );

    return unsubscribe;
  } catch (error) {
    logger.error('Error setting up failed transcriptions subscription:', error);
    if (onError && error instanceof Error) {
      onError(error);
    }
    return () => {};
  }
}

export async function retryTranscription(failedTranscriptionId: string): Promise<string> {
  try {
    const transcriptionManagerFn = httpsCallable<
      { action: 'retry'; failedTranscriptionId: string },
      { success: boolean; transcription: string }
    >(functions, 'transcriptionManager');

    const result = await transcriptionManagerFn({ 
      action: 'retry',
      failedTranscriptionId 
    });

    if (!result.data.success || !result.data.transcription) {
      throw new Error('Falha ao retentar transcrição');
    }

    logger.info('Retry transcription successful', { failedTranscriptionId });
    return result.data.transcription;
  } catch (error: unknown) {
    logger.error('Error retrying transcription:', error);
    
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = String(error.message);
      
      if (errorMessage.includes('not-found')) {
        throw new Error('Transcrição não encontrada. Pode ter sido deletada.');
      } else if (errorMessage.includes('timeout')) {
        throw new Error('Tempo esgotado. Tente novamente mais tarde.');
      } else if (errorMessage.includes('rate_limit') || errorMessage.includes('quota')) {
        throw new Error('Limite de requisições excedido. Aguarde alguns minutos.');
      } else if (errorMessage.includes('invalid_format')) {
        throw new Error('Formato de áudio não suportado.');
      } else {
        throw new Error(errorMessage || 'Erro ao processar transcrição');
      }
    }
    
    throw new Error('Erro desconhecido ao retentar transcrição');
  }
}

export async function deleteFailedTranscription(failedTranscriptionId: string): Promise<void> {
  try {
    const transcriptionManagerFn = httpsCallable<
      { action: 'deleteOne'; failedTranscriptionId: string },
      { success: boolean; message: string }
    >(functions, 'transcriptionManager');

    const result = await transcriptionManagerFn({ 
      action: 'deleteOne',
      failedTranscriptionId 
    });

    if (!result.data.success) {
      throw new Error('Falha ao deletar transcrição');
    }

    logger.info('Failed transcription deleted successfully', { failedTranscriptionId });
  } catch (error: unknown) {
    logger.error('Error deleting failed transcription:', error);
    
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = String(error.message);
      
      if (errorMessage.includes('not-found')) {
        throw new Error('Transcrição não encontrada.');
      } else {
        throw new Error(errorMessage || 'Erro ao deletar transcrição');
      }
    }
    
    throw new Error('Erro desconhecido ao deletar transcrição');
  }
}

export async function deleteAllFailedTranscriptions(userId: string): Promise<number> {
  try {
    const transcriptionManagerFn = httpsCallable<
      { action: 'deleteAll' },
      { success: boolean; deletedCount: number; message: string }
    >(functions, 'transcriptionManager');

    const result = await transcriptionManagerFn({ action: 'deleteAll' });

    if (!result.data.success) {
      throw new Error('Falha ao deletar transcrições');
    }

    logger.info('All failed transcriptions deleted successfully', { userId, count: result.data.deletedCount });
    return result.data.deletedCount;
  } catch (error: unknown) {
    logger.error('Error deleting all failed transcriptions:', error);
    
    if (error && typeof error === 'object' && 'message' in error) {
      throw new Error(String(error.message) || 'Erro ao deletar todas as transcrições');
    }
    
    throw new Error('Erro desconhecido ao deletar todas as transcrições');
  }
}
