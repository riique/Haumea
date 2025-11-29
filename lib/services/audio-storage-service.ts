/**
 * Audio Storage Service
 * 
 * Serviço para upload de áudio para Firebase Storage
 * Usado para transcrições de áudio que excedem o limite de payload
 */

import { ref, uploadBytes, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { logger } from '@/lib/utils/logger';

/**
 * Upload de áudio para Firebase Storage
 * @param audioBlob Blob do áudio gravado
 * @param userId ID do usuário
 * @returns Path do arquivo no Storage
 */
export async function uploadAudioToStorage(
  audioBlob: Blob,
  userId: string
): Promise<string> {
  try {
    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileName = `${timestamp}_${randomId}.webm`;
    const storagePath = `audio-transcriptions/${userId}/${fileName}`;

    // Criar referência no Storage
    const storageRef = ref(storage, storagePath);

    logger.log('Uploading audio to Storage...', {
      path: storagePath,
      size: audioBlob.size,
    });

    // Upload do áudio
    await uploadBytes(storageRef, audioBlob, {
      contentType: audioBlob.type || 'audio/webm',
      customMetadata: {
        userId,
        uploadedAt: new Date().toISOString(),
      },
    });

    logger.log('Audio uploaded successfully', { path: storagePath });

    return storagePath;
  } catch (error) {
    logger.error('Error uploading audio to Storage:', error);
    throw new Error('Falha ao fazer upload do áudio. Tente novamente.');
  }
}

/**
 * Deletar áudio do Storage (usado em caso de erro no frontend)
 * @param storagePath Path do arquivo no Storage
 */
export async function deleteAudioFromStorage(storagePath: string): Promise<void> {
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    logger.log('Audio deleted from Storage', { path: storagePath });
  } catch (error) {
    logger.warn('Error deleting audio from Storage:', error);
    // Não lançar erro, pois a limpeza automática cuidará disso
  }
}
