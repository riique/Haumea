/**
 * Share Service - Chat Sharing Integration
 * 
 * Manages shared chats and invite codes
 * Architecture:
 * - SharedChat metadata: Firestore at sharedChats/{shareId}
 * - ShareId format: {userId}_{chatId}_{shareType}_{timestamp}
 * - Allows multiple shares per chat (different types, expirations, etc.)
 * - Invite code stored in sharedChats.inviteCode field
 * 
 * Supports two sharing modes:
 * - Copy: Creates independent copy of chat (one-time use)
 * - Collaborative: Multiple users access same chat (reusable until revoked)
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  arrayRemove,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { SharedChat, ShareInvite, ShareType } from '@/types/chat';
import { logger } from '@/lib/utils/logger';
import { invalidateMetadataCache } from '@/lib/db/metadata-cache';

type FirestoreDateLike = Date | { toDate?: () => Date } | null | undefined;

/**
 * Resolve Firestore date to JavaScript Date
 */
const resolveDate = (value: FirestoreDateLike, fallbackToNow = true): Date => {
  if (!value) {
    return fallbackToNow ? new Date() : new Date();
  }
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return new Date();
};

/**
 * Generate unique invite code
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================
// SHARE OPERATIONS
// ============================================

/**
 * Create share invite for a chat
 */
export async function createShareInvite(
  userId: string,
  userEmail: string,
  chatId: string,
  chatName: string,
  shareType: ShareType,
  expiresInHours?: number
): Promise<{ inviteCode: string; shareId: string }> {
  try {
    // TODO: Re-enable share count validation once indexes are ready
    // const userShares = await listUserSharedChats(userId);
    // const limitCheck = canCreateShare(userShares.length);
    // if (!limitCheck.can) {
    //   throw new Error(limitCheck.reason);
    // }
    
    // Generate unique codes
    const inviteCode = generateInviteCode();
    // Use timestamp to ensure unique shareId for multiple shares of same chat
    const timestamp = Date.now();
    const shareId = `${userId}_${chatId}_${shareType}_${timestamp}`;
    
    // Calculate expiration if provided
    const expiresAt = expiresInHours 
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : undefined;
    
    // Create new shared chat document
    const shareRef = doc(firestore, 'sharedChats', shareId);
    
    logger.info('Creating share:', { shareId, userId, chatId, shareType });
    
    try {
      const sharedChatData = {
        chatId,
        ownerId: userId,
        ownerEmail: userEmail,
        shareType,
        members: [userId],
        inviteCode,
        createdAt: Timestamp.now(),
        expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
        isActive: true,
        chatMetadata: {
          name: chatName,
          messageCount: 0,
          lastMessageAt: Timestamp.now(),
        },
      };
      
      logger.info('Document data:', { shareId, ownerId: userId });
      
      // Create new share document (no merge needed since shareId is unique)
      await setDoc(shareRef, sharedChatData);
      
      logger.info('Share created successfully:', { shareId });
    } catch (error) {
      logger.error('Error in share creation/update:', { error, shareId, userId });
      throw error;
    }
    
    // Note: inviteCodes collection is managed by Cloud Functions only
    // The invite code is stored in sharedChats.inviteCode field
    
    // Invalidate cache
    await invalidateMetadataCache(userId);
    
    return { inviteCode, shareId };
  } catch (error) {
    logger.error('Error creating share invite:', { error });
    throw error;
  }
}

/**
 * Get share details by share ID
 */
export async function getShareDetails(shareId: string): Promise<SharedChat | null> {
  try {
    const shareRef = doc(firestore, 'sharedChats', shareId);
    const shareDoc = await getDoc(shareRef);
    
    if (!shareDoc.exists()) {
      return null;
    }
    
    const data = shareDoc.data();
    return {
      id: shareDoc.id,
      chatId: data.chatId,
      ownerId: data.ownerId,
      ownerEmail: data.ownerEmail,
      shareType: data.shareType,
      members: data.members || [],
      inviteCode: data.inviteCode,
      createdAt: resolveDate(data.createdAt),
      expiresAt: data.expiresAt ? resolveDate(data.expiresAt) : undefined,
      isActive: data.isActive,
      chatMetadata: {
        name: data.chatMetadata?.name || '',
        messageCount: data.chatMetadata?.messageCount || 0,
        lastMessageAt: resolveDate(data.chatMetadata?.lastMessageAt),
      },
    };
  } catch (error) {
    logger.error('Error getting share details:', error);
    return null;
  }
}

