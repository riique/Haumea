'use client';

import { useState } from 'react';
import { RefreshCw, Trash2, AlertCircle, Clock, FileAudio } from 'lucide-react';
import type { FailedTranscription } from '@/types/chat';
import { AudioPlayer } from './AudioPlayer';
import { logger } from '@/lib/utils/logger';

interface FailedTranscriptionsListProps {
  failedTranscriptions: FailedTranscription[];
  onRetry: (id: string) => Promise<string>;
  onDelete: (id: string) => Promise<void>;
  onDeleteAll: () => Promise<void>;
  onStartNewRecording: () => void;
  isRetrying: boolean;
  isDeletingAll: boolean;
}

export function FailedTranscriptionsList({
  failedTranscriptions,
  onRetry,
  onDelete,
  onDeleteAll,
  onStartNewRecording,
  isRetrying,
  isDeletingAll,
}: FailedTranscriptionsListProps) {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      await onRetry(id);
    } catch (error) {
      logger.error('Error in handleRetry:', error);
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } catch (error) {
      logger.error('Error in handleDelete:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    try {
      await onDeleteAll();
      setShowDeleteAllConfirm(false);
    } catch (error) {
      logger.error('Error in handleDeleteAll:', error);
    }
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMins < 1) return 'Agora mesmo';
    if (diffInMins < 60) return `${diffInMins}min atrás`;
    if (diffInHours < 24) return `${diffInHours}h atrás`;
    if (diffInDays < 7) return `${diffInDays}d atrás`;

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) {
      return `${mins}min ${secs}s`;
    }
    return `${secs}s`;
  };

  const getErrorTypeLabel = (errorType: FailedTranscription['errorType']): string => {
    const labels: Record<FailedTranscription['errorType'], string> = {
      timeout: 'Tempo esgotado',
      rate_limit: 'Limite de requisições',
      invalid_format: 'Formato inválido',
      api_error: 'Erro da API',
      network_error: 'Erro de rede',
      unknown: 'Erro desconhecido',
    };
    return labels[errorType];
  };

  const getErrorTypeColor = (errorType: FailedTranscription['errorType']): string => {
    const colors: Record<FailedTranscription['errorType'], string> = {
      timeout: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20',
      rate_limit: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20',
      invalid_format: 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20',
      api_error: 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20',
      network_error: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20',
      unknown: 'bg-muted text-muted-foreground border border-border/50',
    };
    return colors[errorType];
  };

  if (failedTranscriptions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2.5">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-4.5 h-4.5 text-destructive" />
          </div>
          <span>Transcrições com Falha</span>
          <span className="text-sm font-normal text-muted-foreground">({failedTranscriptions.length})</span>
        </h3>
        
        <button
          onClick={onStartNewRecording}
          disabled={isRetrying || isDeletingAll}
          className="px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow"
        >
          Gravar Novo Áudio
        </button>
      </div>

      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/50">
        <p>Estes áudios falharam durante a transcrição. Você pode retentar, ouvir ou deletá-los.</p>
        <p className="text-xs mt-1 opacity-75">Eles serão automaticamente deletados após 7 dias.</p>
      </div>

      <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2 -mr-2">
        {failedTranscriptions.map((transcription) => {
          const isCurrentlyRetrying = retryingId === transcription.id;
          const isCurrentlyDeleting = deletingId === transcription.id;
          const isDisabled = isRetrying || isDeletingAll || isCurrentlyRetrying || isCurrentlyDeleting;

          return (
            <div
              key={transcription.id}
              className="bg-card hover:bg-accent/30 border border-border rounded-xl p-4 flex flex-col gap-3.5 transition-all duration-200 shadow-sm hover:shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-11 h-11 bg-muted rounded-xl flex items-center justify-center ring-1 ring-border/50">
                    <FileAudio className="w-5 h-5 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-foreground font-medium">
                        {formatDate(transcription.recordedAt)}
                      </span>
                      {transcription.audioDurationSeconds && (
                        <>
                          <span className="text-muted-foreground/50">•</span>
                          <span className="text-muted-foreground">
                            {formatDuration(transcription.audioDurationSeconds)}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getErrorTypeColor(transcription.errorType)}`}>
                        {getErrorTypeLabel(transcription.errorType)}
                      </span>
                      {transcription.retryCount > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                          {transcription.retryCount} tentativa{transcription.retryCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <div className="bg-muted/50 rounded-lg p-2.5 border border-border/50">
                      <p
                        className="text-xs text-muted-foreground line-clamp-2 leading-relaxed"
                        title={transcription.errorMessage}
                      >
                        {transcription.errorMessage}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRetry(transcription.id)}
                    disabled={isDisabled}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow"
                    title="Retentar transcrição"
                  >
                    {isCurrentlyRetrying ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">Retentar</span>
                  </button>

                  <button
                    onClick={() => handleDelete(transcription.id)}
                    disabled={isDisabled}
                    className="flex items-center gap-1.5 px-3 py-2 bg-destructive hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed text-destructive-foreground rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow"
                    title="Deletar áudio"
                  >
                    {isCurrentlyDeleting ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">Deletar</span>
                  </button>
                </div>
              </div>

              <AudioPlayer
                storagePath={transcription.storagePath}
                fileName={transcription.audioFileName}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 pt-3 border-t border-border">
        {!showDeleteAllConfirm ? (
          <button
            onClick={() => setShowDeleteAllConfirm(true)}
            disabled={isDeletingAll || isRetrying}
            className="px-4 py-2.5 bg-destructive hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed text-destructive-foreground rounded-lg transition-all duration-200 text-sm font-medium flex items-center gap-2 shadow-sm hover:shadow"
          >
            <Trash2 className="w-4 h-4" />
            Deletar Todos ({failedTranscriptions.length})
          </button>
        ) : (
          <div className="flex items-center gap-3 w-full flex-wrap bg-destructive/10 rounded-lg p-3 border border-destructive/20">
            <span className="text-sm text-foreground font-medium flex-1 min-w-[200px]">
              Tem certeza? Esta ação não pode ser desfeita.
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAll}
                disabled={isDeletingAll}
                className="px-4 py-2 bg-destructive hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed text-destructive-foreground rounded-lg transition-all duration-200 text-sm font-medium flex items-center gap-2 shadow-sm"
              >
                {isDeletingAll ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Confirmar
              </button>
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                disabled={isDeletingAll}
                className="px-4 py-2 bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed text-foreground rounded-lg transition-all duration-200 text-sm font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
