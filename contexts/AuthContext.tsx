'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  updateEmail,
  updatePassword,
  fetchSignInMethodsForEmail,
  deleteUser,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  onSnapshot,
  deleteField,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, firestore, functions } from '@/lib/firebase';
import { logger } from '@/lib/utils/logger';
import { initializeNewUser } from '@/lib/services/firestore-init';
import {
  setCachedUserProfile,
  deleteCachedUserProfile,
  updateCachedUserProfile,
} from '@/lib/db/user-cache';
import { clearAllData } from '@/lib/db/indexeddb';
import { shouldClearCache, markCacheAsCleared } from '@/lib/services/admin-service';

import { PDFEngine, Memory, OpenRouterApiKey, AIPersonality } from '@/types/chat';

// Helper interface for Firestore data with proper typing
interface FirestoreApiKey {
  id: string;
  name: string;
  encryptedKey: string;
  provider?: 'openrouter' | 'gemini'; // Optional for backward compatibility
  isActive: boolean;
  createdAt: { toDate(): Date } | Date | string;
  lastUsedAt?: { toDate(): Date } | Date | string;
}

interface FirestoreMemory {
  id: string;
  content: string;
  color: string;
  createdAt: { toDate(): Date } | Date | string;
}

interface FirestorePersonality {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: { toDate(): Date } | Date | string;
  updatedAt: { toDate(): Date } | Date | string;
}

interface FirestoreUserData {
  email: string;
  displayName: string;
  photoURL?: string;
  photoStoragePath?: string;
  chatBackgroundURL?: string;
  chatBackgroundPath?: string;
  openRouterApiKey?: string;
  openRouterApiKeys?: FirestoreApiKey[];
  pdfEngine?: PDFEngine;
  defaultModel?: string;
  transcriptionModel?: string;
  fontFamily?: string;
  fontSize?: number;
  theme?: 'light' | 'dark' | 'dracula';
  favoriteModels?: string[];
  modelUsageCount?: Record<string, number>;
  globalMemories?: FirestoreMemory[];
  nickname?: string;
  aboutYou?: string;
  aiPersonalities?: FirestorePersonality[];
  createdAt: { toDate(): Date } | Date;
  updatedAt: { toDate(): Date } | Date;
}