/**
 * List all chats shared BY current user
 */
export async function listUserSharedChats(userId: string): Promise<SharedChat[]> {
  try {
    const sharesRef = collection(firestore, 'sharedChats');
    const q = query(
      sharesRef,
      where('ownerId', '==', userId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        chatId: data.chatId,
        ownerId: data.ownerId,
        ownerEmail: data.ownerEmail,
        shareType: data.shareType,
        members: data.members || [],
        inviteCode: data.inviteCode,
        createdAt: resolveDate(data.createdAt),
        expiresAt: data.expiresAt ? resolveDate(data.expiresAt) : undefined,
        isActive: data.isActive,
        chatMetadata: {
          name: data.chatMetadata?.name || '',
          messageCount: data.chatMetadata?.messageCount || 0,
          lastMessageAt: resolveDate(data.chatMetadata?.lastMessageAt),
        },
      };
    });
  } catch (error) {
    logger.error('Error listing user shared chats:', error);
    return [];
  }
}

/**
 * List all chats shared WITH current user (chats they have access to)
 */
export async function listChatsSharedWithUser(userId: string): Promise<SharedChat[]> {
  try {
    const sharesRef = collection(firestore, 'sharedChats');
    const q = query(
      sharesRef,
      where('members', 'array-contains', userId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs
      .filter((doc) => doc.data().ownerId !== userId) // Exclude own shares
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          chatId: data.chatId,
          ownerId: data.ownerId,
          ownerEmail: data.ownerEmail,
          shareType: data.shareType,
          members: data.members || [],
          inviteCode: data.inviteCode,
          createdAt: resolveDate(data.createdAt),
          expiresAt: data.expiresAt ? resolveDate(data.expiresAt) : undefined,
          isActive: data.isActive,
          chatMetadata: {
            name: data.chatMetadata?.name || '',
            messageCount: data.chatMetadata?.messageCount || 0,
            lastMessageAt: resolveDate(data.chatMetadata?.lastMessageAt),
          },
        };
      });
  } catch (error) {
    logger.error('Error listing chats shared with user:', error);
    return [];
  }
}

/**
 * Revoke share access (owner only)
 */
export async function revokeShare(shareId: string, userId: string): Promise<void> {
  try {
    const shareRef = doc(firestore, 'sharedChats', shareId);
    const shareDoc = await getDoc(shareRef);
    
    if (!shareDoc.exists()) {
      throw new Error('Share not found');
    }
    
    const data = shareDoc.data();
    if (data.ownerId !== userId) {
      throw new Error('Only owner can revoke share');
    }
    
    // Mark as inactive
    await updateDoc(shareRef, {
      isActive: false,
      inviteCode: null,
    });
    
    // Invalidate cache for all members
    for (const memberId of data.members || []) {
      await invalidateMetadataCache(memberId);
    }
    
    logger.info(`Share revoked: ${shareId}`);
  } catch (error) {
    logger.error('Error revoking share:', error);
    throw error;
  }
}

/**
 * Remove specific user from shared chat (owner only)
 */
