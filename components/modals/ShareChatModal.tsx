'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Users,
  Check,
  Clock,
  AlertCircle,
  Trash2,
  Loader2,
  Link as LinkIcon,
} from 'lucide-react';
import type { Chat, SharedChat, ShareType } from '@/types/chat';
import { createShareInvite, listUserSharedChats, revokeShare } from '@/lib/services/share-service';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/utils/logger';
import { validateChatForSharing, SHARING_LIMITS } from '@/lib/config/sharing-limits';

interface ShareChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat | null;
}

type ExpirationOption = '1h' | '24h' | '7d' | 'never';

export function ShareChatModal({ isOpen, onClose, chat }: ShareChatModalProps) {
  const { userProfile } = useAuth();
  const [selectedType, setSelectedType] = useState<ShareType>('copy');
  const [expiration, setExpiration] = useState<ExpirationOption>('7d');
  const [isCreating, setIsCreating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [activeShares, setActiveShares] = useState<SharedChat[]>([]);
  const [isLoadingShares, setIsLoadingShares] = useState(false);

  // Load active shares when modal opens
  useEffect(() => {
    if (isOpen && chat && userProfile) {
      loadActiveShares();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, chat, userProfile]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setGeneratedLink('');
      setCopied(false);
      setSelectedType('copy');
      setExpiration('7d');
    }
  }, [isOpen]);

  const loadActiveShares = async () => {
    if (!userProfile || !chat) return;
    
    setIsLoadingShares(true);
    try {
      const shares = await listUserSharedChats(userProfile.uid);
      // Filter to only show shares for this specific chat
      const chatShares = shares.filter(share => share.chatId === chat.id);
      setActiveShares(chatShares);
    } catch (error) {
      logger.error('Error loading shares:', { error });
    } finally {
      setIsLoadingShares(false);
    }
  };

  if (!isOpen || !chat) return null;

  const handleCreateInvite = async () => {
    if (!userProfile) {
      alert('Você precisa estar autenticado para compartilhar chats.');
      return;
    }

    // Validate chat can be shared
    const validation = validateChatForSharing(chat);
    if (!validation.valid) {
      alert(validation.reason);
      return;
    }

    setIsCreating(true);
    try {
      // Calculate expiration hours
      const expirationHours: number | undefined = 
        expiration === '1h' ? 1 :
        expiration === '24h' ? 24 :
        expiration === '7d' ? 168 :
        undefined;

      const result = await createShareInvite(
        userProfile.uid,
        userProfile.email || '',
        chat.id,
        chat.name,
        selectedType,
        expirationHours
      );

      // Generate full invite link
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const inviteLink = `${baseUrl}/accept-invite?code=${result.inviteCode}`;
      setGeneratedLink(inviteLink);

      // Reload shares
      await loadActiveShares();
    } catch (error) {
      logger.error('Error creating share invite:', { error });
      alert('Erro ao criar convite. Tente novamente.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevokeShare = async (shareId: string) => {
    if (!userProfile) return;

    if (!confirm('Tem certeza que deseja revogar este compartilhamento? O acesso será removido imediatamente.')) {
      return;
    }

    try {
      await revokeShare(shareId, userProfile.uid);
      await loadActiveShares();
    } catch (error) {
      logger.error('Error revoking share:', { error });
      alert('Erro ao revogar compartilhamento. Tente novamente.');
    }
  };

  const getExpirationLabel = (option: ExpirationOption): string => {
    switch (option) {
      case '1h': return '1 hora';
      case '24h': return '24 horas';
      case '7d': return '7 dias';
      case 'never': return 'Nunca';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-lg flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300 max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Share2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Compartilhar Chat</h2>
              <p className="text-sm text-muted-foreground">{chat.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors duration-150"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Share Type Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Tipo de Compartilhamento
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedType('copy')}
                className={`p-4 border rounded-lg transition-all duration-200 text-left ${
                  selectedType === 'copy'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Copy className="w-5 h-5 text-primary" />
                  <span className="font-medium text-foreground">Cópia</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cria uma cópia independente do chat. Cada um pode modificar sua versão.
                </p>
              </button>

              <button
                onClick={() => setSelectedType('collaborative')}
                className={`p-4 border rounded-lg transition-all duration-200 text-left ${
                  selectedType === 'collaborative'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-primary" />
                  <span className="font-medium text-foreground">Colaborativo</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Compartilha o chat original. Ambos podem enviar mensagens e ver atualizações.
                </p>
              </button>
            </div>
          </div>

          {/* Limits Info */}
          <div className="p-3 bg-muted/50 border border-border rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Limites:</strong> Máximo de {SHARING_LIMITS.MAX_ACTIVE_SHARES_PER_USER} compartilhamentos ativos • 
              Chats colaborativos: até {SHARING_LIMITS.MAX_MEMBERS_COLLABORATIVE} membros • 
              Modo cópia: máximo {SHARING_LIMITS.MAX_MESSAGES_FOR_COPY.toLocaleString()} mensagens
            </p>
          </div>

          {/* Expiration Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Expiração do Convite
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['1h', '24h', '7d', 'never'] as ExpirationOption[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setExpiration(option)}
                  className={`px-3 py-2 border rounded-lg text-sm transition-all duration-200 ${
                    expiration === option
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {getExpirationLabel(option)}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Invite Button */}
          <div>
            <button
              onClick={handleCreateInvite}
              disabled={isCreating}
              className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando Convite...
                </>
              ) : (
                <>
                  <LinkIcon className="w-4 h-4" />
                  Gerar Link de Convite
                </>
              )}
            </button>
          </div>

          {/* Generated Link */}
          {generatedLink && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Check className="w-4 h-4" />
                Link gerado com sucesso!
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={generatedLink}
                  readOnly
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Compartilhe este link com quem você deseja dar acesso ao chat.
              </p>
            </div>
          )}

          {/* Active Shares */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Compartilhamentos Ativos
            </label>
            {isLoadingShares ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeShares.length > 0 ? (
              <div className="space-y-2">
                {activeShares.map((share) => (
                  <div
                    key={share.id}
                    className="p-3 bg-muted/50 border border-border rounded-lg flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {share.shareType === 'copy' ? (
                        <Copy className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Users className="w-4 h-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {share.shareType === 'copy' ? 'Cópia' : 'Colaborativo'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {share.shareType === 'collaborative' 
                            ? `${share.members.length} membro(s)`
                            : 'One-time use'} • {share.expiresAt 
                            ? `Expira em ${new Date(share.expiresAt).toLocaleDateString()}`
                            : 'Sem expiração'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Código: {share.inviteCode}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeShare(share.id)}
                      className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors duration-150"
                      title="Revogar compartilhamento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nenhum compartilhamento ativo
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-all duration-200 font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
