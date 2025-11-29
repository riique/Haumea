'use client';

import { useState } from 'react';
import { X, Users, FileText, User, Cpu } from 'lucide-react';
import { DebateConfig, DebatePosition } from '@/types/chat';

interface DebateConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartDebate: (config: DebateConfig) => void;
  onOpenModelSelect: (participant: 1 | 2) => void;
  selectedModel1?: string;
  selectedModel2?: string;
  userName?: string;
}

export function DebateConfigModal({
  isOpen,
  onClose,
  onStartDebate,
  onOpenModelSelect,
  selectedModel1,
  selectedModel2,
  userName,
}: DebateConfigModalProps) {
  const [participant1Name, setParticipant1Name] = useState('');
  const [participant1Position, setParticipant1Position] = useState<DebatePosition>('a_favor');
  
  const [participant2Name, setParticipant2Name] = useState('');
  const [participant2Position, setParticipant2Position] = useState<DebatePosition>('contra');
  
  const [topic, setTopic] = useState('');
  const [pointsText, setPointsText] = useState('');
  const [moderatorName, setModeratorName] = useState(userName || '');
  const [maxTokens1, setMaxTokens1] = useState<number>(4096);
  const [maxTokens2, setMaxTokens2] = useState<number>(4096);
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const positionLabels: Record<DebatePosition, string> = {
    a_favor: 'A favor',
    contra: 'Contra',
    neutro: 'Neutro-Analítico',
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!participant1Name.trim()) newErrors.participant1Name = 'Nome obrigatório';
    if (!selectedModel1) newErrors.model1 = 'Modelo obrigatório';
    if (!participant2Name.trim()) newErrors.participant2Name = 'Nome obrigatório';
    if (!selectedModel2) newErrors.model2 = 'Modelo obrigatório';
    if (!topic.trim()) newErrors.topic = 'Tema obrigatório';
    if (!pointsText.trim()) newErrors.points = 'Pautas obrigatórias';
    if (!moderatorName.trim()) newErrors.moderatorName = 'Nome do moderador obrigatório';
    if (maxTokens1 < 256 || maxTokens1 > 128000) newErrors.maxTokens1 = 'Entre 256 e 128000';
    if (maxTokens2 < 256 || maxTokens2 > 128000) newErrors.maxTokens2 = 'Entre 256 e 128000';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    
    // Parse points: split by comma or newline
    const points = pointsText
      .split(/[,\n]/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    const config: DebateConfig = {
      participant1: {
        name: participant1Name.trim(),
        model: selectedModel1!,
        position: participant1Position,
        maxTokens: maxTokens1,
      },
      participant2: {
        name: participant2Name.trim(),
        model: selectedModel2!,
        position: participant2Position,
        maxTokens: maxTokens2,
      },
      topic: topic.trim(),
      points,
      moderatorName: moderatorName.trim(),
    };
    
    onStartDebate(config);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Configurar Modo Debate</h2>
              <p className="text-sm text-muted-foreground">Configure os participantes e o tema do debate</p>
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
          {/* Participant 1 */}
          <div className="space-y-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Participante 1
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nome do Participante 1 *
              </label>
              <input
                type="text"
                value={participant1Name}
                onChange={(e) => setParticipant1Name(e.target.value)}
                placeholder="Ex: Maria Silva"
                className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                  errors.participant1Name ? 'border-destructive' : 'border-border'
                }`}
              />
              {errors.participant1Name && (
                <p className="text-sm text-destructive mt-1">{errors.participant1Name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Modelo da IA *
              </label>
              <button
                onClick={() => onOpenModelSelect(1)}
                className={`w-full px-4 py-2.5 border rounded-lg text-left transition-all ${
                  errors.model1 ? 'border-destructive' : 'border-border'
                } ${selectedModel1 ? 'bg-background text-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                {selectedModel1 || 'Selecionar modelo...'}
              </button>
              {errors.model1 && (
                <p className="text-sm text-destructive mt-1">{errors.model1}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Posição no Debate *
              </label>
              <select
                value={participant1Position}
                onChange={(e) => setParticipant1Position(e.target.value as DebatePosition)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              >
                <option value="a_favor">{positionLabels.a_favor}</option>
                <option value="contra">{positionLabels.contra}</option>
                <option value="neutro">{positionLabels.neutro}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                Max Tokens *
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

          {/* Participant 2 */}
          <div className="space-y-4 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              Participante 2
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nome do Participante 2 *
              </label>
              <input
                type="text"
                value={participant2Name}
                onChange={(e) => setParticipant2Name(e.target.value)}
                placeholder="Ex: Roberto Lima"
                className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                  errors.participant2Name ? 'border-destructive' : 'border-border'
                }`}
              />
              {errors.participant2Name && (
                <p className="text-sm text-destructive mt-1">{errors.participant2Name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Modelo da IA *
              </label>
              <button
                onClick={() => onOpenModelSelect(2)}
                className={`w-full px-4 py-2.5 border rounded-lg text-left transition-all ${
                  errors.model2 ? 'border-destructive' : 'border-border'
                } ${selectedModel2 ? 'bg-background text-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                {selectedModel2 || 'Selecionar modelo...'}
              </button>
              {errors.model2 && (
                <p className="text-sm text-destructive mt-1">{errors.model2}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Posição no Debate *
              </label>
              <select
                value={participant2Position}
                onChange={(e) => setParticipant2Position(e.target.value as DebatePosition)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              >
                <option value="a_favor">{positionLabels.a_favor}</option>
                <option value="contra">{positionLabels.contra}</option>
                <option value="neutro">{positionLabels.neutro}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                Max Tokens *
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

          {/* Debate Topic */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Tema do Debate *
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Descreva o tema completo do debate. Ex: A inteligência artificial deve ser fortemente regulamentada?"
              rows={3}
              className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none transition-all ${
                errors.topic ? 'border-destructive' : 'border-border'
              }`}
            />
            {errors.topic && (
              <p className="text-sm text-destructive mt-1">{errors.topic}</p>
            )}
          </div>

          {/* Debate Points */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Pautas do Debate *
            </label>
            <textarea
              value={pointsText}
              onChange={(e) => setPointsText(e.target.value)}
              placeholder="Digite as pautas separadas por vírgula ou uma por linha. Ex:&#10;Segurança e riscos existenciais&#10;Impacto no mercado de trabalho&#10;Privacidade e vigilância"
              rows={4}
              className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none transition-all ${
                errors.points ? 'border-destructive' : 'border-border'
              }`}
            />
            {errors.points && (
              <p className="text-sm text-destructive mt-1">{errors.points}</p>
            )}
          </div>

          {/* Moderator Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              Seu Nome como Moderador *
            </label>
            <input
              type="text"
              value={moderatorName}
              onChange={(e) => setModeratorName(e.target.value)}
              placeholder="Ex: Pedro"
              className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                errors.moderatorName ? 'border-destructive' : 'border-border'
              }`}
            />
            {errors.moderatorName && (
              <p className="text-sm text-destructive mt-1">{errors.moderatorName}</p>
            )}
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
            Iniciar Debate
          </button>
        </div>
      </div>
    </div>
  );
}
