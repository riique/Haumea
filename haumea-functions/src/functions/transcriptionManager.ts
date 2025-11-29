import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from '../utils/logger';
import { getTranscriptionApiKey } from '../utils/apiKeyManager';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { FailedTranscription } from '../types/transcription';

const TRANSCRIPTION_SYSTEM_PROMPT = `Você é um sistema profissional de transcrição de áudio. Sua tarefa é transcrever com precisão o conteúdo de áudio fornecido pelo usuário.

Diretrizes:
- Transcreva exatamente o que é falado, preservando o idioma original
- Suporte todos os idiomas (Português, Inglês, Espanhol, Francês, Chinês, Japonês, etc.)
- Mantenha pontuação e formatação naturais
- Não traduza - mantenha o idioma original
- Não adicione comentários, explicações ou contexto adicional
- Se múltiplos falantes forem detectados, indique com "Falante 1:", "Falante 2:". Caso seja apenas um falante, não indique.
- Para áudio não claro, use marcadores [inaudível]
- Preserve contexto emocional quando relevante (ex: [rindo], [suspira])

Regras de Formatação:
- Divida em parágrafos quando houver mudança de tópico ou pausas longas
- Mantenha capitalização consistente para nomes próprios, siglas e início de frases
- Converta números falados para formato numérico quando apropriado (ex: "vinte e três" → "23")
- Formate datas e horários usando o padrão brasileiro (DD/MM/AAAA, HH:MM)
- Formate corretamente siglas e iniciais em maiúsculas (ex: IA, API, CEO, CNPJ)
- Capitalize adequadamente nomes de marcas e produtos conforme são comumente escritos
- Aplique correção gramatical leve para erros óbvios, preservando padrões de fala natural
- Preserve repetições intencionais quando fazem parte de ênfase (ex: "muito, muito bom")

Qualidade:
- Priorize precisão sobre velocidade - a precisão é crítica
- Marque frases incompletas com "..." quando elas se interrompem
- Use o contexto para desambiguar homófonos e palavras de som semelhante

Retorne APENAS o texto transcrito, nada mais.`;

type TranscriptionManagerAction = 'transcribe' | 'retry' | 'deleteOne' | 'deleteAll';

interface TranscriptionManagerData {
  action: TranscriptionManagerAction;
  failedTranscriptionId?: string;
  userId?: string;
  audioBase64?: string;
  storagePath?: string;
  model?: string;
  audioDurationSeconds?: number;
  fileSize?: number;
  recordedAt?: string;
}

function getValidGeminiModel(requestedModel: string): string {
  let cleanModel = requestedModel.replace('google/', '');
  
  const validModels = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ];

  if (validModels.includes(cleanModel)) {
    if (requestedModel !== cleanModel) {
      logger.info(`Removido prefixo 'google/' do modelo: ${requestedModel} -> ${cleanModel}`);
    }
    logger.info(`Usando modelo Gemini: ${cleanModel}`);
    return cleanModel;
  }

  logger.warn(`Modelo desconhecido: ${cleanModel}, tentando usar como está`);
  return cleanModel;
}

async function transcribeWithGemini(
  audioData: string,
  apiKey: string,
  model: string
): Promise<string> {
  const validModel = getValidGeminiModel(model);
  try {
    const url = `https://generativelanguage.googleapis.com/v1/models/${validModel}:generateContent?key=${apiKey}`;
    
    logger.info('Tentando transcrição com Gemini', {
      requestedModel: model,
      actualModel: validModel,
      modelChanged: model !== validModel,
      audioDataLength: audioData.length,
      url: url.replace(apiKey, 'REDACTED'),
    });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: TRANSCRIPTION_SYSTEM_PROMPT + '\n\nPor favor, transcreva este áudio com precisão, preservando o idioma original.',
              },
              {
                inline_data: {
                  mime_type: 'audio/wav',
                  data: audioData,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 125000,
        },
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('Erro na resposta do Gemini:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        fullError: JSON.stringify(errorData),
        model,
      });
      
      const errorMessage = errorData.error?.message || errorData.message || 'Erro ao transcrever áudio com Gemini. Tente novamente.';
      
      if (errorMessage.includes('not a valid model') || errorMessage.includes('invalid model')) {
        throw new HttpsError(
          'invalid-argument',
          `O modelo "${model}" não está disponível na API do Gemini. Por favor, selecione "gemini-1.5-flash" ou "gemini-1.5-pro" nas configurações.`
        );
      }
      
      throw new HttpsError(
        'internal',
        `Gemini API Error: ${errorMessage}`
      );
    }
    
    const responseData = await response.json();
    
    logger.info('Gemini response received', {
      hasCandidates: !!responseData.candidates,
      candidatesLength: responseData.candidates?.length || 0,
    });
    
    const transcription = responseData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!transcription || transcription.trim().length === 0) {
      logger.error('Empty transcription returned from Gemini', {
        responseData: JSON.stringify(responseData),
      });
      throw new HttpsError(
        'internal',
        'Nenhuma transcrição foi retornada pelo Gemini. O áudio pode estar vazio ou o modelo não conseguiu processar.'
      );
    }
    
    return transcription.trim();
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error('Erro ao transcrever com Gemini:', error);
    throw new HttpsError('internal', 'Erro ao processar transcrição com Gemini');
  }
}

