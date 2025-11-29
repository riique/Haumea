'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { logger } from '@/lib/utils/logger';

/**
 * IndexedDBAlert Component
 * 
 * Displays an alert when IndexedDB errors are detected
 * Guides user to reset the database in settings
 */
export function IndexedDBAlert() {
  const [showAlert, setShowAlert] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Listen for custom IndexedDB error events
    const handleCustomIndexedDBError = (event: Event) => {
      const customEvent = event as CustomEvent;
      logger.error('IndexedDB error detected via custom event:', customEvent.detail);
      setShowAlert(true);
    };

    // Listen for IndexedDB errors
    const handleIndexedDBError = (event: ErrorEvent) => {
      const errorMessage = event.message || event.error?.message || '';
      
      if (
        errorMessage.includes('backing store') ||
        errorMessage.includes('IndexedDB') ||
        errorMessage.includes('Internal error opening')
      ) {
        logger.error('IndexedDB error detected:', errorMessage);
        setShowAlert(true);
      }
    };

    // Listen for console errors
    const originalError = console.error;
    console.error = function(...args) {
      const message = args.join(' ');
      if (
        message.includes('backing store') ||
        message.includes('setItem error') ||
        message.includes('Error caching models')
      ) {
        setShowAlert(true);
      }
      originalError.apply(console, args);
    };

    window.addEventListener('indexeddb-error', handleCustomIndexedDBError);
    window.addEventListener('error', handleIndexedDBError);

    return () => {
      window.removeEventListener('indexeddb-error', handleCustomIndexedDBError);
      window.removeEventListener('error', handleIndexedDBError);
      console.error = originalError;
    };
  }, []);

  if (!showAlert || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
              Erro no Cache Local
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3">
              O cache local está corrompido. Para resolver, vá em <strong>Configurações → Segurança</strong> e clique em <strong>Resetar Cache Local</strong>.
            </p>
            <button
              onClick={() => setIsDismissed(true)}
              className="text-sm font-medium text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 underline"
            >
              Entendi
            </button>
          </div>
          <button
            onClick={() => setIsDismissed(true)}
            className="text-yellow-600 dark:text-yellow-500 hover:text-yellow-800 dark:hover:text-yellow-300 p-1 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
