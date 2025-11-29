import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadString } from 'firebase/storage';
import { firestore, storage } from '@/lib/firebase';
import { logger } from '@/lib/utils/logger';

/**
 * Inicializa a estrutura do Firestore para um novo usuário
 * Cria todas as subcoleções e documentos necessários conforme documentação 17.1
 */
export async function initializeUserFirestore(userId: string, email: string, displayName: string) {
  try {
    logger.log('Inicializando Firestore para usuário:', userId);

    // 1. Documento principal do usuário (já criado no AuthContext)
    // 2. Profile settings
    await setDoc(doc(firestore, `users/${userId}/profile/settings`), {
      username: displayName,
      email,
      photoURL: '',
      createdAt: new Date(),
      lastLogin: new Date(),
    });

    // 3. Appearance config (configurações padrão)
    await setDoc(doc(firestore, `users/${userId}/appearance/config`), {
      theme: 'dark',
      font: 'Inter',
      fontSize: 16,
      accentColor: 'hsl(263 70% 50%)',
      sessionWords: 1000,
      alwaysSendLatexInstructions: false,
      latexInstructionLevel: 'medio',
    });

    logger.log('Estrutura Firestore criada com sucesso');
    return true;
  } catch (error) {
    logger.error('Erro ao inicializar Firestore:', error);
    throw error;
  }
}

/**
 * Inicializa a estrutura do Firebase Storage para um novo usuário
 * Cria as pastas necessárias conforme documentação 17.2
 */
export async function initializeUserStorage(userId: string) {
  try {
    logger.log('Inicializando Storage para usuário:', userId);

    // Criar estrutura de pastas no Storage
    // Firebase Storage não cria pastas vazias, então criamos arquivos .gitkeep

    const folders = [
      `users/${userId}/profile/.gitkeep`,
      `users/${userId}/chats/.gitkeep`,
      `users/${userId}/exports/.gitkeep`,
    ];

    for (const folderPath of folders) {
      const storageRef = ref(storage, folderPath);
      await uploadString(storageRef, '', 'raw');
    }

    logger.log('Estrutura Storage criada com sucesso');
    return true;
  } catch (error) {
    logger.error('Erro ao inicializar Storage:', error);
    throw error;
  }
}

/**
 * Inicialização completa do usuário (Firestore + Storage)
 */
export async function initializeNewUser(userId: string, email: string, displayName: string) {
  await Promise.all([
    initializeUserFirestore(userId, email, displayName),
    initializeUserStorage(userId),
  ]);
  
  logger.log('Usuário inicializado completamente:', userId);
}
