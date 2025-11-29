'use client';

import { useState, useEffect, KeyboardEvent } from 'react';
import { X, Folder, Loader2, Palette } from 'lucide-react';
import { Folder as FolderType } from '@/types/chat';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFolder: (name: string, color?: string, password?: string, parentFolderId?: string | null) => Promise<void>;
  folders?: FolderType[]; // Available folders for parent selection
  parentFolderId?: string | null; // Pre-selected parent folder ID
  isSubfolder?: boolean; // Whether creating a subfolder
}

const FOLDER_COLORS = [
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Verde', value: '#10b981' },
  { name: 'Roxo', value: '#8b5cf6' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Laranja', value: '#f97316' },
  { name: 'Vermelho', value: '#ef4444' },
  { name: 'Amarelo', value: '#eab308' },
  { name: 'Ciano', value: '#06b6d4' },
  { name: 'Cinza', value: '#6b7280' },
];

export function CreateFolderModal({ 
  isOpen, 
  onClose, 
  onCreateFolder,
  folders = [],
  parentFolderId: initialParentFolderId = null,
  isSubfolder = false,
}: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [parentFolderId, setParentFolderId] = useState<string | null>(initialParentFolderId);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  // Sync parentFolderId when prop changes
  useEffect(() => {
    if (isOpen) {
      setParentFolderId(initialParentFolderId);
    }
  }, [isOpen, initialParentFolderId]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!folderName.trim()) {
      setError('Digite um nome para a pasta');
      return;
    }

    if (password && password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      await onCreateFolder(
        folderName.trim(), 
        selectedColor, 
        password.trim() || undefined,
        parentFolderId
      );
      setFolderName('');
      setSelectedColor(undefined);
      setPassword('');
      setConfirmPassword('');
      setParentFolderId(null);
      onClose();
    } catch {
      setError('Erro ao criar pasta');
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-lg p-6 animate-in slide-in-from-bottom-2 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: selectedColor || 'hsl(var(--primary) / 0.1)' }}
            >
              <Folder 
                className="w-5 h-5" 
                style={{ color: selectedColor || 'hsl(var(--primary))' }}
              />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              {isSubfolder ? 'Novo Subprojeto' : 'Novo Projeto'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors duration-150"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Parent Folder Selection (only for root folders) */}
        {!isSubfolder && folders.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-2">
              Criar dentro de (opcional)
            </label>
            <select
              value={parentFolderId || ''}
              onChange={(e) => setParentFolderId(e.target.value || null)}
              className="w-full px-4 py-3 bg-background text-foreground border-2 border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200 cursor-pointer"
            >
              <option value="">Nenhum (projeto raiz)</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Nome do {isSubfolder ? 'Subprojeto' : 'Projeto'}
          </label>
          <input
            type="text"
            value={folderName}
            onChange={(e) => {
              setFolderName(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Projetos, Estudos, Trabalho..."
            className="w-full px-4 py-3 bg-background text-foreground placeholder:text-muted-foreground border-2 border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200"
            autoFocus
          />
        </div>

        {/* Color Picker */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Cor do Projeto
          </label>
          <div className="flex flex-wrap gap-2">
            {FOLDER_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => setSelectedColor(color.value)}
                className={`w-10 h-10 rounded-lg transition-all duration-200 hover:scale-110 ${
                  selectedColor === color.value 
                    ? 'ring-2 ring-offset-2 ring-primary scale-110' 
                    : 'hover:ring-2 hover:ring-offset-1 hover:ring-border'
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
            <button
              type="button"
              onClick={() => setSelectedColor(undefined)}
              className={`w-10 h-10 rounded-lg border-2 border-dashed border-border transition-all duration-200 hover:scale-110 flex items-center justify-center ${
                !selectedColor 
                  ? 'ring-2 ring-offset-2 ring-primary scale-110 bg-muted' 
                  : 'hover:ring-2 hover:ring-offset-1 hover:ring-border'
              }`}
              title="Sem cor"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Password Fields */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Senha (opcional)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            placeholder="Deixe em branco para não proteger"
            className="w-full px-4 py-3 bg-background text-foreground placeholder:text-muted-foreground border-2 border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200 mb-2"
          />
          {password && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError('');
              }}
              placeholder="Confirme a senha"
              className="w-full px-4 py-3 bg-background text-foreground placeholder:text-muted-foreground border-2 border-border rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200"
            />
          )}
        </div>

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-lg transition-colors duration-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !folderName.trim()}
            className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground font-medium rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Criando...</span>
              </>
            ) : (
              'Criar Pasta'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
