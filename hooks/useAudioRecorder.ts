/**
 * useAudioRecorder Hook
 * 
 * Hook for recording audio using MediaRecorder API
 * Includes real-time audio level monitoring for visualization
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '@/lib/utils/logger';

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  recordingTime: number; // em segundos
  audioLevel: number; // 0-100 para visualização
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Iniciar gravação de áudio
   */
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Verificar suporte
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Seu navegador não suporta gravação de áudio');
      }

      // Solicitar permissão de microfone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      streamRef.current = stream;

      // Criar AudioContext para análise de níveis
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Criar MediaRecorder
      // Ordem de preferência: WAV > WebM com Opus > padrão do navegador
      let mimeType = '';
      const preferredTypes = [
        'audio/wav',
        'audio/wave',
        'audio/x-wav',
        'audio/webm;codecs=pcm',
        'audio/webm;codecs=opus',
        'audio/webm',
      ];

      for (const type of preferredTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      // Se nenhum tipo foi encontrado, usar o padrão do navegador
      const mediaRecorder = mimeType 
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      // Atualizar mimeType com o que foi realmente usado
      if (!mimeType) {
        mimeType = mediaRecorder.mimeType;
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // Coletar dados a cada 100ms
      setIsRecording(true);
      setRecordingTime(0);

      // Iniciar timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Iniciar monitoramento de níveis de áudio
      const updateAudioLevel = () => {
        if (!analyserRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calcular nível médio
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const level = Math.min(100, (average / 255) * 100 * 1.5); // Amplificar um pouco
        
        setAudioLevel(level);
        
        if (isRecording) {
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      
      updateAudioLevel();

      logger.log('Gravação de áudio iniciada', { mimeType });
    } catch (err) {
      logger.error('Erro ao iniciar gravação:', err);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Permissão de microfone negada. Por favor, permita o acesso ao microfone.');
        } else if (err.name === 'NotFoundError') {
          setError('Nenhum microfone encontrado. Conecte um microfone e tente novamente.');
        } else {
          setError(err.message || 'Erro ao acessar o microfone');
        }
      } else {
        setError('Erro ao acessar o microfone');
      }
      
      // Limpar recursos em caso de erro
      cleanup();
    }
  }, [isRecording]);

  /**
   * Parar gravação e retornar o Blob de áudio
   */
  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        // Criar blob do áudio gravado
        const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
        
        logger.log('Gravação finalizada', {
          size: blob.size,
          type: blob.type,
          duration: recordingTime,
        });

        cleanup();
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
      setIsRecording(false);
    });
  }, [isRecording, recordingTime]);

  /**
   * Cancelar gravação sem retornar áudio
   */
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    cleanup();
    logger.log('Gravação cancelada');
  }, [isRecording]);

  /**
   * Limpar recursos
   */
  const cleanup = useCallback(() => {
    // Parar timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Cancelar animação
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Parar stream de áudio
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Fechar AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Resetar estados
    setIsRecording(false);
    setRecordingTime(0);
    setAudioLevel(0);
    
    mediaRecorderRef.current = null;
    analyserRef.current = null;
    chunksRef.current = [];
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording,
    recordingTime,
    audioLevel,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}

