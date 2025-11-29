'use client';

import { useState } from 'react';
import { X, Check, Sparkles, Zap } from 'lucide-react';
import { GEMINI_AUDIO_MODELS, type GeminiModel } from '@/lib/constants/gemini-models';

interface GeminiModelSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: string;
  onSelectModel: (modelId: string) => void;
}

export function GeminiModelSelectModal({
  isOpen,
  onClose,
  currentModel,
  onSelectModel,
}: GeminiModelSelectModalProps) {
  const [selectedModel, setSelectedModel] = useState(currentModel);

  if (!isOpen) return null;

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    onSelectModel(modelId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-lg overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-purple-500/10 to-pink-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Modelos Gemini</h2>
              <p className="text-xs text-muted-foreground">Selecione o modelo para transcrição de áudio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="space-y-3">
            {GEMINI_AUDIO_MODELS.map((model: GeminiModel) => {
              const isSelected = selectedModel === model.id;
              const isRecommended = model.recommended;

              return (
                <button
                  key={model.id}
                  onClick={() => handleSelectModel(model.id)}
                  className={`w-full p-4 border-2 rounded-xl text-left transition-all duration-200 ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20 shadow-sm'
                      : 'border-border hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-950/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                      isSelected
                        ? 'bg-purple-500 text-white'
                        : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}>
                      {isRecommended ? (
                        <Zap className="w-5 h-5" />
                      ) : (
                        <Sparkles className="w-5 h-5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{model.name}</h3>
                        {isRecommended && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-full">
                            Recomendado
                          </span>
                        )}
                        {isSelected && (
                          <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 ml-auto" />
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-2">
                        {model.description}
                      </p>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 bg-background border border-border rounded-md text-muted-foreground">
                          🚀 {model.rpm} req/min
                        </span>
                        <span className="px-2 py-1 bg-background border border-border rounded-md text-muted-foreground">
                          📊 {model.rpd} req/dia
                        </span>
                        <span className="px-2 py-1 bg-background border border-border rounded-md text-muted-foreground">
                          ⏱️ Até {model.maxAudioDuration}h
                        </span>
                        <span className="px-2 py-1 bg-green-500/20 text-green-600 dark:text-green-400 rounded-md font-medium">
                          💰 Grátis
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Info footer */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Sobre os Modelos Gemini
                </h4>
                <p className="text-xs text-muted-foreground">
                  Todos os modelos são gratuitos com limites generosos. O <strong>Gemini 2.0 Flash</strong> é recomendado por ser o mais recente e eficiente. 
                  Configure sua API Key do Gemini na aba <strong>API Keys</strong> para começar a usar.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
