/**
 * Audio Transcription Service
 * 
 * Handles audio transcription using Firebase Cloud Functions and Gemini AI API
 */

import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { logger } from '@/lib/utils/logger';
import { uploadAudioToStorage, deleteAudioFromStorage } from './audio-storage-service';

export interface TranscriptionResult {
  success: boolean;
  transcription?: string;
  error?: string;
}

/**
 * Converter Blob de áudio para formato WAV com sample rate otimizado
 * Gemini API aceita WAV - reduzindo sample rate de 48kHz para 24kHz reduz tamanho em ~50%
 * 24kHz mantém excelente qualidade para voz e reduz 7min de ~40MB para ~20MB
 */
export async function convertToWav(audioBlob: Blob): Promise<Blob> {
  try {
    logger.log('Convertendo áudio para WAV de alta qualidade...', {
      inputFormat: audioBlob.type,
      inputSize: audioBlob.size,
    });

    // Criar AudioContext
    const audioContext = new AudioContext();
    
    // Converter blob para ArrayBuffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    // Decodificar áudio (funciona com WebM, MP3, WAV, etc.)
    // Todos os navegadores que suportam MediaRecorder também suportam decodeAudioData
    // Decodificar áudio
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    logger.log('Áudio decodificado com sucesso', {
      duration: audioBuffer.duration.toFixed(2),
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
    });
    
    // Resample para 24kHz (alta qualidade para voz) se necessário
    const targetSampleRate = 24000; // 24kHz - excelente qualidade para voz
    const resampledBuffer = audioBuffer.sampleRate > targetSampleRate 
      ? await resampleAudioBuffer(audioBuffer, targetSampleRate)
      : audioBuffer;
    
    // Converter para WAV - manter mono se já for mono, ou stereo se for stereo
    const forceMono = audioBuffer.numberOfChannels === 1;
    const wavBlob = audioBufferToWav(resampledBuffer, forceMono);
    
    logger.log('Conversão para WAV de alta qualidade concluída', {
      outputSize: wavBlob.size,
      originalSampleRate: audioBuffer.sampleRate,
      targetSampleRate: resampledBuffer.sampleRate,
      originalChannels: audioBuffer.numberOfChannels,
      outputChannels: resampledBuffer.numberOfChannels,
      sizeReduction: `${((1 - wavBlob.size / audioBlob.size) * 100).toFixed(1)}%`,
    });
    
    return wavBlob;
  } catch (error) {
    logger.error('Erro ao converter áudio para WAV:', error);
    
    // Mensagens de erro mais específicas
    if (error instanceof Error) {
      if (error.name === 'EncodingError' || error.message.includes('decode')) {
        throw new Error('Formato de áudio não suportado. Tente gravar novamente.');
      }
    }
    
    throw new Error('Erro ao processar áudio. Tente novamente.');
  }
}

/**
 * Resample AudioBuffer para sample rate menor
 */
async function resampleAudioBuffer(buffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
  const offlineContext = new OfflineAudioContext(
    buffer.numberOfChannels,
    Math.ceil(buffer.duration * targetSampleRate),
    targetSampleRate
  );
  
  const source = offlineContext.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineContext.destination);
  source.start(0);
  
  return await offlineContext.startRendering();
}

/**
 * Converter AudioBuffer para WAV Blob
 */
function audioBufferToWav(buffer: AudioBuffer, forceMono: boolean = false): Blob {
  // Forçar mono se solicitado (reduz tamanho pela metade)
  const numberOfChannels = forceMono ? 1 : buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;
  
  const data = forceMono ? mixToMono(buffer) : interleave(buffer);
  const dataLength = data.length * bytesPerSample;
  const buffer_size = 44 + dataLength;
  
  const arrayBuffer = new ArrayBuffer(buffer_size);
  const view = new DataView(arrayBuffer);
  
  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  
  // FMT sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  
  // Data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  
  // Write PCM samples
  floatTo16BitPCM(view, 44, data);
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  const result = new Float32Array(buffer.length);
  
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }
  
  // Mix todos os canais para mono
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < buffer.length; i++) {
      result[i] += channelData[i] / buffer.numberOfChannels;
    }
  }
  
  return result;
}

function interleave(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }
  
  const length = buffer.length * buffer.numberOfChannels;
  const result = new Float32Array(length);
  
  const channelData: Float32Array[] = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channelData.push(buffer.getChannelData(i));
  }
  
  let offset = 0;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      result[offset++] = channelData[channel][i];
    }
  }
  
  return result;
}

function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array): void {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}


/**
 * Converter Blob de áudio para base64
 */