async function retryTranscription(userId: string, failedTranscriptionId: string) {
  const db = admin.firestore();
  const docRef = db.collection('users').doc(userId).collection('failed-transcriptions').doc(failedTranscriptionId);
  
  const docSnap = await docRef.get();
  
  if (!docSnap.exists) {
    throw new HttpsError('not-found', 'Transcrição com falha não encontrada');
  }

  const failedData = docSnap.data() as FailedTranscription;

  if (failedData.userId !== userId) {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  logger.info('Retrying failed transcription', {
    userId,
    failedTranscriptionId,
    storagePath: failedData.storagePath,
    previousRetryCount: failedData.retryCount,
  });

  const bucket = admin.storage().bucket();
  const file = bucket.file(failedData.storagePath);

  const [exists] = await file.exists();
  if (!exists) {
    await docRef.delete();
    throw new HttpsError('not-found', 'Arquivo de áudio não encontrado no Storage. O áudio pode ter sido deletado.');
  }

  const [fileBuffer] = await file.download();
  const audioData = fileBuffer.toString('base64');

  logger.info('Audio downloaded for retry', {
    storagePath: failedData.storagePath,
    audioSize: fileBuffer.length,
  });

  const userDoc = await db.collection('users').doc(userId).get();
  const userProfile = userDoc.data();
  const model = userProfile?.transcriptionModel || 'gemini-1.5-flash';

  const geminiKeyData = await getTranscriptionApiKey(userId, 'gemini');
  
  if (!geminiKeyData) {
    throw new HttpsError(
      'failed-precondition',
      'Configure uma API Key do Gemini nas configurações para transcrever áudio.'
    );
  }

  logger.info('Retrying transcription with Gemini', { keyId: geminiKeyData.keyId, model });
  
  try {
    const transcription = await transcribeWithGemini(audioData, geminiKeyData.apiKey, model);
    
    logger.info('Retry transcription successful', {
      userId,
      failedTranscriptionId,
      transcriptionLength: transcription.length,
    });

    await file.delete();
    logger.info('Audio deleted after successful retry', {
      storagePath: failedData.storagePath,
    });

    await docRef.delete();
    logger.info('Failed transcription document deleted after success', {
      failedTranscriptionId,
    });

    return {
      success: true,
      transcription: transcription.trim(),
    };

  } catch (transcriptionError) {
    logger.error('Retry transcription failed', {
      error: transcriptionError,
      userId,
      failedTranscriptionId,
    });

    let errorType: FailedTranscription['errorType'] = 'unknown';
    let errorMessage = 'Erro desconhecido ao processar transcrição';
    
    if (transcriptionError instanceof HttpsError) {
      errorMessage = transcriptionError.message;
      
      switch (transcriptionError.code) {
        case 'deadline-exceeded':
          errorType = 'timeout';
          break;
        case 'resource-exhausted':
          errorType = 'rate_limit';
          break;
        case 'invalid-argument':
          errorType = 'invalid_format';
          break;
        case 'unavailable':
        case 'internal':
          errorType = 'api_error';
          break;
        default:
          errorType = 'unknown';
      }
    } else if (transcriptionError instanceof Error) {
      errorMessage = transcriptionError.message;
      
      if (errorMessage.toLowerCase().includes('timeout')) {
        errorType = 'timeout';
      } else if (errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('quota')) {
        errorType = 'rate_limit';
      } else if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch')) {
        errorType = 'network_error';
      } else {
        errorType = 'api_error';
      }
    }

    await docRef.update({
      retryCount: (failedData.retryCount || 0) + 1,
      lastRetryAt: Timestamp.now(),
      errorMessage,
      errorType,
    });

    logger.info('Failed transcription document updated with new error', {
      failedTranscriptionId,
      newRetryCount: (failedData.retryCount || 0) + 1,
      errorType,
    });

    throw transcriptionError;
  }
}

