'use client';

import { useEffect, useState } from 'react';
import {
  X,
  MessageSquare,
  Loader2,
  Info,
  Settings,
  Lock,
  FileText,
  Sliders,
  Gauge,
  FlaskConical,
  Activity,
  Repeat,
  Save,
} from 'lucide-react';
import type { Chat, ChatConfig, Memory } from '@/types/chat';
import { MemoriesManager } from '@/components/common/MemoriesManager';

interface EditChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateChat: (chatId: string, config: Partial<ChatConfig>) => Promise<void>;
  chat: Chat | null;
}

type TabType = 'general' | 'advanced' | 'memories';

export function EditChatModal({ isOpen, onClose, onUpdateChat, chat }: EditChatModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [isLoading, setIsLoading] = useState(false);

  // Estado - Aba Geral
  const [name, setName] = useState('');
  const [context, setContext] = useState('');
  const [password, setPassword] = useState('');

  // Estado - Aba Avançado
  const [temperature, setTemperature] = useState(0.7);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0);
  const [repetitionPenalty, setRepetitionPenalty] = useState(1);
  const [maxTokens, setMaxTokens] = useState(4096);
  
  // Estado - Aba Memórias
  const [chatMemories, setChatMemories] = useState<Memory[]>([]);

  // Load chat data when modal opens or chat changes
  useEffect(() => {
    if (isOpen && chat) {
      setName(chat.name || '');
      setContext(chat.context || '');
      setPassword(chat.password || '');
      setTemperature(chat.temperature ?? 1.0);
      setFrequencyPenalty(chat.frequencyPenalty ?? 0);
      setRepetitionPenalty(chat.repetitionPenalty ?? 0);
      setMaxTokens(chat.maxTokens ?? 4096);
      setChatMemories(chat.memories || []);
    }
  }, [isOpen, chat]);

  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('general');
    }
  }, [isOpen]);

  if (!isOpen || !chat) return null;

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('Por favor, insira um nome para o chat.');
      return;
    }

    setIsLoading(true);
    try {
      await onUpdateChat(chat.id, {
        name: name.trim(),
        context: context.trim(),
        password: password.trim(),
        latexEnabled: chat?.latexEnabled ?? false,
        latexLevel: chat?.latexLevel ?? 'medio',
        temperature,
        frequencyPenalty,
        repetitionPenalty,
        maxTokens,
        memories: chatMemories,
      });
      onClose();
    } catch {
      alert('Erro ao atualizar chat. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'general' as TabType, label: 'Geral', icon: Settings },
    { id: 'advanced' as TabType, label: 'Avançado', icon: Sliders },
    { id: 'memories' as TabType, label: 'Memórias', icon: FileText },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl bg-card border border-border rounded-2xl shadow-lg flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300 max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Configurações do Chat</h2>
              <p className="text-sm text-muted-foreground">Edite os parâmetros da conversa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors duration-150"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-border">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-background text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Nome do Chat */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Nome do Chat <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Digite o nome da conversa..."
                  className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200 placeholder:text-muted-foreground"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground mt-1">{name.length}/100 caracteres</p>
              </div>

              {/* Contexto */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" />
                  Contexto
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Informações adicionais que serão incluídas no contexto..."
                  rows={4}
                  className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200 placeholder:text-muted-foreground resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">Opcional: informações extras para o contexto</p>
              </div>

              {/* Senha do Chat */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  Senha do Chat
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite uma senha (opcional)"
                  className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200 placeholder:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Opcional: proteja este chat com senha
                </p>
              </div>

            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-6">
              {/* Info Box */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm text-primary font-medium mb-1 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Configurações Avançadas
                </p>
                <p className="text-sm text-muted-foreground">
                  Ajuste os parâmetros de geração da IA. Use com cuidado!
                </p>
              </div>

              {/* Temperatura */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" />
                  Temperatura
                  <span className="ml-auto text-primary font-mono">{temperature.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Mais conservador (0.0)</span>
                  <span>Mais criativo (2.0)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Controla a aleatoriedade das respostas. Valores mais altos = mais criativo.
                </p>
              </div>

              {/* Frequency Penalty */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Frequency Penalty
                  <span className="ml-auto text-primary font-mono">{frequencyPenalty.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.01"
                  value={frequencyPenalty}
                  onChange={(e) => setFrequencyPenalty(parseFloat(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Sem penalidade (-2.0)</span>
                  <span>Máxima penalidade (2.0)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Reduz repetição de palavras com base na frequência de uso.
                </p>
              </div>

              {/* Repetition Penalty */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-primary" />
                  Repetition Penalty
                  <span className="ml-auto text-primary font-mono">{repetitionPenalty.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={repetitionPenalty}
                  onChange={(e) => setRepetitionPenalty(parseFloat(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Sem penalidade (0.0)</span>
                  <span>Alta penalidade (2.0)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Penaliza tokens repetidos para aumentar diversidade.
                </p>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-primary" />
                  Limite de Tokens
                  <span className="ml-auto text-primary font-mono">{maxTokens.toLocaleString()}</span>
                </label>
                <input
                  type="range"
                  min="256"
                  max="128000"
                  step="256"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>256 tokens</span>
                  <span>128,000 tokens</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Número máximo de tokens na resposta. Mais tokens = respostas mais longas e mais caras.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'memories' && (
            <div className="space-y-6">
              {/* Info Box */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm text-primary font-medium mb-1 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Memórias Específicas do Chat
                </p>
                <p className="text-sm text-muted-foreground">
                  Estas memórias serão enviadas apenas neste chat. Use para contexto específico desta conversa.
                </p>
              </div>

              <MemoriesManager
                memories={chatMemories}
                onMemoriesChange={setChatMemories}
                title="Memórias deste Chat"
                description="Informações que a IA deve lembrar apenas nesta conversa."
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-border bg-muted/30">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-2.5 bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed text-foreground font-medium rounded-lg transition-colors duration-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !name.trim()}
            className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-medium rounded-lg shadow-sm transition-all duration-200 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Alterações</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
