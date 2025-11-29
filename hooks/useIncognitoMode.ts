/**
 * Hook for managing incognito mode
 */

import { useState, useEffect, useCallback } from 'react';
import {
  isIncognitoMode,
  enableIncognitoMode,
  disableIncognitoMode,
  getIncognitoChat,
  createIncognitoChat,
  updateIncognitoChat,
  IncognitoChat,
} from '@/lib/services/incognito-service';

export function useIncognitoMode() {
  const [incognitoActive, setIncognitoActive] = useState(false);
  const [incognitoChat, setIncognitoChat] = useState<IncognitoChat | null>(null);

  // Check incognito mode on mount
  useEffect(() => {
    const active = isIncognitoMode();
    setIncognitoActive(active);
    
    if (active) {
      const chat = getIncognitoChat();
      setIncognitoChat(chat);
    }
  }, []);

  /**
   * Toggle incognito mode
   * Returns the new state (true = enabled, false = disabled)
   */
  const toggleIncognito = useCallback((defaultModel: string) => {
    const newState = !incognitoActive;
    
    if (newState) {
      // Enable incognito mode
      enableIncognitoMode();
      
      // Create new incognito chat or get existing one
      let chat = getIncognitoChat();
      if (!chat) {
        chat = createIncognitoChat(defaultModel);
      }
      
      setIncognitoChat(chat);
      setIncognitoActive(true);
      return true;
    } else {
      // Disable incognito mode
      disableIncognitoMode();
      setIncognitoChat(null);
      setIncognitoActive(false);
      return false;
    }
  }, [incognitoActive]);

  /**
   * Update incognito chat settings
   */
  const updateIncognitoChatSettings = useCallback((updates: Partial<IncognitoChat>) => {
    if (!incognitoActive) return;
    
    updateIncognitoChat(updates);
    const updatedChat = getIncognitoChat();
    setIncognitoChat(updatedChat);
  }, [incognitoActive]);

  /**
   * Refresh incognito chat from localStorage
   */
  const refreshIncognitoChat = useCallback(() => {
    if (!incognitoActive) return;
    
    const chat = getIncognitoChat();
    setIncognitoChat(chat);
  }, [incognitoActive]);

  return {
    incognitoActive,
    incognitoChat,
    toggleIncognito,
    updateIncognitoChatSettings,
    refreshIncognitoChat,
  };
}