async function deleteFailedTranscription(userId: string, failedTranscriptionId: string) {
  const db = admin.firestore();
  const docRef = db.collection('users').doc(userId).collection('failed-transcriptions').doc(failedTranscriptionId);
  
  const docSnap = await docRef.get();
  
  if (!docSnap.exists) {
    throw new HttpsError('not-found', 'Transcrição com falha não encontrada');
  }

  const failedData = docSnap.data() as FailedTranscription;

  if (failedData.userId !== userId) {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  logger.info('Deleting failed transcription', {
    userId,
    failedTranscriptionId,
    storagePath: failedData.storagePath,
  });

  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(failedData.storagePath);
    
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      logger.info('Audio file deleted from Storage', {
        storagePath: failedData.storagePath,
      });
    } else {
      logger.warn('Audio file not found in Storage (already deleted?)', {
        storagePath: failedData.storagePath,
      });
    }
  } catch (storageError) {
    logger.error('Error deleting audio from Storage (non-critical)', {
      storagePath: failedData.storagePath,
      error: storageError,
    });
  }

  await docRef.delete();
  logger.info('Failed transcription document deleted', {
    failedTranscriptionId,
  });

  return {
    success: true,
    message: 'Transcrição com falha deletada com sucesso',
  };
}

async function deleteAllFailedTranscriptions(userId: string) {
  logger.info('Deleting all failed transcriptions for user', { userId });

  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  
  const snapshot = await db
    .collection('users')
    .doc(userId)
    .collection('failed-transcriptions')
    .get();

  if (snapshot.empty) {
    return {
      success: true,
      deletedCount: 0,
      message: 'Nenhuma transcrição com falha encontrada',
    };
  }

  const batch = db.batch();
  let deletedCount = 0;
  const storageDeletionPromises: Promise<void>[] = [];

  for (const doc of snapshot.docs) {
    const failedData = doc.data() as FailedTranscription;
    
    storageDeletionPromises.push(
      (async () => {
        try {
          const file = bucket.file(failedData.storagePath);
          const [exists] = await file.exists();
          if (exists) {
            await file.delete();
            logger.info('Audio file deleted from Storage', {
              storagePath: failedData.storagePath,
            });
          }
        } catch (storageError) {
          logger.error('Error deleting audio from Storage (non-critical)', {
            storagePath: failedData.storagePath,
            error: storageError,
          });
        }
      })()
    );

    batch.delete(doc.ref);
    deletedCount++;
  }

  await Promise.all(storageDeletionPromises);
  
  await batch.commit();

  logger.info('All failed transcriptions deleted', {
    userId,
    deletedCount,
  });

  return {
    success: true,
    deletedCount,
    message: `${deletedCount} transcrição(ões) deletada(s) com sucesso`,
  };
}

