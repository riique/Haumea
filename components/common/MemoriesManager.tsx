'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Memory } from '@/types/chat';

interface MemoriesManagerProps {
  memories: Memory[];
  onMemoriesChange: (memories: Memory[]) => void;
  onAutoSave?: (memories: Memory[]) => Promise<void>; // Callback para salvamento automático
  title?: string;
  description?: string;
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
];

export function MemoriesManager({
  memories,
  onMemoriesChange,
  onAutoSave,
  title = 'Memórias',
  description = 'Adicione informações importantes que você quer que a IA lembre.',
}: MemoriesManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  const handleAddMemory = async () => {
    if (!newMemoryContent.trim()) {
      alert('Por favor, escreva algo para a memória.');
      return;
    }

    const newMemory: Memory = {
      id: `mem_${Date.now()}`,
      content: newMemoryContent.trim(),
      color: selectedColor,
      createdAt: new Date(),
    };

    const updatedMemories = [...memories, newMemory];
    onMemoriesChange(updatedMemories);
    
    // Salvar automaticamente se callback fornecido
    if (onAutoSave) {
      await onAutoSave(updatedMemories);
    }
    
    // Reset form
    setNewMemoryContent('');
    setSelectedColor(PRESET_COLORS[0]);
    setIsCreating(false);
  };

  const handleDeleteMemory = async (memoryId: string) => {
    const confirmed = confirm('Deseja realmente deletar esta memória?');
    if (!confirmed) return;
    
    const updatedMemories = memories.filter((mem) => mem.id !== memoryId);
    onMemoriesChange(updatedMemories);
    
    // Salvar automaticamente se callback fornecido
    if (onAutoSave) {
      await onAutoSave(updatedMemories);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-1">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {/* Memories List */}
      {memories.length > 0 && (
        <div className="space-y-2">
          {memories.map((memory) => (
            <div
              key={memory.id}
              className="group relative p-3 rounded-lg border-2 transition-all duration-200 hover:shadow-sm"
              style={{
                borderColor: memory.color,
                backgroundColor: `${memory.color}08`,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-3 h-3 rounded-full shrink-0 mt-1"
                  style={{ backgroundColor: memory.color }}
                />
                <p className="flex-1 text-sm text-foreground break-words">{memory.content}</p>
                <button
                  onClick={() => handleDeleteMemory(memory.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all duration-150"
                  title="Deletar memória"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {memories.length === 0 && !isCreating && (
        <div className="p-4 border-2 border-dashed border-border rounded-lg text-center">
          <p className="text-sm text-muted-foreground">Nenhuma memória adicionada ainda.</p>
        </div>
      )}

      {/* Create New Memory */}
      {isCreating ? (
        <div className="p-4 border-2 border-primary/30 bg-primary/5 rounded-lg space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-2">
              Conteúdo da Memória
            </label>
            <textarea
              value={newMemoryContent}
              onChange={(e) => setNewMemoryContent(e.target.value)}
              placeholder="Digite o que você quer que a IA lembre..."
              rows={3}
              className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-200 placeholder:text-muted-foreground resize-none text-sm"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {newMemoryContent.length}/500 caracteres
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-2">
              Cor de Referência
            </label>
            <div className="grid grid-cols-8 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-lg transition-all duration-150 ${
                    selectedColor === color
                      ? 'ring-2 ring-offset-2 ring-primary scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddMemory}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors duration-150"
            >
              Adicionar
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewMemoryContent('');
                setSelectedColor(PRESET_COLORS[0]);
              }}
              className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium rounded-lg transition-colors duration-150"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="w-full px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Memória
        </button>
      )}
    </div>
  );
}
