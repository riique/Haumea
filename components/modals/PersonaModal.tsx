'use client';

import { useState, useEffect } from 'react';
import { X, Drama, User, Brain, MessageSquare, Sparkles, ShieldCheck, Hash } from 'lucide-react';
import { Persona } from '@/types/chat';

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    personality: string;
    description: string;
    dialogExamples?: string;
    firstMessage?: string;
    alwaysDo?: string;
    neverDo?: string;
    maxTokens?: number;
  }) => void;
  editingPersona?: Persona | null;
}

export function PersonaModal({
  isOpen,
  onClose,
  onSave,
  editingPersona,
}: PersonaModalProps) {
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState('');
  const [description, setDescription] = useState('');
  const [dialogExamples, setDialogExamples] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [alwaysDo, setAlwaysDo] = useState('');
  const [neverDo, setNeverDo] = useState('');
  const [maxTokens, setMaxTokens] = useState<number | ''>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Populate fields when editing
  useEffect(() => {
    if (editingPersona) {
      setName(editingPersona.name);
      setPersonality(editingPersona.personality);
      setDescription(editingPersona.description);
      setDialogExamples(editingPersona.dialogExamples || '');
      setFirstMessage(editingPersona.firstMessage || '');
      setAlwaysDo(editingPersona.alwaysDo || '');
      setNeverDo(editingPersona.neverDo || '');
      setMaxTokens(editingPersona.maxTokens || '');
    } else {
      // Clear fields for new persona
      setName('');
      setPersonality('');
      setDescription('');
      setDialogExamples('');
      setFirstMessage('');
      setAlwaysDo('');
      setNeverDo('');
      setMaxTokens('');
    }
    setErrors({});
  }, [editingPersona, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!name.trim()) newErrors.name = 'Nome é obrigatório';
    if (name.trim().length > 60) newErrors.name = 'Máximo de 60 caracteres';
    if (!personality.trim()) newErrors.personality = 'Personalidade é obrigatória';
    if (personality.trim().length > 50000) newErrors.personality = 'Máximo de 50.000 caracteres';
    if (!description.trim()) newErrors.description = 'Descrição é obrigatória';
    if (description.trim().length > 50000) newErrors.description = 'Máximo de 50.000 caracteres';
    if (dialogExamples.trim().length > 50000) newErrors.dialogExamples = 'Máximo de 50.000 caracteres';
    if (firstMessage.trim().length > 50000) newErrors.firstMessage = 'Máximo de 50.000 caracteres';
    if (alwaysDo.trim().length > 50000) newErrors.alwaysDo = 'Máximo de 50.000 caracteres';
    if (neverDo.trim().length > 50000) newErrors.neverDo = 'Máximo de 50.000 caracteres';
    if (maxTokens !== '' && (maxTokens < 1 || maxTokens > 100000)) newErrors.maxTokens = 'Deve ser entre 1 e 100.000';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    
    onSave({
      name: name.trim(),
      personality: personality.trim(),
      description: description.trim(),
      dialogExamples: dialogExamples.trim() || undefined,
      firstMessage: firstMessage.trim() || undefined,
      alwaysDo: alwaysDo.trim() || undefined,
      neverDo: neverDo.trim() || undefined,
      maxTokens: maxTokens !== '' ? maxTokens : undefined,
    });
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
              <Drama className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {editingPersona ? 'Editar Persona' : 'Criar Nova Persona'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {editingPersona 
                  ? 'Atualize as informações da persona'
                  : 'Configure uma identidade completa para a IA incorporar'}
              </p>
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
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              Nome da Persona *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Dr. Silva, Coach Max, Chef Marie"
              maxLength={60}
              className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                errors.name ? 'border-destructive' : 'border-border'
              }`}
            />
            {errors.name && (
              <p className="text-sm text-destructive mt-1">{errors.name}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {name.length}/60 caracteres
            </p>
          </div>

          {/* Personality */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Personalidade *
            </label>
            <textarea
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="Descreva os traços de personalidade, comportamento e estilo comunicativo. Ex: Empático, motivacional, usa linguagem encorajadora, valoriza crescimento pessoal..."
              rows={6}
              className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none transition-all ${
                errors.personality ? 'border-destructive' : 'border-border'
              }`}
            />
            {errors.personality && (
              <p className="text-sm text-destructive mt-1">{errors.personality}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Define como a persona pensa, sente e se comunica
            </p>
          </div>

          {/* Description/Expertise */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Contexto e Expertise *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o contexto, experiência, área de conhecimento e background da persona. Ex: Coach fitness com 15 anos de experiência, especializado em emagrecimento saudável e nutrição esportiva..."
              rows={6}
              className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none transition-all ${
                errors.description ? 'border-destructive' : 'border-border'
              }`}
            />
            {errors.description && (
              <p className="text-sm text-destructive mt-1">{errors.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Define a bagagem e expertise da persona
            </p>
          </div>

          {/* Guidelines Section */}
          <div className="p-4 bg-muted/30 border border-border rounded-lg space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ShieldCheck className="w-4 h-4" />
              Diretrizes Importantes (opcional)
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Sempre Fazer
              </label>
              <textarea
                value={alwaysDo}
                onChange={(e) => setAlwaysDo(e.target.value)}
                placeholder="Liste comportamentos e práticas que esta persona deve sempre seguir.&#10;&#10;Exemplo:&#10;- Sempre citar fontes ao apresentar dados&#10;- Sempre validar sentimentos antes de oferecer soluções&#10;- Sempre perguntar antes de assumir contexto"
                rows={5}
                className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none transition-all ${
                  errors.alwaysDo ? 'border-destructive' : 'border-border'
                }`}
              />
              {errors.alwaysDo && (
                <p className="text-sm text-destructive mt-1">{errors.alwaysDo}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Princípios e ações que definem comportamentos essenciais da persona
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nunca Fazer
              </label>
              <textarea
                value={neverDo}
                onChange={(e) => setNeverDo(e.target.value)}
                placeholder="Liste comportamentos e ações que esta persona nunca deve realizar.&#10;&#10;Exemplo:&#10;- Nunca fornecer diagnósticos médicos&#10;- Nunca usar linguagem técnica sem explicar&#10;- Nunca ignorar sinais de vulnerabilidade emocional"
                rows={5}
                className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none transition-all ${
                  errors.neverDo ? 'border-destructive' : 'border-border'
                }`}
              />
              {errors.neverDo && (
                <p className="text-sm text-destructive mt-1">{errors.neverDo}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Limites e comportamentos que a persona deve evitar completamente
              </p>
            </div>
          </div>

          {/* Dialog Examples (Optional) */}
          <div className="p-4 bg-muted/30 border border-border rounded-lg space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <MessageSquare className="w-4 h-4" />
              Campos Opcionais
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Exemplos de Diálogos (opcional)
              </label>
              <textarea
                value={dialogExamples}
                onChange={(e) => setDialogExamples(e.target.value)}
                placeholder="Forneça exemplos de como a persona se comunica. Inclua exemplos de perguntas e respostas para demonstrar o estilo único. Ex:&#10;&#10;Usuário: Estou me sentindo desmotivado.&#10;Persona: Entendo! Vamos dar um passo de cada vez. O que te faria sentir um pouco melhor agora?"
                rows={6}
                className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none transition-all ${
                  errors.dialogExamples ? 'border-destructive' : 'border-border'
                }`}
              />
              {errors.dialogExamples && (
                <p className="text-sm text-destructive mt-1">{errors.dialogExamples}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Ajuda a IA a internalizar padrões de comunicação específicos
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Primeira Mensagem (opcional)
              </label>
              <textarea
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                placeholder="Mensagem inicial que a persona enviará ao começar um chat. Ex: Olá! Sou a Coach Ana e estou aqui para te ajudar a alcançar seus objetivos fitness. Como posso te apoiar hoje?"
                rows={4}
                className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none transition-all ${
                  errors.firstMessage ? 'border-destructive' : 'border-border'
                }`}
              />
              {errors.firstMessage && (
                <p className="text-sm text-destructive mt-1">{errors.firstMessage}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Será automaticamente adicionada ao iniciar um chat com esta persona
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Max Tokens (opcional)
              </label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value === '' ? '' : parseInt(e.target.value))}
                placeholder="Ex: 4096, 8192 (deixe vazio para usar o padrão do chat)"
                min="1"
                max="100000"
                className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                  errors.maxTokens ? 'border-destructive' : 'border-border'
                }`}
              />
              {errors.maxTokens && (
                <p className="text-sm text-destructive mt-1">{errors.maxTokens}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Limita o tamanho das respostas desta persona (1-100.000 tokens)
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
            {editingPersona ? 'Salvar Alterações' : 'Criar Persona'}
          </button>
        </div>
      </div>
    </div>
  );
}