async function transcribeAudio(
  userId: string,
  audioBase64: string | undefined,
  storagePath: string | undefined,
  model: string,
  audioDurationSeconds: number | undefined,
  fileSize: number | undefined,
  recordedAt: string | undefined
) {
  const isFromStorage = !!storagePath;

  try {
    if (!userId || (!audioBase64 && !storagePath) || !model) {
      throw new HttpsError('invalid-argument', 'Dados inválidos: userId, (audioBase64 ou storagePath) e model são obrigatórios');
    }

    let audioData: string;

    if (storagePath) {
      logger.info('Transcription request via Storage', {
        userId,
        model,
        storagePath,
      });

      try {
        if (!storagePath.startsWith(`audio-transcriptions/${userId}/`)) {
          throw new HttpsError('permission-denied', 'Acesso negado ao arquivo de áudio.');
        }

        const bucket = admin.storage().bucket();
        const file = bucket.file(storagePath);

        const [exists] = await file.exists();
        if (!exists) {
          throw new HttpsError('not-found', 'Arquivo de áudio não encontrado no Storage.');
        }

        const [fileBuffer] = await file.download();
        audioData = fileBuffer.toString('base64');

        logger.info('Audio downloaded from Storage', {
          storagePath,
          audioSize: fileBuffer.length,
        });
      } catch (error) {
        logger.error('Error downloading audio from Storage:', error);
        if (error instanceof HttpsError) {
          throw error;
        }
        throw new HttpsError('internal', 'Erro ao baixar áudio do Storage.');
      }
    } else if (audioBase64) {
      audioData = audioBase64;
      logger.info('Transcription request via base64 (legacy method)', {
        userId,
        model,
        audioSizeKB: Math.round((audioBase64?.length || 0) / 1024),
      });
    } else {
      throw new HttpsError('invalid-argument', 'audioBase64 ou storagePath é obrigatório');
    }

    const audioSizeKB = Math.round(audioData.length / 1024);
    const audioSizeMB = audioSizeKB / 1024;
    
    logger.info('Processando transcrição de áudio', {
      userId,
      model,
      audioSizeKB,
      audioSizeMB: audioSizeMB.toFixed(2),
    });

    const geminiKeyData = await getTranscriptionApiKey(userId, 'gemini');
    
    if (!geminiKeyData) {
      throw new HttpsError(
        'failed-precondition',
        'Configure uma API Key do Gemini nas configurações para transcrever áudio.'
      );
    }

    logger.info('Usando Gemini API', { keyId: geminiKeyData.keyId, model });
    
    const transcription = await transcribeWithGemini(audioData, geminiKeyData.apiKey, model);
    
    logger.info('Transcrição com Gemini concluída com sucesso', {
      userId,
      transcriptionLength: transcription.length,
    });

    if (isFromStorage && storagePath) {
      try {
        const bucket = admin.storage().bucket();
        await bucket.file(storagePath).delete();
        logger.info('Audio deleted from Storage after successful transcription', {
          storagePath,
        });
      } catch (deleteError) {
        logger.warn('Failed to delete audio from Storage (non-critical)', {
          storagePath,
          error: deleteError,
        });
      }
    }

    return {
      success: true,
      transcription: transcription.trim(),
    };

  } catch (error) {
    logger.error('Erro ao processar transcrição', { error, userId });
    
    let failedTranscriptionId: string | undefined;
    
    if (isFromStorage && storagePath) {
      try {
        const db = admin.firestore();
        
        let errorType: FailedTranscription['errorType'] = 'unknown';
        let errorMessage = 'Erro desconhecido ao processar transcrição';
        
        if (error instanceof HttpsError) {
          errorMessage = error.message;
          
          switch (error.code) {
            case 'deadline-exceeded':
              errorType = 'timeout';
              break;
            case 'resource-exhausted':
              errorType = 'rate_limit';
              break;
            case 'invalid-argument':
              errorType = 'invalid_format';
              break;
            case 'unavailable':
            case 'internal':
              errorType = 'api_error';
              break;
            default:
              errorType = 'unknown';
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
          
          if (errorMessage.toLowerCase().includes('timeout')) {
            errorType = 'timeout';
          } else if (errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('quota')) {
            errorType = 'rate_limit';
          } else if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch')) {
            errorType = 'network_error';
          } else {
            errorType = 'api_error';
          }
        }
        
        const audioFileName = storagePath.split('/').pop() || 'audio.wav';
        
        let actualFileSize = fileSize;
        let actualDuration = audioDurationSeconds;
        
        if (!actualFileSize) {
          try {
            const bucket = admin.storage().bucket();
            const file = bucket.file(storagePath);
            const [metadata] = await file.getMetadata();
            actualFileSize = parseInt(String(metadata.size || '0'), 10);
            
            if (metadata.metadata?.duration) {
              actualDuration = parseFloat(String(metadata.metadata.duration));
            }
          } catch (metadataError) {
            logger.warn('Failed to get file metadata', { error: metadataError });
            actualFileSize = 0;
          }
        }
        
        const failedTranscription: Omit<FailedTranscription, 'id'> = {
          userId,
          storagePath,
          audioFileName,
          audioDurationSeconds: actualDuration,
          errorMessage,
          errorType,
          recordedAt: recordedAt ? Timestamp.fromDate(new Date(recordedAt)) : Timestamp.now(),
          failedAt: Timestamp.now(),
          retryCount: 0,
          fileSize: actualFileSize || 0,
        };
        
        const docRef = await db.collection('users').doc(userId).collection('failed-transcriptions').add(failedTranscription);
        failedTranscriptionId = docRef.id;
        
        logger.info('Audio preserved and metadata saved to Firestore', {
          storagePath,
          failedTranscriptionId,
          errorType,
          errorMessage: errorMessage.substring(0, 100),
        });
      } catch (firestoreError) {
        logger.error('Failed to save failed transcription metadata to Firestore', {
          storagePath,
          error: firestoreError,
        });
      }
    }
    
    if (error instanceof HttpsError) {
      const enhancedMessage = failedTranscriptionId 
        ? `${error.message}|PRESERVED|${failedTranscriptionId}`
        : error.message;
      
      throw new HttpsError(error.code, enhancedMessage);
    }
    
    const enhancedMessage = failedTranscriptionId
      ? `Erro ao processar transcrição de áudio|PRESERVED|${failedTranscriptionId}`
      : 'Erro ao processar transcrição de áudio';
    
    throw new HttpsError('internal', enhancedMessage);
  }
}