export async function convertBlobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1]; // Remove data:audio/...;base64,
      resolve(base64String);
    };
    reader.onerror = () => reject(new Error('Erro ao converter áudio para base64'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Transcrever áudio usando Gemini AI API
 * 
 * @param audioBlob - Blob do áudio gravado
 * @param model - ID do modelo Gemini para transcrição
 * @param userId - ID do usuário
 * @returns Texto transcrito
 */
export async function transcribeAudio(
  audioBlob: Blob,
  model: string,
  userId: string
): Promise<string> {
  let storagePath: string | null = null;
  let audioDurationSeconds: number | undefined;
  let recordedAt: string | undefined;
  
  try {
    logger.log('Iniciando transcrição de áudio...', {
      audioSize: audioBlob.size,
      audioType: audioBlob.type,
      model,
    });

    // Converter áudio para WAV otimizado (24kHz)
    logger.log('Preparando áudio para transcrição...');
    const wavBlob = await convertToWav(audioBlob);
    
    // Extrair duração do áudio
    try {
      const audioContext = new AudioContext();
      const arrayBuffer = await wavBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioDurationSeconds = audioBuffer.duration;
      logger.log('Duração do áudio detectada:', audioDurationSeconds.toFixed(2), 'segundos');
      await audioContext.close();
    } catch (durationError) {
      logger.warn('Não foi possível detectar duração do áudio:', durationError);
    }
    
    recordedAt = new Date().toISOString();
    
    logger.log('Áudio convertido para WAV de alta qualidade', {
      originalSize: audioBlob.size,
      wavSize: wavBlob.size,
      originalType: audioBlob.type,
      wavType: wavBlob.type,
      compressionRatio: `${((1 - wavBlob.size / audioBlob.size) * 100).toFixed(1)}% menor`,
      duration: audioDurationSeconds ? `${audioDurationSeconds.toFixed(2)}s` : 'desconhecida',
    });

    // Upload para Firebase Storage
    logger.log('Fazendo upload do áudio para Storage...');
    storagePath = await uploadAudioToStorage(wavBlob, userId);
    logger.log('Upload concluído', { storagePath });

    // Chamar Cloud Function com storagePath e informações adicionais
    const transcribeFunction = httpsCallable<
      { 
        action: 'transcribe';
        userId: string; 
        storagePath: string; 
        model: string;
        audioDurationSeconds?: number;
        fileSize?: number;
        recordedAt?: string;
      },
      TranscriptionResult
    >(functions, 'transcriptionManager', {
      timeout: 900000,
    });

    const result = await transcribeFunction({
      action: 'transcribe',
      userId,
      storagePath,
      model,
      audioDurationSeconds,
      fileSize: wavBlob.size,
      recordedAt,
    });

    if (!result.data.success || !result.data.transcription) {
      throw new Error(result.data.error || 'Falha na transcrição');
    }

    logger.log('Transcrição concluída com sucesso', {
      transcriptionLength: result.data.transcription.length,
    });

    // Áudio já foi deletado pela Cloud Function após sucesso
    storagePath = null;

    return result.data.transcription;
  } catch (error) {
    logger.error('Erro ao transcrever áudio:', error);

    // Verificar se o áudio foi preservado (erro contém marker |PRESERVED|)
    let audioWasPreserved = false;
    if (error instanceof Error) {
      const errorMessage = error.message;
      if (errorMessage.includes('|PRESERVED|')) {
        audioWasPreserved = true;
        const cleanMessage = errorMessage.split('|PRESERVED|')[0];
        logger.log('Áudio preservado para retry futuro', { storagePath });
        
        // Lançar erro limpo sem o marker
        throw new Error(cleanMessage);
      }
    }

    // Se houver erro e o áudio NÃO foi preservado e ainda estiver no Storage, deletar
    if (storagePath && !audioWasPreserved) {
      logger.log('Deletando áudio do Storage após erro...');
      await deleteAudioFromStorage(storagePath).catch((deleteError) => {
        logger.warn('Erro ao deletar áudio após falha:', deleteError);
      });
    }

    // Tratar erros específicos
    if (error instanceof Error) {
      if (error.message.includes('não suporta')) {
        throw new Error('O modelo selecionado não suporta transcrição de áudio. Escolha outro modelo nas configurações.');
      }
      if (error.message.includes('muito longo') || error.message.includes('muito grande')) {
        throw new Error('Áudio muito longo. Tente gravar um áudio mais curto.');
      }
      if (error.message.includes('API Key')) {
        throw new Error('Configure sua API Key do Gemini nas configurações.');
      }
      if (error.message.includes('rapidamente')) {
        throw new Error('Você está transcrevendo áudios muito rapidamente. Aguarde um momento.');
      }
      
      throw error;
    }

    throw new Error('Erro ao transcrever áudio. Tente novamente.');
  }
}