// Types
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  photoStoragePath?: string;
  chatBackgroundURL?: string;
  chatBackgroundPath?: string;
  openRouterApiKey?: string; // Deprecated - kept for backward compatibility
  openRouterApiKeys?: OpenRouterApiKey[]; // Array of multiple API keys
  pdfEngine?: PDFEngine;
  defaultModel?: string; // Modelo padrão para novos chats
  transcriptionModel?: string; // Modelo Gemini usado para transcrição de áudio
  fontFamily?: string; // Fonte do chat
  fontSize?: number; // Tamanho da fonte do chat
  theme?: 'light' | 'dark' | 'dracula'; // Tema da interface
  favoriteModels?: string[]; // Modelos favoritados pelo usuário
  modelUsageCount?: Record<string, number>; // Contagem de uso de cada modelo
  globalMemories?: Memory[]; // Memórias globais do usuário
  nickname?: string; // Como a IA irá chamar o usuário
  aboutYou?: string; // Informações adicionais sobre o usuário
  aiPersonalities?: AIPersonality[]; // Personalidades customizadas da IA
  createdAt: Date;
  updatedAt: Date;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string, inviteCode: string) => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  changeEmail: (newEmail: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
}

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Carregar perfil do usuário do Firestore
  const loadUserProfile = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(firestore, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserProfile({
          uid,
          email: data.email,
          displayName: data.displayName,
          photoURL: data.photoURL,
          photoStoragePath: data.photoStoragePath,
          chatBackgroundURL: data.chatBackgroundURL,
          chatBackgroundPath: data.chatBackgroundPath,
          openRouterApiKey: data.openRouterApiKey,
          openRouterApiKeys: data.openRouterApiKeys?.map((key: FirestoreApiKey) => ({
            ...key,
            provider: key.provider || 'gemini',
            createdAt: typeof key.createdAt === 'object' && key.createdAt !== null && 'toDate' in key.createdAt
              ? key.createdAt.toDate()
              : new Date(key.createdAt),
            lastUsedAt: key.lastUsedAt 
              ? (typeof key.lastUsedAt === 'object' && key.lastUsedAt !== null && 'toDate' in key.lastUsedAt
                  ? key.lastUsedAt.toDate()
                  : new Date(key.lastUsedAt))
              : undefined,
          })) || [],
          pdfEngine: data.pdfEngine || 'pdf-text',
          defaultModel: data.defaultModel || 'google/gemini-2.0-flash-exp:free',
          transcriptionModel: (data.transcriptionModel || 'gemini-2.5-flash').replace('google/', ''),
          fontFamily: data.fontFamily || 'Inter',
          fontSize: data.fontSize || 16,
          theme: data.theme || 'light',
          favoriteModels: data.favoriteModels || [],
          modelUsageCount: data.modelUsageCount || {},
          globalMemories: data.globalMemories?.map((mem: FirestoreMemory) => ({
            ...mem,
            createdAt: typeof mem.createdAt === 'object' && mem.createdAt !== null && 'toDate' in mem.createdAt
              ? mem.createdAt.toDate()
              : new Date(mem.createdAt),
          })) || [],
          nickname: data.nickname || '',
          aboutYou: data.aboutYou || '',
          aiPersonalities: data.aiPersonalities?.map((p: FirestorePersonality) => ({
            ...p,
            createdAt: typeof p.createdAt === 'object' && p.createdAt !== null && 'toDate' in p.createdAt
              ? p.createdAt.toDate()
              : new Date(p.createdAt),
            updatedAt: typeof p.updatedAt === 'object' && p.updatedAt !== null && 'toDate' in p.updatedAt
              ? p.updatedAt.toDate()
              : new Date(p.updatedAt),
          })) || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      }
    } catch (error) {
      logger.error('Erro ao carregar perfil:', error);
    }
  };

  // Monitorar estado de autenticação e perfil do usuário
  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (!firebaseUser) {
        setUserProfile(null);
        setLoading(false);
      } else {
        // Check if admin forced cache clear for all users
        try {
          const shouldClear = await shouldClearCache(firebaseUser.uid);
          if (shouldClear) {
            logger.log('🧹 Admin forced cache clear - clearing IndexedDB...');
            await clearAllData();
            markCacheAsCleared(firebaseUser.uid);
            logger.log('✅ Cache cleared successfully');
            // Show notification to user (optional)
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('cache-cleared', {
                detail: { message: 'Cache atualizado para nova versão' }
              }));
            }
          }
        } catch (error) {
          logger.error('Error checking force cache clear:', error);
          // Don't block login if this fails
        }
      }
    });

    return authUnsubscribe;
  }, []);

  // Listener em tempo real para o perfil do usuário
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(firestore, 'users', user.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      {
        // Include metadata changes to handle offline/online transitions
        includeMetadataChanges: false,
      },
      (docSnap) => {
        try {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const profile: UserProfile = {
              uid: user.uid,
              email: data.email,
              displayName: data.displayName,
              photoURL: data.photoURL,
              photoStoragePath: data.photoStoragePath,
              openRouterApiKey: data.openRouterApiKey,
              openRouterApiKeys: data.openRouterApiKeys?.map((key: FirestoreApiKey) => ({
                ...key,
                provider: key.provider || 'gemini',
                createdAt: typeof key.createdAt === 'object' && key.createdAt !== null && 'toDate' in key.createdAt
                  ? key.createdAt.toDate()
                  : new Date(key.createdAt),
                lastUsedAt: key.lastUsedAt 
                  ? (typeof key.lastUsedAt === 'object' && key.lastUsedAt !== null && 'toDate' in key.lastUsedAt
                      ? key.lastUsedAt.toDate()
                      : new Date(key.lastUsedAt))
                  : undefined,
              })) || [],
              pdfEngine: data.pdfEngine || 'pdf-text',
              defaultModel: data.defaultModel || 'google/gemini-2.0-flash-exp:free',
              transcriptionModel: (data.transcriptionModel || 'gemini-2.5-flash').replace('google/', ''),
              fontFamily: data.fontFamily || 'Inter',
              fontSize: data.fontSize || 16,
              theme: data.theme || 'light',
              favoriteModels: data.favoriteModels || [],
              modelUsageCount: data.modelUsageCount || {},
              globalMemories: data.globalMemories?.map((mem: FirestoreMemory) => ({
                ...mem,
                createdAt: typeof mem.createdAt === 'object' && mem.createdAt !== null && 'toDate' in mem.createdAt
                  ? mem.createdAt.toDate()
                  : new Date(mem.createdAt),
              })) || [],
              nickname: data.nickname || '',
              aboutYou: data.aboutYou || '',
              aiPersonalities: data.aiPersonalities?.map((p: FirestorePersonality) => ({
                ...p,
                createdAt: typeof p.createdAt === 'object' && p.createdAt !== null && 'toDate' in p.createdAt
                  ? p.createdAt.toDate()
                  : new Date(p.createdAt),
                updatedAt: typeof p.updatedAt === 'object' && p.updatedAt !== null && 'toDate' in p.updatedAt
                  ? p.updatedAt.toDate()
                  : new Date(p.updatedAt),
              })) || [],
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            };
            
            setUserProfile(profile);
            
            // Update cache in background
            setCachedUserProfile(profile).catch(err => 
              logger.error('Error caching user profile:', err)
            );
          }
          setLoading(false);
        } catch (err) {
          logger.error('Erro ao processar snapshot do perfil:', err);
          setLoading(false);
        }
      },
      (error) => {
        // Only log transient network errors, don't crash the app
        if (error.code === 'unavailable' || error.message.includes('connection')) {
          logger.warn('Firestore connection temporarily unavailable (user profile). Will retry automatically.');
        } else {
          logger.error('Erro no listener do perfil:', error);
        }
        setLoading(false);
      }
    );

    return () => {
      try {
        unsubscribe();
      } catch (err) {
        // Ignore errors during cleanup
        logger.debug('Error during user profile listener cleanup:', err);
      }
    };
  }, [user]);

  // Registrar novo usuário
  const signUp = async (email: string, password: string, displayName: string, inviteCode: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedDisplayName = displayName.trim();
    const normalizedUsername = trimmedDisplayName.toLowerCase();
    const trimmedInviteCode = inviteCode.trim().toUpperCase();

    let newUser: User | null = null;

    try {
      // 1. Validar código de convite primeiro
      const adminManagerFn = httpsCallable(functions, 'adminManager');
      try {
        await adminManagerFn({ action: 'validateInviteCode', code: trimmedInviteCode });
      } catch (inviteError) {
        const error = inviteError as { message?: string };
        throw new Error(error.message || 'Código de convite inválido');
      }

      // 2. Verificar se email já existe
      const existingMethods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
      if (existingMethods.length > 0) {
        throw new Error('Este email já está em uso');
      }

      // 3. Criar conta no Firebase Auth (para ter permissões de autenticação)
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      newUser = userCredential.user;

      // 4. Verificar username duplicado (agora com autenticação)
      const usersRef = collection(firestore, 'users');
      const usernameQuery = query(
        usersRef,
        where('usernameLower', '==', normalizedUsername),
        limit(1)
      );
      const usernameSnapshot = await getDocs(usernameQuery);

      if (!usernameSnapshot.empty) {
        // Username já existe - fazer rollback
        await deleteUser(newUser);
        throw new Error('Este nome de usuário já está em uso');
      }

      // 5. Atualizar perfil no Firebase Auth
      await updateProfile(newUser, { displayName: trimmedDisplayName });
      
      // 6. Criar documento do usuário no Firestore
      const userProfile: UserProfile = {
        uid: newUser.uid,
        email: newUser.email!,
        displayName: trimmedDisplayName,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const userDocRef = doc(firestore, 'users', newUser.uid);

      await setDoc(userDocRef, {
        ...userProfile,
        photoURL: '',
        photoStoragePath: '',
        usernameLower: normalizedUsername,
        pdfEngine: 'pdf-text', // PDF engine padrão
        defaultModel: 'google/gemini-2.0-flash-exp:free', // Modelo padrão para novos chats
        transcriptionModel: 'google/gemini-2.0-flash-exp:free',
        transcriptionModelGemini: 'gemini-2.0-flash-exp',
        transcriptionModelOpenRouter: 'google/gemini-2.0-flash-exp:free',
        fontFamily: 'Inter', // Fonte padrão
        fontSize: 16, // Tamanho de fonte padrão
        theme: 'light', // Tema padrão
        favoriteModels: [],
        modelUsageCount: {}, // Inicializar vazio
        openRouterApiKeys: [], // Array vazio de API Keys
        globalMemories: [], // Memórias globais vazias
        nickname: trimmedDisplayName, // Apelido inicial = nome de usuário
        aboutYou: '', // Informações adicionais vazias
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 7. Inicializar estrutura completa do Firestore e Storage
      try {
        await initializeNewUser(newUser.uid, normalizedEmail, trimmedDisplayName);
      } catch (initError) {
        logger.error('Erro ao inicializar usuário, removendo conta criada:', initError);
        try {
          await deleteUser(newUser);
        } catch (cleanupError) {
          logger.error('Falha ao remover usuário após erro de inicialização:', cleanupError);
        }
        try {
          await deleteDoc(userDocRef);
        } catch (cleanupUserDocError) {
          logger.error('Falha ao remover documento do usuário após erro de inicialização:', cleanupUserDocError);
        }
        throw initError;
      }

      // 8. Marcar código de convite como usado
      try {
        await adminManagerFn({
          action: 'markInviteCodeUsed',
          code: trimmedInviteCode,
          userId: newUser.uid,
          userEmail: normalizedEmail,
          userName: trimmedDisplayName,
        });
      } catch (markError) {
        logger.error('Erro ao marcar código de convite como usado:', markError);
        // Não falhar o registro por causa disso
      }
      
      logger.log('Usuário registrado e inicializado:', newUser.uid);
    } catch (error) {
      logger.error('Erro ao registrar:', error);
      const authError = error as { code?: string; message?: string };
      
      // Preservar mensagens de erro customizadas
      if (authError.message && !authError.code) {
        throw new Error(authError.message);
      }
      
      // Traduzir erros do Firebase
      throw new Error(getAuthErrorMessage(authError.code || 'unknown'));
    }
  };

  // Login
  const signIn = async (identifier: string, password: string) => {
    try {
      const trimmedIdentifier = identifier.trim();
      let emailToUse = trimmedIdentifier;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isEmail = emailRegex.test(trimmedIdentifier.toLowerCase());

      if (!isEmail) {
        const normalizedUsername = trimmedIdentifier.toLowerCase();
        const usersRef = collection(firestore, 'users');
        const usernameQuery = query(
          usersRef,
          where('usernameLower', '==', normalizedUsername),
          limit(1)
        );

        const snapshot = await getDocs(usernameQuery);

        if (snapshot.empty) {
          throw new Error('Usuário não encontrado');
        }

        const userData = snapshot.docs[0].data();
        emailToUse = userData.email;
      } else {
        emailToUse = trimmedIdentifier.toLowerCase();
      }

      await signInWithEmailAndPassword(auth, emailToUse, password);
      logger.log('Login realizado');
    } catch (error) {
      logger.error('Erro ao fazer login:', error);
      const authError = error as { code?: string; message?: string };
      
      // Preservar mensagens de erro customizadas
      if (authError.message === 'Usuário não encontrado') {
        throw new Error(authError.message);
      }
      
      // Traduzir erros do Firebase
      throw new Error(getAuthErrorMessage(authError.code || 'unknown'));
    }
  };

  // Logout
  const logout = async () => {
    try {
      // Clear all IndexedDB cache
      try {
        await clearAllData();
        logger.log('Cache do IndexedDB limpo');
      } catch (cacheError) {
        logger.error('Erro ao limpar cache (não crítico):', cacheError);
        // Continue with logout even if cache clear fails
      }
      
      await signOut(auth);
      setUserProfile(null);
      logger.log('Logout realizado');
    } catch (error) {
      logger.error('Erro ao fazer logout:', error);
      throw new Error('Erro ao sair da conta');
    }
  };

  // Reset de senha
  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      logger.log('Email de reset enviado para:', email);
    } catch (error) {
      logger.error('Erro ao enviar email de reset:', error);
      const authError = error as { code?: string };
      throw new Error(getAuthErrorMessage(authError.code || 'unknown'));
    }
  };

  // Atualizar perfil do usuário
  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const hasDisplayName = Object.prototype.hasOwnProperty.call(data, 'displayName');
      const hasPhotoUrl = Object.prototype.hasOwnProperty.call(data, 'photoURL');

      if (hasDisplayName || hasPhotoUrl) {
        const authUpdate: { displayName?: string | null; photoURL?: string | null } = {};
        if (hasDisplayName) {
          authUpdate.displayName = data.displayName ?? null;
        }
        if (hasPhotoUrl) {
          authUpdate.photoURL = data.photoURL ?? null;
        }

        await updateProfile(user, authUpdate);
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined) {
          updateData[key] = deleteField();
        } else {
          updateData[key] = value;
        }
      }

      await setDoc(doc(firestore, 'users', user.uid), updateData, { merge: true });

      // Recarregar perfil
      await loadUserProfile(user.uid);
      
      // Update cache in background
      if (userProfile) {
        await updateCachedUserProfile(user.uid, data);
      }
      
      logger.log('Perfil atualizado');
    } catch (error) {
      logger.error('Erro ao atualizar perfil:', error);
      throw new Error('Erro ao atualizar perfil');
    }
  };

  // Alterar email
  const changeEmail = async (newEmail: string) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      await updateEmail(user, newEmail);
      
      await setDoc(
        doc(firestore, 'users', user.uid),
        { email: newEmail, updatedAt: new Date() },
        { merge: true }
      );
      
      logger.log('Email alterado');
    } catch (error) {
      logger.error('Erro ao alterar email:', error);
      const authError = error as { code?: string };
      throw new Error(getAuthErrorMessage(authError.code || 'unknown'));
    }
  };

  // Alterar senha
  const changePassword = async (newPassword: string) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      await updatePassword(user, newPassword);
      logger.log('Senha alterada');
    } catch (error) {
      logger.error('Erro ao alterar senha:', error);
      const authError = error as { code?: string };
      throw new Error(getAuthErrorMessage(authError.code || 'unknown'));
    }
  };

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    signUp,
    signIn,
    logout,
    resetPassword,
    updateUserProfile,
    changeEmail,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook customizado
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}

// Helper: Traduzir erros do Firebase
function getAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'Este email já está em uso';
    case 'auth/invalid-email':
      return 'Email inválido';
    case 'auth/operation-not-allowed':
      return 'Operação não permitida';
    case 'auth/weak-password':
      return 'Senha muito fraca (mínimo 6 caracteres)';
    case 'auth/user-disabled':
      return 'Usuário desabilitado';
    case 'auth/user-not-found':
      return 'Usuário não encontrado';
    case 'auth/wrong-password':
      return 'Senha incorreta';
    case 'auth/invalid-credential':
      return 'Credenciais inválidas';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Tente novamente mais tarde';
    case 'auth/requires-recent-login':
      return 'Por segurança, faça login novamente';
    case 'unknown':
    default:
      return 'Erro ao realizar operação';
  }
}
