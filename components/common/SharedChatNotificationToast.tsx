/**
 * SharedChatNotificationToast Component
 * 
 * Toast specifically for shared chat notifications
 */

'use client';

import { useEffect } from 'react';
import { Users, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface SharedChatNotificationToastProps {
  chatName: string;
  messagePreview: string;
  onClose: () => void;
  onClick?: () => void;
  duration?: number;
}

export function SharedChatNotificationToast({ 
  chatName, 
  messagePreview, 
  onClose, 
  onClick,
  duration = 5000 
}: SharedChatNotificationToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-6 right-6 z-50 max-w-sm bg-card border border-border rounded-lg shadow-xl overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground mb-1">
              Nova mensagem em {chatName}
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {messagePreview}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="shrink-0 p-1 hover:bg-muted rounded transition-colors duration-150"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
      <div className="h-1 bg-primary/20">
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className="h-full bg-primary"
        />
      </div>
    </motion.div>
  );
}
