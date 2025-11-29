/**
 * NotificationBadge Component
 * 
 * Displays notification badge for new messages/updates
 */

import { motion, AnimatePresence } from 'framer-motion';

interface NotificationBadgeProps {
  count?: number;
  show: boolean;
  variant?: 'primary' | 'danger' | 'success';
  size?: 'sm' | 'md';
}

export function NotificationBadge({ 
  count, 
  show, 
  variant = 'primary',
  size = 'sm',
}: NotificationBadgeProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-4 h-4 text-[10px]',
  };

  const variantClasses = {
    primary: 'bg-primary',
    danger: 'bg-red-500',
    success: 'bg-green-500',
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`
            absolute -top-1 -right-1 
            ${sizeClasses[size]} 
            ${variantClasses[variant]} 
            rounded-full
            ${count !== undefined && size === 'md' ? 'flex items-center justify-center font-bold text-white' : ''}
          `}
        >
          {count !== undefined && size === 'md' && count > 0 && (
            <span>{count > 99 ? '99+' : count}</span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
