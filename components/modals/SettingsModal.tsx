'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  X,
  User,
  Key,
  Moon,
  Sun,
  Shield,
  Trash2,
  Settings as SettingsIcon,
  Type,
  Palette,
  Check,
  FileText,
  Paintbrush,
  Brain,
  Plus,
  Edit2,
  CheckCircle2,
  Zap,
  Sparkles,
  Cpu,
  Music,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore, functions, storage } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { ref, deleteObject } from 'firebase/storage';
import { logger } from '@/lib/utils/logger';
import { PDFEngine } from '@/types/chat';
import { ModelSelectModal } from '@/components/modals/ModelSelectModal';
import { GeminiModelSelectModal } from '@/components/modals/GeminiModelSelectModal';
import { getModelName } from '@/lib/services/openrouter-service';
import { getGeminiModelInfo } from '@/lib/constants/gemini-models';
import { getFontFamily } from '@/lib/utils/font-mapper';
import { uploadProfilePhoto, uploadChatBackground } from '@/lib/services/upload-service';
import { MemoriesManager } from '@/components/common/MemoriesManager';
import { Memory, OpenRouterApiKey, AIPersonality } from '@/types/chat';
import { resetDB } from '@/lib/db/indexeddb';
import { useRouter } from 'next/navigation';
import { VampireIcon } from '@/components/common/VampireIcon';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'profile' | 'api' | 'preferences' | 'personalization' | 'memories' | 'security';

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { userProfile, updateUserProfile, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [fontSize, setFontSize] = useState(16);
  const [isSavingFontPreferences, setIsSavingFontPreferences] = useState(false);
  const [fontPreferencesSaved, setFontPreferencesSaved] = useState(false);
  
  // Personalização State
  const [nickname, setNickname] = useState('');
  const [aboutYou, setAboutYou] = useState('');
  const [isSavingPersonalization, setIsSavingPersonalization] = useState(false);
  const [personalizationSaved, setPersonalizationSaved] = useState(false);
  
  // Memories State
  const [globalMemories, setGlobalMemories] = useState<Memory[]>([]);

  // AI Personalities State
  const [aiPersonalities, setAiPersonalities] = useState<AIPersonality[]>([]);
  const [showAddPersonalityForm, setShowAddPersonalityForm] = useState(false);
  const [newPersonalityName, setNewPersonalityName] = useState('');
  const [newPersonalityDescription, setNewPersonalityDescription] = useState('');
  const [editingPersonalityId, setEditingPersonalityId] = useState<string | null>(null);
  const [editingPersonalityName, setEditingPersonalityName] = useState('');
  const [editingPersonalityDescription, setEditingPersonalityDescription] = useState('');

  // IndexedDB Reset State
  const [isResettingDB, setIsResettingDB] = useState(false);
  const [dbResetSuccess, setDbResetSuccess] = useState(false);

  // Logout State
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Chat Background State
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);
  const [chatBackgroundPreview, setChatBackgroundPreview] = useState<string | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  
  // Profile State
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  
  // Multiple API Keys State
  const [apiKeys, setApiKeys] = useState<OpenRouterApiKey[]>([]);
  const [showAddKeyForm, setShowAddKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyProvider, setNewKeyProvider] = useState<'openrouter' | 'gemini'>('gemini');
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [editingKeyName, setEditingKeyName] = useState('');
  
  // PDF Engine State
  const [pdfEngine, setPdfEngine] = useState<PDFEngine>('pdf-text');
  const [isSavingPdfEngine, setIsSavingPdfEngine] = useState(false);
  const [pdfEngineSaved, setPdfEngineSaved] = useState(false);
  
  // Função para salvar PDF Engine automaticamente
  const handlePdfEngineChange = async (newEngine: PDFEngine) => {
    if (!userProfile?.uid) return;
    
    setPdfEngine(newEngine);
    setIsSavingPdfEngine(true);
    setPdfEngineSaved(false);

    try {
      const userDocRef = doc(firestore, 'users', userProfile.uid);
      await updateDoc(userDocRef, {
        pdfEngine: newEngine,
        updatedAt: new Date(),
      });

      setPdfEngineSaved(true);
      logger.log('PDF Engine salvo automaticamente:', newEngine);

      // Reset success message after 2 seconds
      setTimeout(() => setPdfEngineSaved(false), 2000);
    } catch (error) {
      logger.error('Erro ao salvar PDF Engine:', error);
      // Reverter mudança em caso de erro
      setPdfEngine(pdfEngine);
    } finally {
      setIsSavingPdfEngine(false);
    }
  };
  
  // Default Model State
  const [defaultModel, setDefaultModel] = useState('');
  const [defaultModelName, setDefaultModelName] = useState('');
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const [isSavingDefaultModel, setIsSavingDefaultModel] = useState(false);
  const [defaultModelSaved, setDefaultModelSaved] = useState(false);

  // Transcription Model State
  const [transcriptionModel, setTranscriptionModel] = useState('');
  const [transcriptionModelName, setTranscriptionModelName] = useState('');
  const [transcriptionModelSelectOpen, setTranscriptionModelSelectOpen] = useState(false);
  const [isSavingTranscriptionModel, setIsSavingTranscriptionModel] = useState(false);
  const [transcriptionModelSaved, setTranscriptionModelSaved] = useState(false);

  // Load API Key, PDF Engine, Default Model, Font Preferences and Memories from user profile
  useEffect(() => {
    if (userProfile?.displayName) {
      setDisplayName(userProfile.displayName);
    }
    if (userProfile?.email) {
      setEmail(userProfile.email);
    }
    if (userProfile?.openRouterApiKeys) {
      setApiKeys(userProfile.openRouterApiKeys);
    }
    if (userProfile?.pdfEngine) {
      setPdfEngine(userProfile.pdfEngine);
    }
    if (userProfile?.defaultModel) {
      setDefaultModel(userProfile.defaultModel);
    }
    setTranscriptionModel(userProfile?.transcriptionModel || 'gemini-2.5-flash');
    if (userProfile?.fontFamily) {
      setFontFamily(userProfile.fontFamily);
    }
    if (userProfile?.fontSize) {
      setFontSize(userProfile.fontSize);
    }
    if (userProfile?.photoURL) {
      setPhotoPreview(userProfile.photoURL);
    } else {
      setPhotoPreview(null);
    }
    if (userProfile?.chatBackgroundURL) {
      setChatBackgroundPreview(userProfile.chatBackgroundURL);
    } else {
      setChatBackgroundPreview(null);
    }
    if (userProfile?.globalMemories) {
      setGlobalMemories(userProfile.globalMemories);
    }
    // Pre-fill nickname with displayName if no nickname is set
    if (userProfile?.nickname) {
      setNickname(userProfile.nickname);
    } else if (userProfile?.displayName) {
      setNickname(userProfile.displayName);
    }
    if (userProfile?.aboutYou) {
      setAboutYou(userProfile.aboutYou);
    }
    if (userProfile?.aiPersonalities) {
      setAiPersonalities(userProfile.aiPersonalities);
    }
  }, [userProfile]);
  
  // Fetch model name when defaultModel changes
  useEffect(() => {
    const fetchModelName = async () => {
      const name = await getModelName(defaultModel);
      setDefaultModelName(name);
    };
    
    fetchModelName();
  }, [defaultModel]);

  // Fetch transcription model name
  useEffect(() => {
    if (!transcriptionModel) {
      setTranscriptionModelName('');
      return;
    }

    const modelInfo = getGeminiModelInfo(transcriptionModel);
    setTranscriptionModelName(modelInfo?.name || transcriptionModel);
  }, [transcriptionModel]);

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0] || !userProfile?.uid) return;

    const file = event.target.files[0];

    setIsUploadingPhoto(true);

    try {
      const result = await uploadProfilePhoto(file, userProfile.uid, userProfile.photoStoragePath);

      await updateUserProfile({
        photoURL: result.url,
        photoStoragePath: result.storagePath,
      });

      setPhotoPreview(result.url);
      logger.log('Foto de perfil atualizada');
    } catch (error: unknown) {
      const err = error as { message?: string };
      logger.error('Erro ao atualizar foto de perfil:', error);
      alert(err?.message || 'Erro ao atualizar foto de perfil. Tente novamente.');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleBackgroundChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0] || !userProfile?.uid) return;

    const file = event.target.files[0];

    setIsUploadingBackground(true);

    try {
      const result = await uploadChatBackground(file, userProfile.uid, userProfile.chatBackgroundPath);

      await updateUserProfile({
        chatBackgroundURL: result.url,
        chatBackgroundPath: result.storagePath,
      });

      setChatBackgroundPreview(result.url);
      logger.log('Background do chat atualizado');
    } catch (error: unknown) {
      const err = error as { message?: string };
      logger.error('Erro ao atualizar background do chat:', error);
      alert(err?.message || 'Erro ao atualizar background do chat. Tente novamente.');
    } finally {
      setIsUploadingBackground(false);
      if (backgroundInputRef.current) {
        backgroundInputRef.current.value = '';
      }
    }
  };

  const handleRemoveBackground = async () => {
    if (!userProfile?.uid) return;

    try {
      // Deletar imagem do Storage se existir
      if (userProfile.chatBackgroundPath) {
        try {
          await deleteObject(ref(storage, userProfile.chatBackgroundPath));
          logger.log('Background deletado do Storage');
        } catch (deleteError) {
          logger.warn('Não foi possível deletar background do Storage:', deleteError);
        }
      }

      await updateUserProfile({
        chatBackgroundURL: '',
        chatBackgroundPath: undefined,
      });

      setChatBackgroundPreview(null);
      logger.log('Background do chat removido');
    } catch (error) {
      logger.error('Erro ao remover background do chat:', error);
      alert('Erro ao remover background do chat. Tente novamente.');
    }
  };

  const handleSaveProfile = async () => {
    if (!userProfile?.uid) return;
    
    setIsSavingProfile(true);
    setProfileSaved(false);

    try {
      const userDocRef = doc(firestore, 'users', userProfile.uid);
      await updateDoc(userDocRef, {
        displayName: displayName.trim(),
        email: email.trim(),
        updatedAt: new Date(),
      });

      setProfileSaved(true);
      logger.log('Perfil atualizado com sucesso');

      // Reset success message after 3 seconds
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (error) {
      logger.error('Erro ao salvar perfil:', error);
      alert('Erro ao salvar perfil. Tente novamente.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Funções para gerenciar múltiplas API Keys
  const handleAddApiKey = async () => {
    if (!userProfile?.uid || !newKeyName.trim() || !newKeyValue.trim()) return;
    
    setIsAddingKey(true);

    try {
      const manageApiKeysFn = httpsCallable(functions, 'manageApiKeys');
      await manageApiKeysFn({ 
        action: 'add',
        apiKey: newKeyValue.trim(),
        name: newKeyName.trim(),
        provider: newKeyProvider,
      });

      // Resetar form
      setNewKeyName('');
      setNewKeyValue('');
      setNewKeyProvider('gemini'); // Reset para default
      setShowAddKeyForm(false);
      
      logger.log('API Key adicionada com sucesso', { provider: newKeyProvider });
      
      // Se for a primeira API Key, ela será ativada automaticamente
      // então disparamos evento para atualizar o saldo
      if (apiKeys.length === 0 && newKeyProvider === 'openrouter') {
        setTimeout(() => {
          // Disparar evento customizado para forçar refresh do saldo no dashboard
          window.dispatchEvent(new Event('refreshOpenRouterBalance'));
          logger.log('Evento de refresh do saldo disparado (primeira chave)');
        }, 1500); // Delay para propagação do Firestore
      }
    } catch (error: unknown) {
      logger.error('Erro ao adicionar API Key:', error);
      alert(error instanceof Error ? error.message : 'Erro ao adicionar API Key. Tente novamente.');
    } finally {
      setIsAddingKey(false);
    }
  };

  const handleRemoveApiKey = async (keyId: string) => {
    if (!userProfile?.uid) return;
    
    if (!confirm('Tem certeza que deseja remover esta API Key?')) return;

    try {
      const manageApiKeysFn = httpsCallable(functions, 'manageApiKeys');
      await manageApiKeysFn({ 
        action: 'remove',
        keyId 
      });
      
      logger.log('API Key removida com sucesso');
    } catch (error: unknown) {
      logger.error('Erro ao remover API Key:', error);
      alert(error instanceof Error ? error.message : 'Erro ao remover API Key. Tente novamente.');
    }
  };

  const handleSetActiveApiKey = async (keyId: string) => {
    if (!userProfile?.uid) return;

    try {
      const manageApiKeysFn = httpsCallable(functions, 'manageApiKeys');
      await manageApiKeysFn({ 
        action: 'setActive',
        keyId 
      });
      
      logger.log('API Key ativada com sucesso');
      
      // Aguardar um pouco para o Firestore propagar a mudança
      // antes de disparar evento para atualizar o saldo
      setTimeout(() => {
        // Disparar evento customizado para forçar refresh do saldo no dashboard
        window.dispatchEvent(new Event('refreshOpenRouterBalance'));
        logger.log('Evento de refresh do saldo disparado');
      }, 1500); // 1.5 segundos de delay para garantir propagação do Firestore
    } catch (error: unknown) {
      logger.error('Erro ao ativar API Key:', error);
      alert(error instanceof Error ? error.message : 'Erro ao ativar API Key. Tente novamente.');
    }
  };

  const handleUpdateApiKeyName = async (keyId: string, newName: string) => {
    if (!userProfile?.uid || !newName.trim()) return;

    try {
      const manageApiKeysFn = httpsCallable(functions, 'manageApiKeys');
      await manageApiKeysFn({ 
        action: 'updateName',
        keyId, 
        name: newName.trim() 
      });
      
      setEditingKeyId(null);
      setEditingKeyName('');
      logger.log('Nome da API Key atualizado com sucesso');
    } catch (error: unknown) {
      logger.error('Erro ao atualizar nome da API Key:', error);
      alert(error instanceof Error ? error.message : 'Erro ao atualizar nome. Tente novamente.');
    }
  };

  const handleMigrateApiKey = async () => {
    if (!userProfile?.uid) return;

    try {
      const manageApiKeysFn = httpsCallable(functions, 'manageApiKeys');
      const result = await manageApiKeysFn({ action: 'migrate' });
      
      if ((result.data as { migrated?: boolean }).migrated) {
        logger.log('API Key migrada com sucesso');
        alert('API Key migrada para o novo formato com sucesso!');
        
        // Atualizar saldo após migração
        setTimeout(() => {
          // Disparar evento customizado para forçar refresh do saldo no dashboard
          window.dispatchEvent(new Event('refreshOpenRouterBalance'));
          logger.log('Evento de refresh do saldo disparado (migração)');
        }, 1500); // Delay para propagação do Firestore
      }
    } catch (error: unknown) {
      logger.error('Erro ao migrar API Key:', error);
      alert(error instanceof Error ? error.message : 'Erro ao migrar API Key. Tente novamente.');
    }
  };

  // Função para salvar modelo padrão automaticamente
  const handleDefaultModelChange = async (newModel: string) => {
    if (!userProfile?.uid) return;
    
    setDefaultModel(newModel);
    setIsSavingDefaultModel(true);
    setDefaultModelSaved(false);

    try {
      const userDocRef = doc(firestore, 'users', userProfile.uid);
      await updateDoc(userDocRef, {
        defaultModel: newModel,
        updatedAt: new Date(),
      });

      setDefaultModelSaved(true);
      logger.log('Modelo padrão salvo automaticamente:', newModel);

      // Reset success message after 2 seconds
      setTimeout(() => setDefaultModelSaved(false), 2000);
    } catch (error) {
      logger.error('Erro ao salvar modelo padrão:', error);
      // Reverter mudança em caso de erro
      setDefaultModel(defaultModel);
    } finally {
      setIsSavingDefaultModel(false);
    }
  };

  // Função para salvar modelo de transcrição automaticamente
  const handleTranscriptionModelChange = async (newModel: string) => {
    if (!userProfile?.uid) return;

    const previousModel = transcriptionModel;
    setTranscriptionModel(newModel);
    setIsSavingTranscriptionModel(true);
    setTranscriptionModelSaved(false);

    try {
      const userDocRef = doc(firestore, 'users', userProfile.uid);
      await updateDoc(userDocRef, {
        transcriptionModel: newModel,
        updatedAt: new Date(),
      });

      setTranscriptionModelSaved(true);
      logger.log('Modelo de transcrição salvo automaticamente:', newModel);

      // Reset success message after 2 seconds
      setTimeout(() => setTranscriptionModelSaved(false), 2000);
    } catch (error) {
      logger.error('Erro ao salvar modelo de transcrição:', error);
      setTranscriptionModel(previousModel);
    } finally {
      setIsSavingTranscriptionModel(false);
    }
  };

  const handleSaveFontPreferences = async () => {
    if (!userProfile?.uid) return;
    
    setIsSavingFontPreferences(true);
    setFontPreferencesSaved(false);

    try {
      const userDocRef = doc(firestore, 'users', userProfile.uid);
      await updateDoc(userDocRef, {
        fontFamily,
        fontSize,
        updatedAt: new Date(),
      });

      setFontPreferencesSaved(true);
      logger.log('Preferências de fonte salvas com sucesso:', { fontFamily, fontSize });

      // Reset success message after 3 seconds
      setTimeout(() => setFontPreferencesSaved(false), 3000);
    } catch (error) {
      logger.error('Erro ao salvar preferências de fonte:', error);
      alert('Erro ao salvar preferências de fonte. Tente novamente.');
    } finally {
      setIsSavingFontPreferences(false);
    }
  };

  const handleSavePersonalization = async () => {
    if (!userProfile?.uid) return;
    
    setIsSavingPersonalization(true);
    setPersonalizationSaved(false);

    try {
      const userDocRef = doc(firestore, 'users', userProfile.uid);
      await updateDoc(userDocRef, {
        nickname: nickname.trim(),
        aboutYou: aboutYou.trim(),
        updatedAt: new Date(),
      });

      setPersonalizationSaved(true);
      logger.log('Personalização salva com sucesso:', { nickname, aboutYou });

      // Reset success message after 3 seconds
      setTimeout(() => setPersonalizationSaved(false), 3000);
    } catch (error) {
      logger.error('Erro ao salvar personalização:', error);
      alert('Erro ao salvar personalização. Tente novamente.');
    } finally {
      setIsSavingPersonalization(false);
    }
  };

  // Função de auto-save para memórias (chamada automaticamente)
  const handleAutoSaveMemories = async (updatedMemories: Memory[]) => {
    if (!userProfile?.uid) return;

    try {
      const userDocRef = doc(firestore, 'users', userProfile.uid);
      await updateDoc(userDocRef, {
        globalMemories: updatedMemories.map(mem => ({
          id: mem.id,
          content: mem.content,
          color: mem.color,
          createdAt: mem.createdAt,
        })),
        updatedAt: new Date(),
      });

      logger.log('Memórias globais salvas automaticamente:', updatedMemories.length);
    } catch (error) {
      logger.error('Erro ao salvar memórias:', error);
      alert('Erro ao salvar memórias. Tente novamente.');
    }
  };

  // Funções para gerenciar AI Personalities
  const handleAddPersonality = async () => {
    if (!userProfile?.uid || !newPersonalityName.trim() || !newPersonalityDescription.trim()) return;

    try {
      const newPersonality: AIPersonality = {
        id: Date.now().toString(),
        name: newPersonalityName.trim(),
        description: newPersonalityDescription.trim(),
        isActive: aiPersonalities.length === 0, // Primeira personalidade é ativada automaticamente
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedPersonalities = [...aiPersonalities, newPersonality];

      const userDocRef = doc(firestore, 'users', userProfile.uid);
      await updateDoc(userDocRef, {
        aiPersonalities: updatedPersonalities.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          isActive: p.isActive,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        updatedAt: new Date(),
      });
      
      // Atualizar o estado local
      setAiPersonalities(updatedPersonalities);
      
      // Atualizar o userProfile no context
      await updateUserProfile({ aiPersonalities: updatedPersonalities });

      setNewPersonalityName('');
      setNewPersonalityDescription('');
      setShowAddPersonalityForm(false);
      logger.log('Personalidade adicionada com sucesso');
    } catch (error) {
      logger.error('Erro ao adicionar personalidade:', error);
      alert('Erro ao adicionar personalidade. Tente novamente.');
    }
  };

  const handleRemovePersonality = async (personalityId: string) => {
    if (!userProfile?.uid) return;
    
    if (!confirm('Tem certeza que deseja remover esta personalidade?')) return;

    try {
      const updatedPersonalities = aiPersonalities.filter(p => p.id !== personalityId);
      setAiPersonalities(updatedPersonalities);

      const userDocRef = doc(firestore, 'users', userProfile.uid);
      await updateDoc(userDocRef, {
        aiPersonalities: updatedPersonalities.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          isActive: p.isActive,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        updatedAt: new Date(),
      });

      logger.log('Personalidade removida com sucesso');
    } catch (error) {
      logger.error('Erro ao remover personalidade:', error);
      alert('Erro ao remover personalidade. Tente novamente.');
    }
  };

  const handleSetActivePersonality = async (personalityId: string | null) => {
    if (!userProfile?.uid) return;

    try {
      const updatedPersonalities = aiPersonalities.map(p => ({
        ...p,
        isActive: p.id === personalityId,
      }));
      setAiPersonalities(updatedPersonalities);

      const userDocRef = doc(firestore, 'users', userProfile.uid);
      await updateDoc(userDocRef, {
        aiPersonalities: updatedPersonalities.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          isActive: p.isActive,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        updatedAt: new Date(),
      });

      logger.log('Personalidade ativada com sucesso');
    } catch (error) {
      logger.error('Erro ao ativar personalidade:', error);
      alert('Erro ao ativar personalidade. Tente novamente.');
    }
  };

  const handleUpdatePersonality = async (personalityId: string, name: string, description: string) => {
    if (!userProfile?.uid || !name.trim() || !description.trim()) return;

    try {
      const updatedPersonalities = aiPersonalities.map(p => 
        p.id === personalityId 
          ? { ...p, name: name.trim(), description: description.trim(), updatedAt: new Date() }
          : p
      );
      setAiPersonalities(updatedPersonalities);

      const userDocRef = doc(firestore, 'users', userProfile.uid);
      await updateDoc(userDocRef, {
        aiPersonalities: updatedPersonalities.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          isActive: p.isActive,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        updatedAt: new Date(),
      });

      setEditingPersonalityId(null);
      setEditingPersonalityName('');
      setEditingPersonalityDescription('');
      logger.log('Personalidade atualizada com sucesso');
    } catch (error) {
      logger.error('Erro ao atualizar personalidade:', error);
      alert('Erro ao atualizar personalidade. Tente novamente.');
    }
  };

  const handleResetIndexedDB = async () => {
    if (!confirm('Tem certeza que deseja resetar o cache local (IndexedDB)? Esta ação não afetará seus dados salvos no servidor, mas limpará todo o cache local.')) {
      return;
    }

    setIsResettingDB(true);
    setDbResetSuccess(false);

    try {
      await resetDB();
      setDbResetSuccess(true);
      logger.log('IndexedDB resetado com sucesso');
      
      // Mostrar mensagem de sucesso e recarregar a página após um delay
      setTimeout(() => {
        alert('Cache local resetado com sucesso! A página será recarregada.');
        window.location.reload();
      }, 1000);
    } catch (error) {
      logger.error('Erro ao resetar IndexedDB:', error);
      alert('Erro ao resetar cache local. Tente fechar todas as abas do site e tente novamente.');
    } finally {
      setIsResettingDB(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Tem certeza que deseja sair da sua conta? Todo o cache local será limpo.')) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await logout();
      logger.log('Logout realizado com sucesso');
      onClose();
      router.push('/auth/signin');
    } catch (error) {
      logger.error('Erro ao fazer logout:', error);
      alert('Erro ao sair da conta. Tente novamente.');
      setIsLoggingOut(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'profile' as SettingsTab, label: 'Perfil', icon: User },
    { id: 'preferences' as SettingsTab, label: 'Preferências', icon: SettingsIcon },
    { id: 'personalization' as SettingsTab, label: 'Personalização', icon: Paintbrush },
    { id: 'memories' as SettingsTab, label: 'Memórias', icon: Brain },
    { id: 'api' as SettingsTab, label: 'API Keys', icon: Key },
    { id: 'security' as SettingsTab, label: 'Segurança', icon: Shield },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center md:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full h-full md:h-[85vh] md:max-w-4xl bg-card border-0 md:border border-border md:rounded-2xl shadow-lg flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
        {/* Header with Mobile Dropdown */}
        <div className="flex-shrink-0 border-b border-border px-4 md:px-6 py-4 bg-card">
          <div className="flex items-center justify-between mb-4 md:mb-0">
            <h2 className="text-lg md:text-xl font-semibold text-foreground">Configurações</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors duration-150"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          
          {/* Mobile Tab Selector (Dropdown) */}
          <div className="md:hidden">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as SettingsTab)}
              className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200 appearance-none bg-no-repeat bg-right pr-10"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1.25rem',
              }}
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Desktop Sidebar & Mobile Content Container */}
        <div className="flex-1 flex overflow-hidden">
          {/* Desktop Sidebar (hidden on mobile) */}
          <div className="hidden md:block w-64 border-r border-border p-4 overflow-y-auto">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full px-3 py-2 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors duration-150 ${
                      activeTab === tab.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {activeTab === 'profile' && (
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4 md:mb-6">Perfil do Usuário</h3>

              <div className="space-y-4 md:space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative w-20 h-20">
                    {photoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoPreview}
                        alt="Foto de perfil"
                        className="w-20 h-20 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-2xl font-semibold text-muted-foreground border border-border">
                        {userProfile?.displayName?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}

                    {isUploadingPhoto && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-1 text-white text-xs rounded-full">
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Atualizando...</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-center sm:text-left">
                    <p className="text-sm text-muted-foreground">
                      Utilize uma imagem quadrada em PNG, JPG, JPEG, WEBP ou GIF (máx. 20MB).
                    </p>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors duration-150"
                        disabled={isUploadingPhoto}
                      >
                        Alterar Foto
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoPreview(null);
                          updateUserProfile({ photoURL: '', photoStoragePath: undefined });
                        }}
                        className="text-sm text-destructive hover:underline disabled:opacity-50"
                        disabled={isUploadingPhoto || !userProfile?.photoURL}
                      >
                        Remover
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                      className="hidden"
                      onChange={handlePhotoChange}
                      disabled={isUploadingPhoto}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nome de Usuário
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile || !displayName.trim()}
                    className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground font-medium rounded-lg shadow-sm transition-colors duration-200 flex items-center gap-2"
                  >
                    {isSavingProfile ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Alterações'
                    )}
                  </button>

                  {profileSaved && (
                    <div className="flex items-center gap-2 text-green-600 animate-in fade-in duration-200">
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">Salvo com sucesso!</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4 md:mb-6">Chaves de API</h3>

              <div className="space-y-6">
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm text-primary font-medium mb-2">🔒 Segurança e Criptografia</p>
                  <p className="text-sm text-muted-foreground">
                    Suas API Keys são <strong>criptografadas</strong> usando AES-256-GCM antes de serem 
                    armazenadas no Firestore. Mesmo com acesso ao banco de dados, suas chaves permanecem seguras. 
                    Nunca as compartilhe com ninguém.
                  </p>
                </div>

                {/* Migração de API Key antiga */}
                {userProfile?.openRouterApiKey && apiKeys.length === 0 && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm text-yellow-600 dark:text-yellow-500 font-medium mb-2">
                      ⚠️ Migração Disponível
                    </p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Você tem uma API Key no formato antigo. Migre para o novo formato que suporta múltiplas chaves.
                    </p>
                    <button
                      onClick={handleMigrateApiKey}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Migrar Agora
                    </button>
                  </div>
                )}

                {/* Lista de API Keys */}
                {apiKeys.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-foreground">
                        Suas API Keys de Transcrição
                      </label>
                      <button
                        onClick={() => setShowAddKeyForm(true)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar
                      </button>
                    </div>
                    
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        💡 <strong>Dica:</strong> Você pode ter uma chave Gemini e uma OpenRouter ativas ao mesmo tempo. 
                        Gemini é usado apenas para transcrição de áudio, enquanto OpenRouter é para chat/conversação.
                      </p>
                    </div>

                    <div className="space-y-2">
                      {apiKeys.map((key) => (
                        <div
                          key={key.id}
                          className={`p-3 md:p-4 border-2 rounded-lg transition-all ${
                            key.isActive
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-background hover:border-primary/30'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              {editingKeyId === key.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingKeyName}
                                    onChange={(e) => setEditingKeyName(e.target.value)}
                                    className="flex-1 px-3 py-1.5 bg-background text-foreground border border-border rounded-lg focus:border-primary outline-none"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleUpdateApiKeyName(key.id, editingKeyName)}
                                    className="p-1.5 text-green-600 hover:bg-green-600/10 rounded-lg transition-colors"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingKeyId(null);
                                      setEditingKeyName('');
                                    }}
                                    className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-semibold text-foreground">{key.name}</h4>
                                  {key.provider === 'gemini' ? (
                                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-medium rounded-full">
                                      Gemini
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full">
                                      OpenRouter
                                    </span>
                                  )}
                                  {key.isActive && (
                                    <>
                                      <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/20 text-primary text-xs font-medium rounded-full">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Ativa
                                      </span>
                                      <button
                                        onClick={() => {
                                          setEditingKeyId(key.id);
                                          setEditingKeyName(key.name);
                                        }}
                                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                  {!key.isActive && (
                                    <button
                                      onClick={() => {
                                        setEditingKeyId(key.id);
                                        setEditingKeyName(key.name);
                                      }}
                                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                              <p className="text-sm text-muted-foreground mt-1">
                                Criada em {new Date(key.createdAt).toLocaleDateString('pt-BR')}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 sm:flex-shrink-0">
                              {!key.isActive && (
                                <button
                                  onClick={() => handleSetActiveApiKey(key.id)}
                                  className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                >
                                  Ativar
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveApiKey(key.id)}
                                className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                disabled={apiKeys.length === 1}
                                title={apiKeys.length === 1 ? 'Não é possível remover a única chave' : 'Remover chave'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Formulário para adicionar nova API Key */}
                {showAddKeyForm && (
                  <div className="p-3 md:p-4 border-2 border-primary rounded-lg bg-primary/5 space-y-3 md:space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-foreground">Adicionar Nova API Key</h4>
                      <button
                        onClick={() => {
                          setShowAddKeyForm(false);
                          setNewKeyName('');
                          setNewKeyValue('');
                        }}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Provider
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewKeyProvider('gemini')}
                          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                            newKeyProvider === 'gemini'
                              ? 'bg-purple-500 text-white shadow-sm'
                              : 'bg-background text-foreground border border-border hover:border-purple-300'
                          }`}
                        >
                          Gemini
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewKeyProvider('openrouter')}
                          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                            newKeyProvider === 'openrouter'
                              ? 'bg-blue-500 text-white shadow-sm'
                              : 'bg-background text-foreground border border-border hover:border-blue-300'
                          }`}
                        >
                          OpenRouter
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {newKeyProvider === 'gemini' ? 'Grátis: 200 transcrições/dia' : 'Pago por uso (BYOK)'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Nome da Chave
                      </label>
                      <input
                        type="text"
                        placeholder={newKeyProvider === 'gemini' ? 'Ex: Gemini Principal' : 'Ex: OpenRouter Pessoal'}
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        API Key
                      </label>
                      <input
                        type="password"
                        placeholder={newKeyProvider === 'gemini' ? 'AIza...' : 'sk-or-v1-...'}
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                        className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Obtenha sua chave em{' '}
                        <a
                          href={newKeyProvider === 'gemini' ? 'https://aistudio.google.com/app/apikey' : 'https://openrouter.ai/keys'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {newKeyProvider === 'gemini' ? 'Google AI Studio' : 'OpenRouter.ai'}
                        </a>
                      </p>
                    </div>

                    <button
                      onClick={handleAddApiKey}
                      disabled={isAddingKey || !newKeyName.trim() || !newKeyValue.trim()}
                      className="w-full px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground font-medium rounded-lg shadow-sm transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                      {isAddingKey ? (
                        <>
                          <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          Adicionando...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Adicionar Chave
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Botão para mostrar formulário se não houver chaves */}
                {apiKeys.length === 0 && !showAddKeyForm && !userProfile?.openRouterApiKey && (
                  <button
                    onClick={() => setShowAddKeyForm(true)}
                    className="w-full px-6 py-3 border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 text-foreground font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Adicionar Primeira API Key
                  </button>
                )}

                {/* Default Model Configuration */}
                <div className="pt-6 border-t border-border">
                  <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Modelo Padrão para Novos Chats
                  </label>
                  
                  <button
                    onClick={() => setModelSelectOpen(true)}
                    disabled={isSavingDefaultModel}
                    className="w-full px-4 py-3 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-lg text-left hover:border-primary/40 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Modelo Atual</p>
                          <p className="text-sm font-semibold text-foreground">
                            {defaultModelName || 'Selecione um modelo...'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-primary group-hover:translate-x-1 transition-transform duration-200">
                        Alterar →
                      </span>
                    </div>
                  </button>
                  
                  {/* Feedback de salvamento automático */}
                  {defaultModelSaved && (
                    <div className="flex items-center justify-center gap-2 text-green-600 animate-in fade-in duration-200 py-2 mt-2">
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">Salvo automaticamente!</span>
                    </div>
                  )}
                </div>

                {/* Audio Transcription Model Configuration */}
                <div className="pt-6 border-t border-border">
                  <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Music className="w-4 h-4 text-foreground" />
                    Modelo de Transcrição de Áudio (Gemini)
                  </label>

                  <button
                    onClick={() => setTranscriptionModelSelectOpen(true)}
                    disabled={isSavingTranscriptionModel}
                    className="w-full px-4 py-3 bg-gradient-to-r from-purple/10 to-pink-500/10 border border-purple-500/20 rounded-lg text-left hover:border-purple-500/40 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                          <Music className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Modelo Gemini para Transcrição</p>
                          <p className="text-sm font-semibold text-foreground">
                            {transcriptionModelName || 'Selecione um modelo...'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-transform duration-200">
                        Alterar →
                      </span>
                    </div>
                  </button>

                  {transcriptionModelSaved && (
                    <div className="flex items-center justify-center gap-2 text-green-600 animate-in fade-in duration-200 py-2 mt-2">
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">Salvo automaticamente!</span>
                    </div>
                  )}
                </div>

                {/* PDF Engine Configuration */}
                <div className="pt-6 border-t border-border">
                  <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Engine de Processamento de PDF
                  </label>
                  
                  <div className="space-y-3">
                    {/* PDF Engine Options */}
                    <div className="space-y-3">
                      {/* Mistral OCR - Pago */}
                      <label className={`group relative flex items-start gap-3 p-3 md:gap-4 md:p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                        pdfEngine === 'mistral-ocr'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20 shadow-sm'
                          : 'border-border hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-950/10'
                      }`}>
                        <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg transition-colors ${
                          pdfEngine === 'mistral-ocr'
                            ? 'bg-purple-500 text-white'
                            : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50'
                        }`}>
                          <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-foreground">Mistral OCR</p>
                            <span className="px-2 py-0.5 text-xs font-medium bg-purple-500 text-white rounded-full">
                              Pago
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Ideal para PDFs escaneados ou com imagens. Usa OCR avançado. Custo: ~$0.01 por 1.000 páginas.
                          </p>
                        </div>
                        <input
                          type="radio"
                          name="pdfEngine"
                          value="mistral-ocr"
                          checked={pdfEngine === 'mistral-ocr'}
                          onChange={(e) => handlePdfEngineChange(e.target.value as PDFEngine)}
                          className="mt-1"
                          disabled={isSavingPdfEngine}
                        />
                      </label>

                      {/* Native - Modelo Nativo */}
                      <label className={`group relative flex items-start gap-3 p-3 md:gap-4 md:p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                        pdfEngine === 'native'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-sm'
                          : 'border-border hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/10'
                      }`}>
                        <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg transition-colors ${
                          pdfEngine === 'native'
                            ? 'bg-blue-500 text-white'
                            : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50'
                        }`}>
                          <Cpu className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-foreground">Native (Modelo Nativo)</p>
                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full">
                              Tokens
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Usa a capacidade nativa do modelo de processar PDFs. Disponível apenas para modelos compatíveis. Cobrado como tokens de entrada.
                          </p>
                        </div>
                        <input
                          type="radio"
                          name="pdfEngine"
                          value="native"
                          checked={pdfEngine === 'native'}
                          onChange={(e) => handlePdfEngineChange(e.target.value as PDFEngine)}
                          className="mt-1"
                          disabled={isSavingPdfEngine}
                        />
                      </label>

                      {/* PDF Text - Gratuito */}
                      <label className={`group relative flex items-start gap-3 p-3 md:gap-4 md:p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                        pdfEngine === 'pdf-text'
                          ? 'border-green-500 bg-green-50 dark:bg-green-950/20 shadow-sm'
                          : 'border-border hover:border-green-300 hover:bg-green-50/50 dark:hover:bg-green-950/10'
                      }`}>
                        <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg transition-colors ${
                          pdfEngine === 'pdf-text'
                            ? 'bg-green-500 text-white'
                            : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 group-hover:bg-green-200 dark:group-hover:bg-green-900/50'
                        }`}>
                          <Zap className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-foreground">PDF Text</p>
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-500 text-white rounded-full">
                              Gratuito
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Melhor para PDFs bem estruturados com texto claro. Extração rápida e gratuita.
                          </p>
                        </div>
                        <input
                          type="radio"
                          name="pdfEngine"
                          value="pdf-text"
                          checked={pdfEngine === 'pdf-text'}
                          onChange={(e) => handlePdfEngineChange(e.target.value as PDFEngine)}
                          className="mt-1"
                          disabled={isSavingPdfEngine}
                        />
                      </label>
                    </div>

                    {/* Feedback de salvamento automático */}
                    {pdfEngineSaved && (
                      <div className="flex items-center justify-center gap-2 text-green-600 animate-in fade-in duration-200 py-2">
                        <Check className="w-4 h-4" />
                        <span className="text-sm font-medium">Salvo automaticamente!</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4 md:mb-6">Preferências</h3>

              <div className="space-y-6 md:space-y-8">
                {/* Seção: Aparência */}
                <div>
                  <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Aparência
                  </h4>
                  
                  <div className="space-y-6 pl-7">
                    {/* Tema */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-3">
                        Tema da Interface
                      </label>
                      <div className="grid grid-cols-3 gap-2 md:gap-3">
                        {(['light', 'dark', 'dracula'] as const).map((themeOption) => (
                          <button
                            key={themeOption}
                            onClick={() => setTheme(themeOption)}
                            className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                              theme === themeOption
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/30 hover:bg-muted'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-2">
                              {themeOption === 'light' ? (
                                <Sun className="w-5 h-5 text-foreground" />
                              ) : themeOption === 'dark' ? (
                                <Moon className="w-5 h-5 text-foreground" />
                              ) : (
                                <VampireIcon className="w-10 h-10 text-foreground" />
                              )}
                              <span className="text-xs font-medium text-foreground capitalize">
                                {themeOption === 'light' ? 'Claro' : themeOption === 'dark' ? 'Escuro' : 'Drácula'}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção: Tipografia */}
                <div className="pt-6 border-t border-border">
                  <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Type className="w-5 h-5" />
                    Tipografia
                  </h4>
                  
                  <div className="space-y-6 pl-7">
                    {/* Fonte do Chat */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Fonte do Chat
                      </label>
                      <select
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200"
                      >
                        <option value="Inter">Inter (Padrão)</option>
                        <option value="Space Grotesk">Space Grotesk</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Open Sans">Open Sans</option>
                        <option value="Lato">Lato</option>
                        <option value="Merriweather">Merriweather (Serif)</option>
                        <option value="Georgia">Georgia (Serif)</option>
                        <option value="JetBrains Mono">JetBrains Mono (Mono)</option>
                        <option value="Fira Code">Fira Code (Mono)</option>
                        <option value="Source Code Pro">Source Code Pro (Mono)</option>
                      </select>
                    </div>

                    {/* Tamanho da Fonte */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-3">
                        Tamanho da Fonte: {fontSize}px
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="12"
                          max="24"
                          step="1"
                          value={fontSize}
                          onChange={(e) => setFontSize(Number(e.target.value))}
                          className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none
                            [&::-webkit-slider-thumb]:w-4
                            [&::-webkit-slider-thumb]:h-4
                            [&::-webkit-slider-thumb]:rounded-full
                            [&::-webkit-slider-thumb]:bg-primary
                            [&::-webkit-slider-thumb]:cursor-pointer
                            [&::-moz-range-thumb]:w-4
                            [&::-moz-range-thumb]:h-4
                            [&::-moz-range-thumb]:rounded-full
                            [&::-moz-range-thumb]:bg-primary
                            [&::-moz-range-thumb]:border-0
                            [&::-moz-range-thumb]:cursor-pointer"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setFontSize(Math.max(12, fontSize - 1))}
                            className="w-8 h-8 bg-muted hover:bg-muted/80 rounded text-sm font-medium transition-colors duration-150 flex items-center justify-center"
                          >
                            -
                          </button>
                          <button
                            onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                            className="w-8 h-8 bg-muted hover:bg-muted/80 rounded text-sm font-medium transition-colors duration-150 flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Intervalo: 12px - 24px
                      </p>
                    </div>

                    {/* Preview */}
                    <div className="p-4 bg-muted rounded-lg border border-border">
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                        Prévia:
                      </p>
                      <p
                        style={{
                          fontFamily: getFontFamily(fontFamily),
                          fontSize: `${fontSize}px`,
                        }}
                        className="text-foreground"
                      >
                        Esta é uma prévia da fonte e tamanho selecionados. O rápido cão marrom pula sobre a cerca preguiçosa.
                      </p>
                    </div>

                    {/* Save Font Preferences Button */}
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={handleSaveFontPreferences}
                        disabled={isSavingFontPreferences}
                        className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground font-medium rounded-lg shadow-sm transition-colors duration-200 flex items-center gap-2"
                      >
                        {isSavingFontPreferences ? (
                          <>
                            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          'Salvar Configurações'
                        )}
                      </button>

                      {fontPreferencesSaved && (
                        <div className="flex items-center gap-2 text-green-600 animate-in fade-in duration-200">
                          <Check className="w-4 h-4" />
                          <span className="text-sm font-medium">Salvo!</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'personalization' && (
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4 md:mb-6">Personalização da IA</h3>

              <div className="space-y-8">
                {/* Seção: Informações Pessoais */}
                <div>
                  <h4 className="text-lg font-semibold text-foreground mb-4">Suas Informações</h4>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Apelido
                      </label>
                      <input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="Como a IA deve te chamar? (ex: João, Maria)"
                        className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        A IA usará este nome para se referir a você de forma pessoal.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Mais sobre você
                      </label>
                      <textarea
                        value={aboutYou}
                        onChange={(e) => setAboutYou(e.target.value)}
                        placeholder="Conte mais sobre você (ex: interesses, profissão, objetivos)"
                        rows={4}
                        className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200 resize-none"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Essas informações ajudarão a IA a personalizar as respostas de acordo com seu contexto.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button 
                        onClick={handleSavePersonalization}
                        disabled={isSavingPersonalization}
                        className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground font-medium rounded-lg shadow-sm transition-colors duration-200 flex items-center gap-2"
                      >
                        {isSavingPersonalization ? (
                          <>
                            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          'Salvar Informações'
                        )}
                      </button>

                      {personalizationSaved && (
                        <div className="flex items-center gap-2 text-green-600 animate-in fade-in duration-200">
                          <Check className="w-4 h-4" />
                          <span className="text-sm font-medium">Salvo com sucesso!</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Seção: Background do Chat */}
                <div className="pt-6 border-t border-border">
                  <h4 className="text-lg font-semibold text-foreground mb-4">Background do Chat</h4>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Personalize o fundo da área de mensagens com uma imagem de sua escolha.
                    </p>
                    
                    {chatBackgroundPreview && (
                      <div className="relative w-full h-48 rounded-lg overflow-hidden border border-border">
                        <Image
                          src={chatBackgroundPreview}
                          alt="Background preview"
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <input
                        ref={backgroundInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleBackgroundChange}
                        className="hidden"
                      />
                      
                      <button
                        onClick={() => backgroundInputRef.current?.click()}
                        disabled={isUploadingBackground}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground font-medium rounded-lg shadow-sm transition-colors duration-200 flex items-center gap-2"
                      >
                        {isUploadingBackground ? (
                          <>
                            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Paintbrush className="w-4 h-4" />
                            {chatBackgroundPreview ? 'Alterar Background' : 'Adicionar Background'}
                          </>
                        )}
                      </button>

                      {chatBackgroundPreview && (
                        <button
                          onClick={handleRemoveBackground}
                          disabled={isUploadingBackground}
                          className="px-4 py-2 bg-destructive/10 hover:bg-destructive/20 disabled:bg-muted disabled:cursor-not-allowed text-destructive font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remover
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Formatos aceitos: PNG, JPG, JPEG, WEBP, GIF. Tamanho máximo: 20MB.
                    </p>
                  </div>
                </div>

                {/* Seção: Personalidades da IA */}
                <div className="pt-6 border-t border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-foreground">Personalidades da IA</h4>
                    {aiPersonalities.length > 0 && (
                      <button
                        onClick={() => setShowAddPersonalityForm(true)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar
                      </button>
                    )}
                  </div>

                  {/* Lista de personalidades */}
                  {aiPersonalities.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {aiPersonalities.map((personality) => (
                        <div
                          key={personality.id}
                          className={`p-3 md:p-4 border-2 rounded-lg transition-all ${
                            personality.isActive
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-background hover:border-primary/30'
                          }`}
                        >
                          {editingPersonalityId === personality.id ? (
                            <div className="space-y-3">
                              <input
                                type="text"
                                value={editingPersonalityName}
                                onChange={(e) => setEditingPersonalityName(e.target.value)}
                                className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:border-primary outline-none"
                                placeholder="Nome da personalidade"
                              />
                              <textarea
                                value={editingPersonalityDescription}
                                onChange={(e) => setEditingPersonalityDescription(e.target.value)}
                                className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:border-primary outline-none resize-none"
                                rows={4}
                                placeholder="Descreva como a IA deve se comportar..."
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleUpdatePersonality(personality.id, editingPersonalityName, editingPersonalityDescription)}
                                  className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-1"
                                >
                                  <Check className="w-4 h-4" />
                                  Salvar
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingPersonalityId(null);
                                    setEditingPersonalityName('');
                                    setEditingPersonalityDescription('');
                                  }}
                                  className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h5 className="font-semibold text-foreground">{personality.name}</h5>
                                    {personality.isActive && (
                                      <>
                                        <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/20 text-primary text-xs font-medium rounded-full">
                                          <CheckCircle2 className="w-3 h-3" />
                                          Ativa
                                        </span>
                                        <button
                                          onClick={() => {
                                            setEditingPersonalityId(personality.id);
                                            setEditingPersonalityName(personality.name);
                                            setEditingPersonalityDescription(personality.description);
                                          }}
                                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{personality.description}</p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
                                {!personality.isActive ? (
                                  <>
                                    <button
                                      onClick={() => handleSetActivePersonality(personality.id)}
                                      className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    >
                                      Ativar
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingPersonalityId(personality.id);
                                        setEditingPersonalityName(personality.name);
                                        setEditingPersonalityDescription(personality.description);
                                      }}
                                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleSetActivePersonality(null)}
                                    className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                                  >
                                    Desativar
                                  </button>
                                )}
                                <button
                                  onClick={() => handleRemovePersonality(personality.id)}
                                  className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulário para adicionar nova personalidade */}
                  {showAddPersonalityForm && (
                    <div className="p-3 md:p-4 border-2 border-primary rounded-lg bg-primary/5 space-y-3 md:space-y-4">
                      <div className="flex items-center justify-between">
                        <h5 className="font-semibold text-foreground">Nova Personalidade</h5>
                        <button
                          onClick={() => {
                            setShowAddPersonalityForm(false);
                            setNewPersonalityName('');
                            setNewPersonalityDescription('');
                          }}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Nome da Personalidade
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Professora, Assistente Técnico, Poeta..."
                          value={newPersonalityName}
                          onChange={(e) => setNewPersonalityName(e.target.value)}
                          className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Descrição do Comportamento
                        </label>
                        <textarea
                          placeholder="Descreva como a IA deve se comportar, se comunicar, seu tom de voz, estilo de resposta, etc."
                          value={newPersonalityDescription}
                          onChange={(e) => setNewPersonalityDescription(e.target.value)}
                          rows={6}
                          className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200 resize-none"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Seja específico sobre tom, estilo, formalidade, e qualquer característica importante.
                        </p>
                      </div>

                      <button
                        onClick={handleAddPersonality}
                        disabled={!newPersonalityName.trim() || !newPersonalityDescription.trim()}
                        className="w-full px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground font-medium rounded-lg shadow-sm transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Criar Personalidade
                      </button>
                    </div>
                  )}

                  {/* Botão para mostrar formulário se não houver personalidades */}
                  {aiPersonalities.length === 0 && !showAddPersonalityForm && (
                    <button
                      onClick={() => setShowAddPersonalityForm(true)}
                      className="w-full px-6 py-3 border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 text-foreground font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Criar Primeira Personalidade
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'memories' && (
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4 md:mb-6">Memórias Globais</h3>

              <div className="space-y-6">
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm text-primary font-medium mb-2">💡 Como funcionam as memórias</p>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li>• Memórias globais são enviadas em <strong>todos os chats</strong></li>
                    <li>• Use para informações que você quer que a IA sempre lembre</li>
                    <li>• Exemplos: suas preferências, contexto profissional, informações pessoais</li>
                    <li>• Você também pode adicionar memórias específicas em cada chat</li>
                  </ul>
                </div>

                <MemoriesManager
                  memories={globalMemories}
                  onMemoriesChange={setGlobalMemories}
                  onAutoSave={handleAutoSaveMemories}
                  title="Suas Memórias Globais"
                  description="Estas memórias serão incluídas em todas as conversas com a IA. Salvas automaticamente ao adicionar ou remover."
                />
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4 md:mb-6">Segurança</h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Senha Atual
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200"
                  />
                </div>

                <button className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg shadow-sm transition-colors duration-200">
                  Alterar Senha
                </button>

                <div className="pt-6 border-t border-border">
                  <h4 className="text-lg font-semibold text-foreground mb-3">Sessão</h4>
                  <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg mb-4">
                    <p className="text-sm text-orange-600 dark:text-orange-400 font-medium mb-2">🚪 Sair da Conta</p>
                    <p className="text-sm text-muted-foreground">
                      Ao sair, todo o cache local (mensagens, modelos, etc.) será automaticamente limpo. 
                      Seus dados permanecem seguros no servidor.
                    </p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-muted disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-sm transition-colors duration-200 flex items-center gap-2"
                  >
                    {isLoggingOut ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saindo...
                      </>
                    ) : (
                      <>
                        <LogOut className="w-4 h-4" />
                        Sair da Conta
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-6 border-t border-border">
                  <h4 className="text-lg font-semibold text-foreground mb-3">Cache Local (IndexedDB)</h4>
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-4">
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-2">🔧 Resolver Erros de Cache</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Se você está vendo erros relacionados ao IndexedDB (como &quot;backing store error&quot;), 
                      use este botão para resetar o cache local. Isto não afetará seus dados salvos no servidor.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Quando usar:</strong> Após limpar o cache do navegador, se o app não estiver funcionando, ou se vir mensagens de erro no console.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleResetIndexedDB}
                      disabled={isResettingDB}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-sm transition-colors duration-200 flex items-center gap-2"
                    >
                      {isResettingDB ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Resetando...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Resetar Cache Local
                        </>
                      )}
                    </button>
                    {dbResetSuccess && (
                      <div className="flex items-center gap-2 text-green-600 animate-in fade-in duration-200">
                        <Check className="w-4 h-4" />
                        <span className="text-sm font-medium">Cache resetado!</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-border">
                  <h4 className="text-lg font-semibold text-destructive mb-2">Zona de Perigo</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Esta ação não pode ser desfeita. Todos os seus dados serão permanentemente
                    excluídos.
                  </p>
                  <button className="px-6 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-medium rounded-lg shadow-sm transition-colors duration-200 flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Deletar Conta
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
      
      {/* Model Select Modal (Default) */}
      <ModelSelectModal
        isOpen={modelSelectOpen}
        onClose={() => setModelSelectOpen(false)}
        currentModel={defaultModel}
        onSelectModel={(modelId) => handleDefaultModelChange(modelId)}
      />

      {/* Gemini Model Select Modal (Audio Transcription) */}
      <GeminiModelSelectModal
        isOpen={transcriptionModelSelectOpen}
        onClose={() => setTranscriptionModelSelectOpen(false)}
        currentModel={transcriptionModel}
        onSelectModel={(modelId) => handleTranscriptionModelChange(modelId)}
      />
    </div>
  );
}


