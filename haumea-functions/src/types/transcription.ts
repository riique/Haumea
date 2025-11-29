import { Timestamp } from 'firebase-admin/firestore';

export interface FailedTranscription {
  userId: string;
  storagePath: string;
  audioFileName: string;
  audioDurationSeconds?: number;
  errorMessage: string;
  errorType: 'api_error' | 'timeout' | 'rate_limit' | 'invalid_format' | 'network_error' | 'unknown';
  recordedAt: Timestamp;
  failedAt: Timestamp;
  retryCount: number;
  lastRetryAt?: Timestamp;
  fileSize: number;
}

export interface FailedTranscriptionDocument extends FailedTranscription {
  id: string;
}

export interface TranscriptionResult {
  success: boolean;
  transcription?: string;
  audioPreserved?: boolean;
  failedTranscriptionId?: string;
  error?: string;
}
