/**
 * Chat Sharing Limits Configuration
 * 
 * Defines limits and constraints for chat sharing feature
 */

export const SHARING_LIMITS = {
  // Maximum number of members in a collaborative chat (including owner)
  MAX_MEMBERS_COLLABORATIVE: 5,
  
  // Maximum number of active shares per user
  MAX_ACTIVE_SHARES_PER_USER: 20,
  
  // Maximum message count for copy mode (to prevent performance issues)
  MAX_MESSAGES_FOR_COPY: 10000,
  
  // Maximum chat size in bytes for copy mode (10MB)
  MAX_CHAT_SIZE_BYTES: 10 * 1024 * 1024,
  
  // Default invite expiration times (in hours)
  EXPIRATION_OPTIONS: {
    '1h': 1,
    '24h': 24,
    '7d': 168,
    'never': null,
  } as const,
  
  // Default expiration if not specified (7 days)
  DEFAULT_EXPIRATION_HOURS: 168,
} as const;

export type ExpirationOption = keyof typeof SHARING_LIMITS.EXPIRATION_OPTIONS;

/**
 * Validate if chat can be shared based on limits
 */
export function validateChatForSharing(chat: {
  messageCount?: number;
  isSharedCopy?: boolean;
}): { valid: boolean; reason?: string } {
  // Don't allow sharing of already-shared copies
  if (chat.isSharedCopy) {
    return {
      valid: false,
      reason: 'Cópias compartilhadas não podem ser compartilhadas novamente.',
    };
  }
  
  // Check message count for copy mode
  const messageCount = chat.messageCount || 0;
  if (messageCount > SHARING_LIMITS.MAX_MESSAGES_FOR_COPY) {
    return {
      valid: false,
      reason: `Este chat tem muitas mensagens (${messageCount}). Máximo permitido: ${SHARING_LIMITS.MAX_MESSAGES_FOR_COPY}.`,
    };
  }
  
  return { valid: true };
}

/**
 * Check if user can add more members to collaborative chat
 */
export function canAddMember(currentMemberCount: number): { can: boolean; reason?: string } {
  if (currentMemberCount >= SHARING_LIMITS.MAX_MEMBERS_COLLABORATIVE) {
    return {
      can: false,
      reason: `Limite máximo de membros atingido (${SHARING_LIMITS.MAX_MEMBERS_COLLABORATIVE}).`,
    };
  }
  
  return { can: true };
}

/**
 * Check if user can create more shares
 */
export function canCreateShare(currentShareCount: number): { can: boolean; reason?: string } {
  if (currentShareCount >= SHARING_LIMITS.MAX_ACTIVE_SHARES_PER_USER) {
    return {
      can: false,
      reason: `Limite máximo de compartilhamentos ativos atingido (${SHARING_LIMITS.MAX_ACTIVE_SHARES_PER_USER}).`,
    };
  }
  
  return { can: true };
}
