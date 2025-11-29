'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { logger } from '@/lib/utils/logger';

type Theme = 'light' | 'dark' | 'dracula';

interface ThemeContextType {
  theme: Theme;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const [theme, setThemeState] = useState<Theme>('light');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  // Load theme from user profile with migration
  useEffect(() => {
    if (userProfile?.theme) {
      // Migração: converter 'auto' para 'light' (permite string para migração)
      const savedTheme = userProfile.theme as string;
      const migratedTheme = savedTheme === 'auto' ? 'light' : (userProfile.theme as Theme);
      setThemeState(migratedTheme);
      
      // Se foi migrado, salvar no Firestore
      if (savedTheme === 'auto' && userProfile.uid) {
        const userDocRef = doc(firestore, 'users', userProfile.uid);
        updateDoc(userDocRef, { theme: 'light', updatedAt: new Date() })
          .catch((error) => logger.error('Erro ao migrar tema:', error));
      }
    } else {
      setThemeState('light'); // Padrão: light
    }
  }, [userProfile]);

  // Apply theme directly to document
  useEffect(() => {
    // Aplicar tema diretamente ao document
    const root = document.documentElement;
    root.classList.remove('light', 'dark', 'dracula');
    root.classList.add(theme);
    
    // Atualizar effectiveTheme (dracula retorna 'dark' para compatibilidade)
    setEffectiveTheme(theme === 'dracula' ? 'dark' : theme);
  }, [theme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);

    // Save to Firestore if user is authenticated
    if (userProfile?.uid) {
      try {
        const userDocRef = doc(firestore, 'users', userProfile.uid);
        await updateDoc(userDocRef, {
          theme: newTheme,
          updatedAt: new Date(),
        });
        logger.log('Tema salvo com sucesso:', newTheme);
      } catch (error) {
        logger.error('Erro ao salvar tema:', error);
      }
    }
  };

  const value: ThemeContextType = {
    theme,
    effectiveTheme,
    setTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  }
  return context;
}
