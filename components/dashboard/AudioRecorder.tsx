'use client';

import { useState, useEffect, useRef } from 'react';
import { X, StopCircle, Loader2 } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { transcribeAudio } from '@/lib/services/audio-transcription-service';
import { 
  subscribeToFailedTranscriptions,
  retryTranscription,
  deleteFailedTranscription,
  deleteAllFailedTranscriptions,
} from '@/lib/services/failed-transcription-service';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/utils/logger';
import type { FailedTranscription } from '@/types/chat';
import { FailedTranscriptionsList } from './FailedTranscriptionsList';

interface AudioRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptionComplete: (text: string) => void;
}

export function AudioRecorder({ isOpen, onClose, onTranscriptionComplete }: AudioRecorderProps) {
  const { userProfile } = useAuth();
  const {
    isRecording,
    recordingTime,
    audioLevel,
    error: recorderError,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedTranscriptions, setFailedTranscriptions] = useState<FailedTranscription[]>([]);
  const [showFailedList, setShowFailedList] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Subscribe to failed transcriptions when modal opens
  useEffect(() => {
    if (!isOpen || !userProfile?.uid) return;

    const unsubscribe = subscribeToFailedTranscriptions(
      userProfile.uid,
      (transcriptions) => {
        setFailedTranscriptions(transcriptions);
        setShowFailedList(transcriptions.length > 0 && !isRecording && !isProcessing);
      },
      (error) => {
        logger.error('Error subscribing to failed transcriptions:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isOpen, userProfile?.uid, isRecording, isProcessing]);

  // Resetar estados e cancelar gravação quando o modal fechar
  useEffect(() => {
    if (!isOpen) {
      // Cancelar qualquer gravação em andamento
      if (isRecording) {
        cancelRecording();
      }
      setIsProcessing(false);
      setIsUploading(false);
      setError(null);
      setShowFailedList(false);
    }
  }, [isOpen, isRecording, cancelRecording]);

  // Iniciar gravação quando o modal abrir APENAS se não houver falhas
  useEffect(() => {
    if (isOpen && !isRecording && !isProcessing && !isUploading && failedTranscriptions.length === 0) {
      // Pequeno delay para garantir que o cleanup anterior foi completado
      const timer = setTimeout(() => {
        startRecording().catch((err) => {
          logger.error('Erro ao iniciar gravação:', err);
          setError(err.message || 'Erro ao iniciar gravação');
        });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, isRecording, isProcessing, isUploading, startRecording, failedTranscriptions.length]);

  // Desenhar visualização de ondas sonoras
  useEffect(() => {
    if (!isRecording || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Limpar canvas
      ctx.clearRect(0, 0, width, height);

      // Desenhar ondas baseadas no nível de áudio
      const barCount = 40;
      const barWidth = width / barCount;
      const centerY = height / 2;

      for (let i = 0; i < barCount; i++) {
        // Criar efeito de onda com variação
        const variation = Math.sin((i / barCount) * Math.PI * 2 + Date.now() / 200) * 0.3 + 0.7;
        const barHeight = (audioLevel / 100) * height * 0.8 * variation;

        // Cor primária
        ctx.fillStyle = 'hsl(var(--primary))';
        ctx.fillRect(
          i * barWidth + barWidth * 0.2,
          centerY - barHeight / 2,
          barWidth * 0.6,
          barHeight
        );
      }

      if (isRecording) {
        animationFrameRef.current = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRecording, audioLevel]);

  // Formatar tempo de gravação (MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  // Parar gravação e processar transcrição
  const handleStopRecording = async () => {
    try {
      setIsUploading(true);
      setError(null);

      const audioBlob = await stopRecording();
      
      if (!audioBlob) {
        throw new Error('Nenhum áudio foi gravado');
      }

      if (!userProfile?.uid) {
        throw new Error('Usuário não autenticado');
      }

      const transcriptionModel = userProfile.transcriptionModel || 'gemini-2.5-flash';

      logger.log('Iniciando transcrição...', {
        model: transcriptionModel,
        audioSize: audioBlob.size,
      });

      // Atualizar estado para processamento após upload
      setIsUploading(false);
      setIsProcessing(true);

      const transcription = await transcribeAudio(audioBlob, transcriptionModel, userProfile.uid);

      if (transcription && transcription.trim()) {
        onTranscriptionComplete(transcription);
        onClose();
      } else {
        throw new Error('Nenhuma transcrição foi retornada. Tente novamente.');
      }
    } catch (err) {
      logger.error('Erro ao processar transcrição:', err);
      setError(err instanceof Error ? err.message : 'Erro ao transcrever áudio');
      setIsProcessing(false);
      setIsUploading(false);
    }
  };

  // Cancelar e fechar
  const handleCancel = () => {
    cancelRecording();
    onClose();
  };

  // Retry failed transcription
  const handleRetry = async (failedTranscriptionId: string): Promise<string> => {
    setIsRetrying(true);
    setError(null);
    try {
      const transcription = await retryTranscription(failedTranscriptionId);
      onTranscriptionComplete(transcription);
      onClose();
      return transcription;
    } catch (err) {
      logger.error('Error retrying transcription:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao retentar transcrição';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsRetrying(false);
    }
  };

  // Delete failed transcription
  const handleDelete = async (failedTranscriptionId: string): Promise<void> => {
    try {
      await deleteFailedTranscription(failedTranscriptionId);
    } catch (err) {
      logger.error('Error deleting failed transcription:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar transcrição';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Delete all failed transcriptions
  const handleDeleteAll = async (): Promise<void> => {
    if (!userProfile?.uid) return;
    
    setIsDeletingAll(true);
    setError(null);
    try {
      await deleteAllFailedTranscriptions(userProfile.uid);
    } catch (err) {
      logger.error('Error deleting all failed transcriptions:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar todas as transcrições';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsDeletingAll(false);
    }
  };

  // Start new recording from failed list
  const handleStartNewRecording = async () => {
    setShowFailedList(false);
    setError(null);
    try {
      await startRecording();
    } catch (err) {
      logger.error('Erro ao iniciar gravação:', err);
      setError(err instanceof Error ? err.message : 'Erro ao iniciar gravação');
    }
  };

  if (!isOpen) return null;

  const displayError = error || recorderError;
  const showRecordingInterface = !showFailedList && (isRecording || isProcessing || isUploading);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancel} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">
            {isProcessing 
              ? 'Transcrevendo Áudio...' 
              : showFailedList 
              ? 'Transcrições com Falha' 
              : 'Gravando Áudio'}
          </h3>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-muted rounded-lg transition-colors duration-150"
            disabled={isProcessing || isRetrying || isDeletingAll}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Error Message */}
        {displayError && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive font-medium">{displayError}</p>
          </div>
        )}

        {/* Failed Transcriptions List */}
        {showFailedList && (
          <div className="flex items-center justify-center">
            <FailedTranscriptionsList
              failedTranscriptions={failedTranscriptions}
              onRetry={handleRetry}
              onDelete={handleDelete}
              onDeleteAll={handleDeleteAll}
              onStartNewRecording={handleStartNewRecording}
              isRetrying={isRetrying}
              isDeletingAll={isDeletingAll}
            />
          </div>
        )}

        {/* Recording Interface */}
        {showRecordingInterface && (
          <>
            {/* Visualização + Timer */}
            {isRecording && !isProcessing && (
              <div className="relative mb-6">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={140}
                  className="w-full h-[140px] rounded-lg bg-muted/30"
                />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center gap-2">
                  <div className="text-6xl font-mono font-bold text-foreground tracking-wider">
                    {formatTime(recordingTime)}
                  </div>
                  <div className="text-sm text-muted-foreground">Tempo de gravação</div>
                </div>
              </div>
            )}

            {/* Uploading State */}
            {isUploading && (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-sm text-muted-foreground">Preparando áudio...</p>
                <p className="text-xs text-muted-foreground mt-1">Enviando para processamento</p>
              </div>
            )}

            {/* Processing State */}
            {isProcessing && !isUploading && (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-sm text-muted-foreground">Transcrevendo áudio...</p>
                <p className="text-xs text-muted-foreground mt-1">Isso pode levar alguns segundos</p>
              </div>
            )}

            {/* Actions */}
            {!isProcessing && !isUploading && (
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-3 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-lg transition-colors duration-150"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleStopRecording}
                  disabled={!isRecording || recordingTime < 1}
                  className="flex-1 px-4 py-3 bg-destructive hover:bg-destructive/90 disabled:bg-muted disabled:cursor-not-allowed text-destructive-foreground font-medium rounded-lg transition-all duration-150 flex items-center justify-center gap-2 animate-pulse"
                >
                  <StopCircle className="w-5 h-5" />
                  Parar e Transcrever
                </button>
              </div>
            )}

            {/* Info */}
            {isRecording && !isProcessing && !isUploading && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground text-center">
                  Fale claramente no microfone. A gravação será transcrita automaticamente.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