export async function removeUserFromShare(
  shareId: string,
  ownerId: string,
  userIdToRemove: string
): Promise<void> {
  try {
    const shareRef = doc(firestore, 'sharedChats', shareId);
    const shareDoc = await getDoc(shareRef);
    
    if (!shareDoc.exists()) {
      throw new Error('Share not found');
    }
    
    const data = shareDoc.data();
    if (data.ownerId !== ownerId) {
      throw new Error('Only owner can remove users');
    }
    
    if (userIdToRemove === ownerId) {
      throw new Error('Cannot remove owner from share');
    }
    
    // Remove user from members array
    await updateDoc(shareRef, {
      members: arrayRemove(userIdToRemove),
    });
    
    // Invalidate cache for removed user
    await invalidateMetadataCache(userIdToRemove);
    
    logger.info(`User ${userIdToRemove} removed from share ${shareId}`);
  } catch (error) {
    logger.error('Error removing user from share:', error);
    throw error;
  }
}

/**
 * Check if user has access to a shared chat
 */
export async function hasSharedAccess(
  userId: string,
  ownerId: string,
  chatId: string
): Promise<boolean> {
  try {
    const shareId = `${ownerId}_${chatId}`;
    const shareRef = doc(firestore, 'sharedChats', shareId);
    const shareDoc = await getDoc(shareRef);
    
    if (!shareDoc.exists()) {
      return false;
    }
    
    const data = shareDoc.data();
    return data.isActive && (data.members || []).includes(userId);
  } catch (error) {
    logger.error('Error checking shared access:', error);
    return false;
  }
}

/**
 * Get invite details by code (for validation before accepting)
 */
export async function getInviteByCode(code: string): Promise<ShareInvite | null> {
  try {
    const invitesRef = collection(firestore, 'inviteCodes');
    const q = query(
      invitesRef,
      where('code', '==', code),
      where('isActive', '==', true)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }
    
    const inviteDoc = snapshot.docs[0];
    const data = inviteDoc.data();
    
    // Check expiration
    if (data.expiresAt) {
      const expiresAt = resolveDate(data.expiresAt);
      if (expiresAt < new Date()) {
        return null; // Expired
      }
    }
    
    return {
      id: inviteDoc.id,
      shareId: data.shareId,
      code: data.code,
      shareType: data.shareType,
      chatId: data.chatId,
      ownerId: data.ownerId,
      ownerEmail: data.ownerEmail,
      chatName: data.chatName,
      createdBy: data.createdBy,
      createdAt: resolveDate(data.createdAt),
      expiresAt: data.expiresAt ? resolveDate(data.expiresAt) : undefined,
      usedBy: data.usedBy,
      usedAt: data.usedAt ? resolveDate(data.usedAt) : undefined,
      isActive: data.isActive,
    };
  } catch (error) {
    logger.error('Error getting invite by code:', error);
    return null;
  }
}

/**
 * Update shared chat metadata (for collaborative chats)
 */
export async function updateSharedChatMetadata(
  shareId: string,
  metadata: Partial<SharedChat['chatMetadata']>
): Promise<void> {
  try {
    const shareRef = doc(firestore, 'sharedChats', shareId);
    await updateDoc(shareRef, {
      'chatMetadata.name': metadata.name,
      'chatMetadata.messageCount': metadata.messageCount,
      'chatMetadata.lastMessageAt': metadata.lastMessageAt 
        ? Timestamp.fromDate(metadata.lastMessageAt) 
        : Timestamp.now(),
    });
  } catch (error) {
    logger.error('Error updating shared chat metadata:', error);
    throw error;
  }
}

/**
 * Delete expired invites (maintenance function)
 */
export async function deleteExpiredInvites(): Promise<number> {
  try {
    const invitesRef = collection(firestore, 'inviteCodes');
    const q = query(invitesRef, where('isActive', '==', true));
    
    const snapshot = await getDocs(q);
    let deletedCount = 0;
    
    const now = new Date();
    for (const inviteDoc of snapshot.docs) {
      const data = inviteDoc.data();
      if (data.expiresAt) {
        const expiresAt = resolveDate(data.expiresAt);
        if (expiresAt < now) {
          await deleteDoc(doc(firestore, 'inviteCodes', inviteDoc.id));
          deletedCount++;
        }
      }
    }
    
    logger.info(`Deleted ${deletedCount} expired invites`);
    return deletedCount;
  } catch (error) {
    logger.error('Error deleting expired invites:', error);
    return 0;
  }
}
