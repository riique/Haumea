'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

interface ExpensiveModelConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  modelId: string;
  modelName: string;
  inputPrice: string;
  outputPrice: string;
}

export function ExpensiveModelConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  modelId,
  modelName,
  inputPrice,
  outputPrice,
}: ExpensiveModelConfirmModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (confirmText.trim() === modelId) {
      onConfirm();
      setConfirmText('');
      setError('');
      onClose();
    } else {
      setError('O endpoint do modelo não corresponde. Por favor, digite exatamente como mostrado.');
    }
  };

  const handleClose = () => {
    setConfirmText('');
    setError('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in slide-in-from-bottom-2 duration-300">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 hover:bg-muted rounded-lg transition-colors duration-150"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Warning Icon */}
        <div className="w-14 h-14 bg-warning/10 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7 text-warning" />
        </div>

        {/* Header */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-foreground mb-2">⚠️ Modelo Caro Detectado</h2>
          <p className="text-muted-foreground">
            Você selecionou um modelo com preços acima de <strong className="text-foreground">$15/M tokens</strong>.
          </p>
        </div>

        {/* Model Info */}
        <div className="p-4 bg-warning/5 border border-warning/20 rounded-xl mb-4">
          <div className="mb-3">
            <p className="text-sm text-muted-foreground mb-1">Modelo Selecionado</p>
            <p className="text-base font-semibold text-foreground">{modelName}</p>
            <p className="text-sm text-muted-foreground font-mono">{modelId}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Preço de Input</p>
              <p className="text-sm font-bold text-warning">{inputPrice}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Preço de Output</p>
              <p className="text-sm font-bold text-warning">{outputPrice}</p>
            </div>
          </div>
        </div>

        {/* Warning Message */}
        <div className="mb-5 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-foreground">
            <strong>⚠️ Atenção:</strong> Este modelo pode gerar custos significativos. Certifique-se de que você entende os custos envolvidos antes de prosseguir.
          </p>
        </div>

        {/* Confirmation Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Para confirmar, digite o endpoint completo do modelo:
          </label>
          <div className="p-2 bg-muted rounded-lg mb-2">
            <code className="text-sm font-mono text-primary break-all">{modelId}</code>
          </div>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => {
              setConfirmText(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder="Digite o endpoint do modelo aqui..."
            className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-lg focus:border-warning focus:ring-2 focus:ring-warning/20 outline-none transition-all duration-200 font-mono text-sm"
            autoFocus
          />
          {error && (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-lg transition-colors duration-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!confirmText.trim()}
            className={`flex-1 px-4 py-2.5 font-medium rounded-lg shadow-sm transition-all duration-200 ${
              confirmText.trim()
                ? 'bg-warning hover:bg-warning/90 text-white'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            Confirmar e Usar
          </button>
        </div>
      </div>
    </div>
  );
}
