'use client';

import { useState } from 'react';
import { Play, Square, Plus, Pause, Send, Settings } from 'lucide-react';

interface DebateToolbarProps {
  hasStarted: boolean;
  isActive: boolean;
  isPaused: boolean;
  totalCost?: number;
  totalTokens?: number;
  currentPoints?: string[];
  currentPointIndex?: number;
  onStopDebate: () => void;
  onPauseDebate: () => void;
  onAddPoint: (point: string) => void | Promise<void>;
  onSelectPoint?: (index: number) => void | Promise<void>;
  onModeratorIntervention?: (message: string, nextParticipant: 1 | 2) => void;
  onOpenEditConfig?: () => void;
}

export function DebateToolbar({
  hasStarted,
  isActive,
  isPaused,
  totalCost = 0,
  totalTokens = 0,
  currentPoints = [],
  currentPointIndex = 0,
  onStopDebate,
  onPauseDebate,
  onAddPoint,
  onSelectPoint,
  onModeratorIntervention,
  onOpenEditConfig,
}: DebateToolbarProps) {
  const [newPoint, setNewPoint] = useState('');
  const [showInterventionInput, setShowInterventionInput] = useState(false);
  const [interventionMessage, setInterventionMessage] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<1 | 2>(1);
  const [isAddingPoint, setIsAddingPoint] = useState(false);

  const handleAddPoint = async () => {
    if (newPoint.trim() && !isAddingPoint) {
      setIsAddingPoint(true);
      try {
        await onAddPoint(newPoint.trim());
        setNewPoint('');
      } finally {
        setIsAddingPoint(false);
      }
    }
  };

  const handleSendIntervention = () => {
    if (interventionMessage.trim() && onModeratorIntervention) {
      onModeratorIntervention(interventionMessage.trim(), selectedParticipant);
      setInterventionMessage('');
      setShowInterventionInput(false);
    }
  };

  return (
    <div className="bg-card border-b border-border">
      {/* Main Toolbar */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-3">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          {/* Loading message while starting */}
          {!hasStarted && (
            <div className="px-4 py-2 bg-muted text-muted-foreground font-medium rounded-lg flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Iniciando apresentações...
            </div>
          )}

          {/* Pause/Resume Button */}
          {hasStarted && isActive && (
            <button
              onClick={onPauseDebate}
              className={`px-4 py-2 font-medium rounded-lg shadow-sm transition-all flex items-center gap-2 ${
                isPaused
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : 'bg-yellow-500 hover:bg-yellow-600 text-white'
              }`}
            >
              {isPaused ? (
                <>
                  <Play className="w-4 h-4" />
                  Retomar
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  Pausar
                </>
              )}
            </button>
          )}

          {/* Stop Debate Button */}
          {hasStarted && isActive && (
            <button
              onClick={onStopDebate}
              className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Interromper Debate
            </button>
          )}

          {/* Edit Config Button */}
          {hasStarted && isActive && isPaused && onOpenEditConfig && (
            <button
              onClick={onOpenEditConfig}
              className="px-4 py-2 bg-accent hover:bg-accent/90 text-accent-foreground font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Editar Configurações
            </button>
          )}

          {/* Moderator Intervention Button */}
          {hasStarted && isActive && isPaused && (
            <button
              onClick={() => setShowInterventionInput(!showInterventionInput)}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Intervir como Moderador
            </button>
          )}

          {/* Cost and Tokens Indicator */}
          {hasStarted && (totalCost > 0 || totalTokens > 0) && (
            <div className="ml-auto flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Custo:</span>
                <span className="text-sm font-semibold text-primary">
                  ${totalCost.toFixed(4)}
                </span>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Tokens:</span>
                <span className="text-sm font-semibold text-foreground">
                  {totalTokens.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Add Point Section - Second Row */}
        {hasStarted && isActive && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={newPoint}
                onChange={(e) => setNewPoint(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddPoint();
                  }
                }}
                placeholder="Nova pauta..."
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
              <button
                onClick={handleAddPoint}
                disabled={!newPoint.trim() || isAddingPoint}
                className="px-3 py-2 bg-accent hover:bg-accent/90 text-accent-foreground font-medium rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingPoint ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </>
                )}
              </button>
            </div>

            {/* Current Points List */}
            {currentPoints.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Pautas:</span>
                {currentPoints.map((point, index) => (
                  <button
                    key={index}
                    onClick={() => onSelectPoint?.(index)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      index === currentPointIndex
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {index + 1}. {point.length > 30 ? point.substring(0, 30) + '...' : point}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Moderator Intervention Panel */}
      {showInterventionInput && isPaused && (
        <div className="max-w-4xl mx-auto px-4 md:px-8 pb-3 animate-in slide-in-from-top-2 duration-200">
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4 space-y-3">
            <label className="block text-sm font-medium text-foreground">
              Mensagem do Moderador
            </label>
            <textarea
              value={interventionMessage}
              onChange={(e) => setInterventionMessage(e.target.value)}
              placeholder="Digite sua intervenção como moderador..."
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
            
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-foreground">
                  Quem deve responder?
                </label>
                <select
                  value={selectedParticipant}
                  onChange={(e) => setSelectedParticipant(Number(e.target.value) as 1 | 2)}
                  className="px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value={1}>Participante 1</option>
                  <option value={2}>Participante 2</option>
                </select>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowInterventionInput(false);
                    setInterventionMessage('');
                  }}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSendIntervention}
                  disabled={!interventionMessage.trim()}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  Enviar Intervenção
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
