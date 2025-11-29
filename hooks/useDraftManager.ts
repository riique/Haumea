import { useEffect, useCallback, useRef } from 'react';

export interface Draft {
  input: string;
  files: {
    name: string;
    type: string;
    size: number;
    lastModified: number;
  }[];
  timestamp: number;
}

const DRAFT_PREFIX = 'haumea_draft_';
const DEBOUNCE_DELAY = 500; // Save after 500ms of inactivity

/**
 * Hook para gerenciar rascunhos de mensagens no localStorage
 * Salva automaticamente enquanto o usuário digita e restaura quando volta ao chat
 */
export function useDraftManager(
  chatId: string,
  input: string,
  selectedFiles: File[],
  onRestoreDraft: (draft: Draft, files: File[]) => void
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRestoredRef = useRef(false);
  const currentChatIdRef = useRef<string>('');

  // Get draft key for current chat (or 'new' for empty chat)
  const getDraftKey = useCallback((id: string) => {
    const key = id && id !== '' ? id : 'new';
    return `${DRAFT_PREFIX}${key}`;
  }, []);

  // Clear draft from localStorage
  const clearDraft = useCallback((id: string) => {
    try {
      localStorage.removeItem(getDraftKey(id));
    } catch (error) {
      // Silent fail
    }
  }, [getDraftKey]);

  // Save draft to localStorage
  const saveDraft = useCallback((id: string, text: string, files: File[]) => {
    if (!text.trim() && files.length === 0) {
      // If empty, delete draft
      clearDraft(id);
      return;
    }

    const draft: Draft = {
      input: text,
      files: files.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size,
        lastModified: f.lastModified,
      })),
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(getDraftKey(id), JSON.stringify(draft));
    } catch (error) {
      // Silent fail - quota exceeded or storage unavailable
    }
  }, [getDraftKey, clearDraft]);

  // Load draft from localStorage
  const loadDraft = useCallback((id: string): Draft | null => {
    try {
      const stored = localStorage.getItem(getDraftKey(id));
      if (!stored) {
        return null;
      }

      const draft: Draft = JSON.parse(stored);
      
      // Check if draft is not too old (7 days)
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      if (draft.timestamp < sevenDaysAgo) {
        clearDraft(id);
        return null;
      }

      return draft;
    } catch (error) {
      return null;
    }
  }, [getDraftKey, clearDraft]);

  // Restore draft when chat changes
  useEffect(() => {
    // If chat changed, reset restoration flag
    if (currentChatIdRef.current !== chatId) {
      hasRestoredRef.current = false;
      currentChatIdRef.current = chatId;
      
      // Delay to let the input clear first
      const timer = setTimeout(() => {
        // Only restore once per chat
        if (!hasRestoredRef.current) {
          const draft = loadDraft(chatId);
          if (draft) {
            // We can't restore File objects from localStorage metadata alone
            // But we can restore the text input
            onRestoreDraft(draft, []);
            hasRestoredRef.current = true;
          }
        }
      }, 100); // 100ms delay to avoid race condition with input clearing
      
      return () => clearTimeout(timer);
    }
  }, [chatId, loadDraft, onRestoreDraft]);

  // Auto-save draft with debounce
  useEffect(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout to save draft
    timeoutRef.current = setTimeout(() => {
      saveDraft(chatId, input, selectedFiles);
    }, DEBOUNCE_DELAY);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [chatId, input, selectedFiles, saveDraft]);

  return {
    saveDraft,
    loadDraft,
    clearDraft,
  };
}
