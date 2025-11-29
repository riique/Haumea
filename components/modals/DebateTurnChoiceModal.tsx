'use client';

import { Users } from 'lucide-react';

interface DebateTurnChoiceModalProps {
  isOpen: boolean;
  participant1Name: string;
  participant2Name: string;
  onSelectParticipant: (participant: 1 | 2) => void;
}

export function DebateTurnChoiceModal({
  isOpen,
  participant1Name,
  participant2Name,
  onSelectParticipant,
}: DebateTurnChoiceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" />
      
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Quem deve começar?</h2>
              <p className="text-sm text-muted-foreground">Escolha quem fará a primeira intervenção</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-3">
          {/* Participant 1 Button */}
          <button
            onClick={() => onSelectParticipant(1)}
            className="w-full p-4 bg-blue-500/5 border-2 border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/10 rounded-lg transition-all duration-200 group"
          >
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <div className="flex-1 text-left">
                <p className="font-semibold text-foreground group-hover:text-blue-600 transition-colors">
                  {participant1Name}
                </p>
                <p className="text-sm text-muted-foreground">Participante 1</p>
              </div>
            </div>
          </button>

          {/* Participant 2 Button */}
          <button
            onClick={() => onSelectParticipant(2)}
            className="w-full p-4 bg-red-500/5 border-2 border-red-500/20 hover:border-red-500/40 hover:bg-red-500/10 rounded-lg transition-all duration-200 group"
          >
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="flex-1 text-left">
                <p className="font-semibold text-foreground group-hover:text-red-600 transition-colors">
                  {participant2Name}
                </p>
                <p className="text-sm text-muted-foreground">Participante 2</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
