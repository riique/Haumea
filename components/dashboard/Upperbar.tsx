'use client';

import { useState, useEffect } from 'react';
import {
  Bot,
  Clock,
  Paperclip,
  BarChart3,
  Download,
  MoreVertical,
  Menu,
  Loader2,
  Trash2,
  Target,
  EyeOff,
} from 'lucide-react';
import { getModelName } from '@/lib/services/openrouter-service';

interface UpperbarProps {
  chatName?: string;
  currentModel?: string;
  isLoading?: boolean;
  isTypingName?: boolean;
  attachmentsCount?: number;
  incognitoMode?: boolean;
  debateMode?: boolean;
  onToggleSidebar: () => void;
  onOpenAttachments?: () => void;
  onOpenStats?: () => void;
  onDownload?: () => void;
  onOpenModelSelect?: () => void;
  onToggleFocusMode?: () => void;
  onToggleIncognito?: () => void;
}

export function Upperbar({
  chatName,
  currentModel = 'GPT-4o',
  isLoading = false,
  isTypingName = false,
  attachmentsCount = 0,
  incognitoMode = false,
  debateMode = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  onToggleSidebar,
  onOpenAttachments,
  onOpenStats,
  onDownload,
  onOpenModelSelect,
  onToggleFocusMode,
  onToggleIncognito,
}: UpperbarProps) {
  const [sessionTime, setSessionTime] = useState('0:00');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [displayModelName, setDisplayModelName] = useState(currentModel || 'Carregando...');
  
  // Fetch model name
  useEffect(() => {
    if (!currentModel || currentModel === '') {
      setDisplayModelName('Carregando...');
      return;
    }
    
    const fetchModelName = async () => {
      const name = await getModelName(currentModel);
      setDisplayModelName(name || 'Modelo não encontrado');
    };
    
    fetchModelName();
  }, [currentModel]);

  useEffect(() => {
    const startTime = new Date();
    const interval = setInterval(() => {
      const now = new Date();
      const diffMs = now.getTime() - startTime.getTime();
      const minutes = Math.floor(diffMs / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      setSessionTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-card border-b border-border shadow-sm grid grid-cols-[1fr_auto_1fr] items-center px-4 md:px-6 sticky top-0 z-30 gap-4">
      {/* Left Section */}
      <div className="flex items-center gap-3 justify-start">
        {/* Mobile: Menu Toggle */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors duration-150"
        >
          <Menu className="w-5 h-5 text-foreground" />
        </button>

        {/* Indicador do Modelo (clicável) */}
        <button
          onClick={onOpenModelSelect}
          className="hidden md:flex items-center gap-2 pl-3 pr-2 py-1.5 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 text-foreground rounded-lg text-sm font-medium hover:border-primary/40 hover:shadow-sm transition-all duration-200 group"
          title="Clique para alterar o modelo"
        >
          <Bot className="w-4 h-4 text-primary" />
          <span>{displayModelName}</span>
          <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200">→</span>
        </button>

        {/* Tempo de Sessão */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-muted/50 text-muted-foreground rounded-lg text-sm font-mono">
          <Clock className="w-4 h-4" />
          <span>{sessionTime}</span>
        </div>
      </div>

      {/* Center Section - Truly centered */}
      <div className="flex items-center gap-2 justify-center min-w-0">
        {/* Status Dot */}
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${
            isLoading ? 'bg-warning animate-pulse' : 'bg-accent'
          }`}
        />

        {/* Nome do Chat */}
        <h1 className="text-lg font-semibold text-foreground truncate max-w-[200px] md:max-w-[400px] flex items-center gap-2">
          {!chatName || chatName === '' ? (
            // Empty state - no chat selected
            <span className="text-muted-foreground">Novo Chat</span>
          ) : chatName === '___GENERATING___' ? (
            // Loading state - generating name from AI
            <span className="text-muted-foreground text-sm">Gerando nome...</span>
          ) : (
            // Normal state - show chat name
            <>
              <span>{chatName}</span>
              {isTypingName && (
                <span className="inline-block w-0.5 h-5 bg-primary animate-pulse ml-0.5" />
              )}
            </>
          )}
        </h1>

        {isLoading && (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 justify-end">
        {/* Anexos com Badge */}
        <button
          onClick={onOpenAttachments}
          className="relative w-10 h-10 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors duration-150"
          title="Anexos"
        >
          <Paperclip className="w-5 h-5" />
          {attachmentsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-primary text-primary-foreground text-xs font-semibold rounded-full px-1">
              {attachmentsCount}
            </span>
          )}
        </button>

        {/* Estatísticas */}
        <button
          onClick={onOpenStats}
          className="hidden md:flex w-10 h-10 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors duration-150"
          title="Estatísticas"
        >
          <BarChart3 className="w-5 h-5" />
        </button>

        {/* Download */}
        <button
          onClick={onDownload}
          className="hidden md:flex w-10 h-10 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors duration-150"
          title="Download do chat"
        >
          <Download className="w-5 h-5" />
        </button>

        {/* Focus Mode */}
        <button
          onClick={onToggleFocusMode}
          className="hidden md:flex w-10 h-10 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors duration-150"
          title="Modo Focus"
        >
          <Target className="w-5 h-5" />
        </button>

        {/* Incognito Mode */}
        <button
          onClick={onToggleIncognito}
          className={`hidden md:flex w-10 h-10 items-center justify-center rounded-lg transition-colors duration-150 ${
            incognitoMode
              ? 'bg-primary/10 text-primary hover:bg-primary/20'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
          title={incognitoMode ? "Modo Incógnito Ativo" : "Ativar Modo Incógnito"}
        >
          <EyeOff className="w-5 h-5" />
        </button>

        {/* Mobile: Menu Dropdown */}
        <div className="relative md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors duration-150"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {mobileMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div className="absolute top-12 right-0 w-56 bg-card border border-border rounded-lg shadow-lg py-2 z-50 animate-in fade-in slide-in-from-right-4 duration-200">
                <button
                  onClick={() => {
                    onOpenStats?.();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 flex items-center gap-3 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Estatísticas</span>
                </button>

                <button
                  onClick={() => {
                    onDownload?.();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 flex items-center gap-3 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>

                <button
                  onClick={() => {
                    onToggleFocusMode?.();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 flex items-center gap-3 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Target className="w-4 h-4" />
                  <span>Modo Focus</span>
                </button>

                <button
                  onClick={() => {
                    onToggleIncognito?.();
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full px-4 py-2 flex items-center gap-3 text-sm transition-colors ${
                    incognitoMode
                      ? 'text-primary bg-primary/10'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <EyeOff className="w-4 h-4" />
                  <span>{incognitoMode ? 'Desativar Incógnito' : 'Modo Incógnito'}</span>
                </button>

                <div className="border-t border-border my-2" />

                <button className="w-full px-4 py-2 flex items-center gap-3 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-4 h-4" />
                  <span>Deletar Chat</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
