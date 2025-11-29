'use client';

import { X, DollarSign, Hash, Bot, Key, Globe, Brain, Database } from 'lucide-react';
import { Message } from '@/types/chat';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

interface MessageUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message;
}

export function MessageUsageModal({ isOpen, onClose, message }: MessageUsageModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Prevenir scroll quando modal estiver aberto
  useEffect(() => {
    if (isOpen && mounted) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, mounted]);

  // Validação: só exibir se houver dados de usage
  if (!isOpen || !message.usage || !mounted) return null;

  const { usage, model, webSearchEnabled } = message;

  // Formatação de moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 5,
      maximumFractionDigits: 6,
    }).format(value);
  };

  // Formatação de números grandes
  const formatNumber = (value: number) => {
    return value.toLocaleString('pt-BR');
  };

  // Format model name (extract provider and model name from ID)
  const formatModelName = (modelId: string | undefined) => {
    if (!modelId) return 'Modelo Desconhecido';
    
    // Extract readable name from model ID (e.g., "google/gemini-2.0-flash" -> "Gemini 2.0 Flash")
    const parts = modelId.split('/');
    const modelName = parts[parts.length - 1];
    
    // Capitalize and format
    return modelName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const modelDisplayName = formatModelName(model);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Informações de Uso do Request
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Seção 1: Resumo de Custos */}
          <div className="bg-accent/5 border border-accent/20 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-semibold text-foreground">Custo do Request</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-accent">
                  {formatCurrency(usage.cost)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {usage.cost.toFixed(6)} créditos OpenRouter
              </p>
              {usage.upstreamCost !== undefined && usage.upstreamCost > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Custo Upstream (BYOK):</span>{' '}
                    {formatCurrency(usage.upstreamCost)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Seção 2: Tokens */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Hash className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Uso de Tokens</h3>
            </div>
            
            {/* Grid 2x2 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Input Tokens */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-blue-500/10 rounded">
                    <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Input</p>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {formatNumber(usage.promptTokens)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">tokens</p>
              </div>

              {/* Output Tokens */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-green-500/10 rounded">
                    <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Output</p>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {formatNumber(usage.completionTokens)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">tokens</p>
              </div>

              {/* Reasoning Tokens (apenas se existir) */}
              {usage.reasoningTokens !== undefined && usage.reasoningTokens > 0 && (
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-purple-500/10 rounded">
                      <Brain className="w-3 h-3 text-purple-500" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Reasoning</p>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatNumber(usage.reasoningTokens)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">tokens</p>
                </div>
              )}

              {/* Cached Tokens (apenas se existir) */}
              {usage.cachedTokens !== undefined && usage.cachedTokens > 0 && (
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-amber-500/10 rounded">
                      <Database className="w-3 h-3 text-amber-500" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Cached</p>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatNumber(usage.cachedTokens)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">tokens</p>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-xl font-bold text-primary">
                  {formatNumber(usage.totalTokens)} tokens
                </p>
              </div>
            </div>
          </div>

          {/* Seção 3: Configuração */}
          <div className="bg-secondary/5 border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="w-5 h-5 text-secondary" />
              <h3 className="text-lg font-semibold text-foreground">Configuração do Request</h3>
            </div>
            
            <div className="space-y-3">
              {/* Modelo */}
              <div className="flex items-start gap-3">
                <div className="p-2 bg-secondary/10 rounded-lg mt-0.5">
                  <Bot className="w-4 h-4 text-secondary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Modelo</p>
                  <p className="text-base font-semibold text-foreground">{modelDisplayName}</p>
                  {model && (
                    <p className="text-xs text-muted-foreground font-mono mt-1">{model}</p>
                  )}
                </div>
              </div>

              {/* API Key */}
              {usage.apiKeyName && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-secondary/10 rounded-lg mt-0.5">
                    <Key className="w-4 h-4 text-secondary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">API Key</p>
                    <p className="text-base font-semibold text-foreground">{usage.apiKeyName}</p>
                  </div>
                </div>
              )}

              {/* Web Search */}
              <div className="flex items-start gap-3">
                <div className="p-2 bg-secondary/10 rounded-lg mt-0.5">
                  <Globe className="w-4 h-4 text-secondary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Web Search</p>
                  <div className="flex items-center gap-2 mt-1">
                    {webSearchEnabled ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-500 text-sm font-medium rounded-full">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                          Ativo
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted-foreground/10 text-muted-foreground text-sm font-medium rounded-full">
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full"></span>
                        Inativo
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Reasoning / Deep Thinking */}
              <div className="flex items-start gap-3">
                <div className="p-2 bg-secondary/10 rounded-lg mt-0.5">
                  <Brain className="w-4 h-4 text-secondary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Deep Thinking</p>
                  <div className="flex items-center gap-2 mt-1">
                    {usage.reasoningEnabled ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 text-purple-500 text-sm font-medium rounded-full">
                          <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                          Ativo
                        </span>
                        {usage.reasoningEffort && (
                          <span className="text-sm text-muted-foreground">
                            ({usage.reasoningEffort === 'low' ? 'Baixa' : usage.reasoningEffort === 'medium' ? 'Média' : 'Alta'})
                          </span>
                        )}
                        {usage.reasoningMaxTokens && (
                          <span className="text-sm text-muted-foreground">
                            (Max: {formatNumber(usage.reasoningMaxTokens)} tokens)
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted-foreground/10 text-muted-foreground text-sm font-medium rounded-full">
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full"></span>
                        Inativo
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Apenas criar portal se estiver montado e o modal estiver aberto
  if (typeof window === 'undefined' || !mounted || !isOpen) {
    return null;
  }

  return createPortal(modalContent, document.body);
}
