import { useEffect, RefObject } from 'react';

/**
 * Hook para auto-resize de textarea baseado no conteúdo
 */
export function useAutoResizeTextarea(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxHeight: number = 200
) {
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height para recalcular
    textarea.style.height = 'auto';
    
    // Set nova height baseada no scrollHeight
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [value, textareaRef, maxHeight]);
}
