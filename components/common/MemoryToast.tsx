'use client';

import { useEffect, useState } from 'react';
import { Brain, X } from 'lucide-react';

interface MemoryToastProps {
  count: number;
  onDismiss: () => void;
  duration?: number;
}

/**
 * Toast notification for automatic memory saves
 * Shows a discrete notification when AI saves memories
 */
export function MemoryToast({ count, onDismiss, duration = 3000 }: MemoryToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300); // Wait for animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div className="bg-card border border-primary/30 shadow-lg rounded-lg px-4 py-3 flex items-center gap-3 min-w-[280px]">
        {/* Icon */}
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Brain className="w-5 h-5 text-primary" />
        </div>

        {/* Message */}
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            {count === 1 ? 'Nova memória salva' : `${count} novas memórias salvas`}
          </p>
          <p className="text-xs text-muted-foreground">
            Adicionada às memórias gerais
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onDismiss, 300);
          }}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
