import { validateEnvironment } from './utils/envValidator';

// Validar variáveis de ambiente críticas no startup
try {
  validateEnvironment();
} catch (error) {
  console.error('FATAL: Environment validation failed. Functions will not work correctly.', error);
  // Não lançar erro aqui para não impedir o deploy, mas logar claramente
}

// IMPORTANTE: setGlobalOptions foi removido para permitir deploy de functions individuais
// Cada function agora define suas próprias configurações (region, memory, timeout, etc.)

// Exports
export { healthCheck } from './functions/healthCheck';
export { chatWithAI } from './functions/chatWithAI';
export { openRouterCredits } from './functions/openRouterCredits';
export { saveApiKey } from './functions/saveApiKey';
// TODO: Configurar ENCRYPTION_KEY via Firebase Secret Manager antes de usar
// export { saveEndpoint } from './functions/saveEndpoint';

// API Key Management Function (consolidated)
export { manageApiKeys } from './functions/apiKeysManager';

// Admin & Invite Code Functions (consolidated)
export { adminManager } from './functions/adminManager';

// Public Leaderboard Functions
export { getUsersWithCostsPublic, updateLeaderboardScheduled } from './functions/getUsersWithCostsPublic';

// Debate Mode Function
export { debateMode } from './functions/debateMode';

// Chat Sharing Function
export { acceptShareInvite } from './functions/acceptShareInvite';

// Transcription Management Functions (consolidated - includes transcribe, retry, deleteOne, deleteAll)
export { transcriptionManager, cleanupExpiredTranscriptions } from './functions/transcriptionManager';

