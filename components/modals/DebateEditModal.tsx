'use client';

import { useState, useEffect } from 'react';
import { X, FileText, Cpu } from 'lucide-react';
import { DebateConfig } from '@/types/chat';

interface DebateEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Partial<DebateConfig>) => void;
  currentConfig: DebateConfig;
  onOpenModelSelect: (participant: 1 | 2) => void;
  selectedModel1?: string;
  selectedModel2?: string;
}

export function DebateEditModal({
  isOpen,
  onClose,
  onSave,
  currentConfig,
  onOpenModelSelect,
  selectedModel1,
  selectedModel2,
}: DebateEditModalProps) {
  const [pointsText, setPointsText] = useState('');
  const [maxTokens1, setMaxTokens1] = useState<number>(4096);
  const [maxTokens2, setMaxTokens2] = useState<number>(4096);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form with current config
  useEffect(() => {
    if (isOpen && currentConfig) {
      setPointsText(currentConfig.points.join('\n'));
      setMaxTokens1(currentConfig.participant1.maxTokens || 4096);
      setMaxTokens2(currentConfig.participant2.maxTokens || 4096);
    }
  }, [isOpen, currentConfig]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!pointsText.trim()) newErrors.points = 'Pautas obrigatórias';
    if (maxTokens1 < 256 || maxTokens1 > 128000) newErrors.maxTokens1 = 'Entre 256 e 128000';
    if (maxTokens2 < 256 || maxTokens2 > 128000) newErrors.maxTokens2 = 'Entre 256 e 128000';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    
    // Parse points: split by newline
    const points = pointsText
      .split(/\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    const updatedConfig: Partial<DebateConfig> = {
      points,
      participant1: {
        ...currentConfig.participant1,
        model: selectedModel1 || currentConfig.participant1.model,
        maxTokens: maxTokens1,
      },
      participant2: {
        ...currentConfig.participant2,
        model: selectedModel2 || currentConfig.participant2.model,
        maxTokens: maxTokens2,
      },
    };
    
    onSave(updatedConfig);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Editar Debate</h2>
              <p className="text-sm text-muted-foreground">Edite as pautas e configurações dos modelos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Debate Points */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Pautas do Debate *
            </label>
            <textarea
              value={pointsText}
              onChange={(e) => setPointsText(e.target.value)}
              placeholder="Digite as pautas, uma por linha.&#10;Ex:&#10;Segurança e riscos existenciais&#10;Impacto no mercado de trabalho&#10;Privacidade e vigilância"
              rows={6}
              className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none transition-all ${
                errors.points ? 'border-destructive' : 'border-border'
              }`}
            />
            {errors.points && (
              <p className="text-sm text-destructive mt-1">{errors.points}</p>
            )}
          </div>

          {/* Participant 1 Model Settings */}
          <div className="space-y-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Participante 1 - {currentConfig.participant1.name}
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Modelo da IA
              </label>
              <button
                onClick={() => onOpenModelSelect(1)}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-left bg-background text-foreground transition-all hover:border-primary"
              >
                {selectedModel1 || currentConfig.participant1.model}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                Max Tokens
              </label>
              <input
                type="number"
                value={maxTokens1}
                onChange={(e) => setMaxTokens1(Number(e.target.value))}
                min={256}
                max={128000}
                className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                  errors.maxTokens1 ? 'border-destructive' : 'border-border'
                }`}
              />
              {errors.maxTokens1 && (
                <p className="text-sm text-destructive mt-1">{errors.maxTokens1}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Limite de tokens para as respostas (256-128000)
              </p>
            </div>
          </div>

          {/* Participant 2 Model Settings */}
          <div className="space-y-4 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              Participante 2 - {currentConfig.participant2.name}
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Modelo da IA
              </label>
              <button
                onClick={() => onOpenModelSelect(2)}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-left bg-background text-foreground transition-all hover:border-primary"
              >
                {selectedModel2 || currentConfig.participant2.model}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                Max Tokens
              </label>
              <input
                type="number"
                value={maxTokens2}
                onChange={(e) => setMaxTokens2(Number(e.target.value))}
                min={256}
                max={128000}
                className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                  errors.maxTokens2 ? 'border-destructive' : 'border-border'
                }`}
              />
              {errors.maxTokens2 && (
                <p className="text-sm text-destructive mt-1">{errors.maxTokens2}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Limite de tokens para as respostas (256-128000)
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg shadow-sm transition-all"
          >
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}