export const transcriptionManager = onCall<TranscriptionManagerData>(
  {
    region: 'us-central1',
    memory: '2GiB',
    timeoutSeconds: 900,
    concurrency: 20,
  },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Usuário não autenticado');
      }

      const { action, failedTranscriptionId, audioBase64, storagePath, model, audioDurationSeconds, fileSize, recordedAt } = request.data;
      const userId = request.data.userId || request.auth.uid;

      if (!action) {
        throw new HttpsError('invalid-argument', 'Ação é obrigatória');
      }

      switch (action) {
        case 'transcribe':
          if (!model) {
            throw new HttpsError('invalid-argument', 'Modelo é obrigatório para transcribe');
          }
          return await transcribeAudio(userId, audioBase64, storagePath, model, audioDurationSeconds, fileSize, recordedAt);

        case 'retry':
          if (!failedTranscriptionId) {
            throw new HttpsError('invalid-argument', 'ID da transcrição com falha é obrigatório para retry');
          }
          return await retryTranscription(userId, failedTranscriptionId);

        case 'deleteOne':
          if (!failedTranscriptionId) {
            throw new HttpsError('invalid-argument', 'ID da transcrição com falha é obrigatório para deleteOne');
          }
          return await deleteFailedTranscription(userId, failedTranscriptionId);

        case 'deleteAll':
          return await deleteAllFailedTranscriptions(userId);

        default:
          throw new HttpsError('invalid-argument', 'Ação inválida');
      }

    } catch (error) {
      logger.error('Error in transcriptionManager', { 
        error, 
        userId: request.auth?.uid,
        action: request.data?.action,
      });
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError('internal', 'Erro ao processar operação de transcrição');
    }
  }
);

export const cleanupExpiredTranscriptions = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async (event) => {
    try {
      logger.info('Starting cleanup of expired failed transcriptions');

      const db = admin.firestore();
      const bucket = admin.storage().bucket();
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const usersSnapshot = await db.collection('users').get();
      
      let totalDeleted = 0;
      let totalErrors = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        
        try {
          const expiredSnapshot = await db
            .collection('users')
            .doc(userId)
            .collection('failed-transcriptions')
            .where('failedAt', '<', sevenDaysAgo)
            .get();

          if (expiredSnapshot.empty) {
            continue;
          }

          logger.info('Found expired transcriptions for user', {
            userId,
            count: expiredSnapshot.size,
          });

          const batch = db.batch();
          const storageDeletionPromises: Promise<void>[] = [];

          for (const doc of expiredSnapshot.docs) {
            const failedData = doc.data() as FailedTranscription;
            
            storageDeletionPromises.push(
              (async () => {
                try {
                  const file = bucket.file(failedData.storagePath);
                  const [exists] = await file.exists();
                  if (exists) {
                    await file.delete();
                    logger.info('Expired audio deleted from Storage', {
                      userId,
                      storagePath: failedData.storagePath,
                      daysOld: Math.floor((Date.now() - failedData.failedAt.toDate().getTime()) / (1000 * 60 * 60 * 24)),
                    });
                  }
                } catch (storageError) {
                  logger.error('Error deleting expired audio from Storage', {
                    storagePath: failedData.storagePath,
                    error: storageError,
                  });
                  totalErrors++;
                }
              })()
            );

            batch.delete(doc.ref);
          }

          await Promise.all(storageDeletionPromises);
          await batch.commit();

          totalDeleted += expiredSnapshot.size;

          logger.info('Cleaned up expired transcriptions for user', {
            userId,
            deletedCount: expiredSnapshot.size,
          });

        } catch (userError) {
          logger.error('Error cleaning up transcriptions for user', {
            userId,
            error: userError,
          });
          totalErrors++;
        }
      }

      logger.info('Cleanup of expired failed transcriptions completed', {
        totalDeleted,
        totalErrors,
        cutoffDate: sevenDaysAgo.toISOString(),
      });

    } catch (error) {
      logger.error('Error in cleanupExpiredTranscriptions', { error });
      throw error;
    }
  }
);
