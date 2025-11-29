'use client';

import { useState, useRef, KeyboardEvent, useEffect, useCallback, memo } from 'react';
import {
  Send,
  Paperclip,
  Settings,
  X,
  FileText,
  Loader2,
  Search,
  Brain,
  Image as ImageIcon,
  File as FileIcon,
  Music,
  Sparkles,
  GraduationCap,
  Target,
  Mic,
} from 'lucide-react';
import { useAutoResizeTextarea } from '@/hooks/useAutoResizeTextarea';
import { useDraftManager, Draft } from '@/hooks/useDraftManager';
import { Attachment } from '@/types/chat';
import { getFileCategory, formatFileSize } from '@/lib/services/upload-service';
import { ModelSelectModal } from '@/components/modals/ModelSelectModal';
import { getModelName, getModelShortName } from '@/lib/services/openrouter-service';
import { useAuth } from '@/contexts/AuthContext';
import { getFontFamily } from '@/lib/utils/font-mapper';
import { hasNativeReasoning, getReasoningConfigType, getDefaultMaxTokens, getMaxTokensBounds } from '@/lib/utils/model-reasoning';
import { AudioRecorder } from '@/components/dashboard/AudioRecorder';

interface InputBarProps {
  onSendMessage: (
    message: string, 
    files: File[], 
    options?: { 
      deepThinking?: { enabled: boolean; depth: 'Baixa' | 'Média' | 'Alta'; maxTokens?: number };
      webSearch?: boolean;
      guidedStudy?: boolean;
    }
  ) => void;
  isLoading?: boolean;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  currentChatId?: string;
  guidedStudyEnabled?: boolean;
  onGuidedStudyChange?: (enabled: boolean) => void;
  webSearchEnabled?: boolean;
  onWebSearchChange?: (enabled: boolean) => void;
  deepThinkingEnabled?: boolean;
  deepThinkingDepth?: 'Baixa' | 'Média' | 'Alta';
  reasoningMaxTokens?: number;
  onDeepThinkingChange?: (enabled: boolean, depth?: 'Baixa' | 'Média' | 'Alta', maxTokens?: number) => void;
  failedTranscriptionsCount?: number;
  focusMode?: boolean;
  onExitFocusMode?: () => void;
}

export const InputBar = memo(function InputBar({ 
  onSendMessage, 
  isLoading = false,
  selectedModel: externalModel = 'google/gemini-2.0-flash-exp:free',
  onModelChange,
  currentChatId = '',
  guidedStudyEnabled: externalGuidedStudy = false,
  onGuidedStudyChange,
  webSearchEnabled: externalWebSearch = false,
  onWebSearchChange,
  deepThinkingEnabled: externalDeepThinking = false,
  deepThinkingDepth: externalThinkingDepth = 'Média',
  reasoningMaxTokens: externalReasoningMaxTokens,
  onDeepThinkingChange,
  failedTranscriptionsCount = 0,
  focusMode = false,
  onExitFocusMode
}: InputBarProps) {
  const { userProfile } = useAuth();
  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewAttachments, setPreviewAttachments] = useState<Attachment[]>([]);
  const [configMenuOpen, setConfigMenuOpen] = useState(false);
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const [modelDisplayName, setModelDisplayName] = useState(() => getModelShortName(externalModel));
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const previousChatIdRef = useRef<string | undefined>(undefined);

  useAutoResizeTextarea(textareaRef, input, 200);

  // Clear input when chat changes (before draft restoration)
  useEffect(() => {
    if (previousChatIdRef.current !== currentChatId) {
      setInput('');
      setSelectedFiles([]);
      setPreviewAttachments([]);
      previousChatIdRef.current = currentChatId;
    }
  }, [currentChatId]);

  // Draft management - auto-save and restore
  const handleRestoreDraft = useCallback((draft: Draft) => {
    // Restore draft when returning to this chat
    setInput(draft.input);
    setSelectedFiles([]);
    setPreviewAttachments([]);
    // Note: We can't restore File objects from localStorage
    // Files would need to be re-uploaded or stored differently
  }, []);

  const { clearDraft } = useDraftManager(
    currentChatId,
    input,
    selectedFiles,
    handleRestoreDraft
  );

  // Fetch and update model display name
  useEffect(() => {
    let isCancelled = false;
    let timeoutId: NodeJS.Timeout;

    const fetchModelName = async () => {
      try {
        // Set fallback immediately
        const fallback = getModelShortName(externalModel);
        
        // Create a timeout promise (2 seconds)
        const timeoutPromise = new Promise<string>((resolve) => {
          timeoutId = setTimeout(() => {
            resolve(fallback);
          }, 2000);
        });

        // Race between actual fetch and timeout
        const name = await Promise.race([
          getModelName(externalModel),
          timeoutPromise
        ]);

        if (!isCancelled) {
          setModelDisplayName(name);
        }
      } catch {
        // Fallback to short name on error
        if (!isCancelled) {
          setModelDisplayName(getModelShortName(externalModel));
        }
      }
    };
    
    fetchModelName();

    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [externalModel]);

  const handleSend = () => {
    // Allow sending if there's text content OR files (for lazy chat creation)
    if ((!input.trim() && selectedFiles.length === 0) || isLoading) return;
    
    // If no text but has files, send a default message
    const messageContent = input.trim() || '[Arquivo enviado]';
    
    onSendMessage(messageContent, selectedFiles, {
      deepThinking: externalDeepThinking ? { 
        enabled: true, 
        depth: externalThinkingDepth,
        maxTokens: externalReasoningMaxTokens 
      } : undefined,
      webSearch: externalWebSearch,
      guidedStudy: externalGuidedStudy,
    });
    
    // Clear draft after sending
    clearDraft(currentChatId);
    
    setInput('');
    setSelectedFiles([]);
    setPreviewAttachments([]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        return;
      }

      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length > 0) {
      handleFilesAdded(files);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    const index = previewAttachments.findIndex(a => a.id === id);
    if (index !== -1) {
      setPreviewAttachments(previewAttachments.filter((a) => a.id !== id));
      setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    }
  };

  const handleFilesAdded = (files: File[]) => {
    // Guardar Files originais
    setSelectedFiles([...selectedFiles, ...files]);
    
    // Criar previews para UI
    const newPreviews: Attachment[] = files.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: file.type,
      size: file.size,
      url: '', // Será preenchido após upload
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));

    setPreviewAttachments([...previewAttachments, ...newPreviews]);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFilesAdded(files);
    }
  };

  // Paste handler (Ctrl+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      handleFilesAdded(files);
    }
  };

  // Audio transcription handlers
  const handleOpenAudioRecorder = () => {
    setShowAudioRecorder(true);
  };

  const handleCloseAudioRecorder = () => {
    setShowAudioRecorder(false);
  };

  const handleTranscriptionComplete = (transcription: string) => {
    // Adicionar texto transcrito ao input
    setInput(prev => {
      if (prev.trim()) {
        return `${prev} ${transcription}`;
      }
      return transcription;
    });
    
    // Focar no textarea após transcrição
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  return (
    <div className="sticky bottom-0 bg-transparent p-4 flex justify-center">
      <div className="w-full max-w-4xl relative">
        {/* Model Select Modal */}
        <ModelSelectModal
          isOpen={modelSelectOpen}
          onClose={() => setModelSelectOpen(false)}
          currentModel={externalModel}
          onSelectModel={(model) => {
            onModelChange?.(model);
          }}
        />

        {/* Config Menu */}
        {configMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setConfigMenuOpen(false)}
            />
            <div className="absolute bottom-full left-4 mb-2 w-80 bg-card border border-border rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Header */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <Settings className="w-5 h-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">Settings</h3>
              </div>

              {/* Deep Thinking Toggle */}
              <div className="mb-4">
                {(() => {
                  const modelHasNativeReasoning = hasNativeReasoning(externalModel);
                  const configType = getReasoningConfigType(externalModel);
                  
                  // For native reasoning models: toggle controls visibility, not activation
                  // Toggle ON = visible, Toggle OFF = hidden (but still working internally)
                  const showAsActive = externalDeepThinking;
                  const isNativeButHidden = modelHasNativeReasoning && !externalDeepThinking;
                  
                  return (
                    <>
                      <button
                        onClick={() => onDeepThinkingChange?.(!externalDeepThinking)}
                        className={`w-full px-4 py-3 rounded-xl transition-all duration-200 text-left border-2 flex items-center justify-between gap-3 ${
                          showAsActive
                            ? 'border-primary bg-primary/10 shadow-md shadow-primary/20'
                            : isNativeButHidden
                              ? 'border-primary/40 bg-primary/5'
                              : 'border-border bg-card hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 ${
                              showAsActive 
                                ? 'bg-primary text-primary-foreground' 
                                : isNativeButHidden
                                  ? 'bg-primary/30 text-primary'
                                  : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <Brain className="w-4 h-4" />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">Pensamento Profundo</p>
                              {modelHasNativeReasoning && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                                  Nativo
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-xs font-medium ${
                                showAsActive 
                                  ? 'text-primary' 
                                  : isNativeButHidden
                                    ? 'text-muted-foreground'
                                    : 'text-muted-foreground'
                              }`}
                            >
                              {modelHasNativeReasoning
                                ? (externalDeepThinking
                                    ? (configType === 'max_tokens'
                                        ? `Visível • ${externalReasoningMaxTokens || getDefaultMaxTokens(externalModel)} tokens`
                                        : `Visível • ${externalThinkingDepth}`)
                                    : 'Oculto da resposta')
                                : (externalDeepThinking
                                  ? (configType === 'max_tokens' 
                                      ? `Ativo • ${externalReasoningMaxTokens || getDefaultMaxTokens(externalModel)} tokens`
                                      : `Ativo • ${externalThinkingDepth}`)
                                  : 'Desativado')
                              }
                            </span>
                          </div>
                        </div>
                        <div
                          className={`h-6 w-11 rounded-full border-2 transition-all duration-200 flex items-center px-1 ${
                            showAsActive 
                              ? 'border-primary bg-primary/90' 
                              : isNativeButHidden
                                ? 'border-primary/40 bg-primary/20'
                                : 'border-border bg-muted'
                          }`}
                        >
                          <span
                            className={`h-4 w-4 rounded-full bg-card shadow-sm transition-transform duration-200 ${
                              showAsActive ? 'translate-x-[14px]' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </button>

                      {(externalDeepThinking || modelHasNativeReasoning) && (
                        <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                          {configType === 'effort' ? (
                            <>
                              <p className="text-xs font-semibold text-primary mb-2">Intensidade</p>
                              <div className="grid grid-cols-3 gap-2">
                                {(['Baixa', 'Média', 'Alta'] as const).map((level) => (
                                  <button
                                    key={level}
                                    onClick={() => onDeepThinkingChange?.(true, level)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
                                      externalThinkingDepth === level
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'bg-card text-primary border border-primary/20 hover:bg-primary/10'
                                    }`}
                                  >
                                    {level}
                                  </button>
                                ))}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-primary">Max Tokens</p>
                                <span className="text-xs font-mono text-primary">
                                  {externalReasoningMaxTokens || getDefaultMaxTokens(externalModel)}
                                </span>
                              </div>
                              <input
                                type="range"
                                min={getMaxTokensBounds(externalModel).min}
                                max={getMaxTokensBounds(externalModel).max}
                                step="1000"
                                value={externalReasoningMaxTokens || getDefaultMaxTokens(externalModel)}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value);
                                  onDeepThinkingChange?.(externalDeepThinking, externalThinkingDepth, value);
                                }}
                                className="w-full h-2 bg-card rounded-lg appearance-none cursor-pointer accent-primary"
                              />
                              <div className="flex justify-between mt-1">
                                <span className="text-[10px] text-muted-foreground">
                                  {getMaxTokensBounds(externalModel).min.toLocaleString()}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {getMaxTokensBounds(externalModel).max.toLocaleString()}
                                </span>
                              </div>
                            </>
                          )}
                          
                          {modelHasNativeReasoning && !externalDeepThinking && (
                            <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-primary/10">
                              💡 Reasoning ativo internamente, mas oculto da resposta
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Guided Study Toggle */}
              <div className="mb-4">
                <button
                  onClick={() => onGuidedStudyChange?.(!externalGuidedStudy)}
                  className={`w-full px-4 py-3 rounded-xl transition-all duration-200 text-left border-2 flex items-center justify-between gap-3 ${
                    externalGuidedStudy
                      ? 'border-primary bg-primary/10 shadow-md shadow-primary/20'
                      : 'border-border bg-card hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 ${
                        externalGuidedStudy ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Aprendizado Guiado</p>
                      <span
                        className={`text-xs font-medium ${
                          externalGuidedStudy ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      >
                        {externalGuidedStudy ? 'Ativo • Professor interativo' : 'Modo professor interativo'}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`h-6 w-11 rounded-full border-2 transition-all duration-200 flex items-center px-1 ${
                      externalGuidedStudy ? 'border-primary bg-primary/90' : 'border-border bg-muted'
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full bg-card shadow-sm transition-transform duration-200 ${
                        externalGuidedStudy ? 'translate-x-[14px]' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>
              </div>

              {/* Web Search Toggle */}
              <div className="mb-4">
                <button
                  onClick={() => onWebSearchChange?.(!externalWebSearch)}
                  className={`w-full px-4 py-3 rounded-xl transition-all duration-200 text-left border-2 flex items-center justify-between gap-3 ${
                    externalWebSearch
                      ? 'border-primary bg-primary/10 shadow-md shadow-primary/20'
                      : 'border-border bg-card hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 ${
                        externalWebSearch ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Search className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Web Search</p>
                      <span
                        className={`text-xs font-medium ${
                          externalWebSearch ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      >
                        {externalWebSearch ? 'Ativo para este chat' : 'Ativar busca na web'}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`h-6 w-11 rounded-full border-2 transition-all duration-200 flex items-center px-1 ${
                      externalWebSearch ? 'border-primary bg-primary/90' : 'border-border bg-muted'
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full bg-card shadow-sm transition-transform duration-200 ${
                        externalWebSearch ? 'translate-x-[14px]' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>
              </div>

              {/* Model Selection */}
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Modelo de IA
                </p>
                <button
                  onClick={() => {
                    setConfigMenuOpen(false);
                    setModelSelectOpen(true);
                  }}
                  className="w-full px-4 py-3 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-lg text-left hover:border-primary/40 transition-all duration-200 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Modelo Atual</p>
                        <p className="text-sm font-semibold text-foreground">
                          {modelDisplayName || 'Loading...'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-primary group-hover:translate-x-1 transition-transform duration-200">
                      Alterar →
                    </span>
                  </div>
                </button>
              </div>

              <div className="pt-1" />
            </div>
          </>
        )}

        {/* Input Container */}
        <div 
          className={`bg-card border-2 shadow-lg rounded-2xl p-3 transition-all duration-200 ${
            isDragging 
              ? 'border-primary ring-4 ring-primary/20 bg-primary/5' 
              : 'border-border focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Preview de Anexos */}
          {previewAttachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {previewAttachments.map((file) => (
                <AttachmentPill
                  key={file.id}
                  file={file}
                  onRemove={removeAttachment}
                />
              ))}
            </div>
          )}

          {/* Main Input Row */}
          <div className="flex items-end gap-2">
            {/* Botão Exit Focus Mode - Mostrado apenas no Focus Mode */}
            {focusMode && (
              <button
                onClick={onExitFocusMode}
                className="p-2.5 shrink-0 rounded-lg transition-colors duration-150 text-muted-foreground hover:bg-muted animate-in fade-in duration-200"
                title="Sair do Modo Focus"
              >
                <Target className="w-5 h-5" />
              </button>
            )}

            {/* Botão Configurações */}
            <button
              onClick={() => setConfigMenuOpen(!configMenuOpen)}
              className={`p-2.5 shrink-0 rounded-lg transition-colors duration-150 ${
                configMenuOpen
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
              title="Configurações"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Botão Microfone */}
            <button
              onClick={handleOpenAudioRecorder}
              disabled={isLoading || showAudioRecorder}
              className="p-2.5 shrink-0 text-muted-foreground hover:bg-muted rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed relative"
              title={
                failedTranscriptionsCount > 0
                  ? `Gravar áudio (${failedTranscriptionsCount} transcrição${failedTranscriptionsCount > 1 ? 'ões' : ''} pendente${failedTranscriptionsCount > 1 ? 's' : ''})`
                  : 'Gravar áudio para transcrição'
              }
            >
              <Mic className="w-5 h-5" />
              {failedTranscriptionsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {failedTranscriptionsCount > 9 ? '9+' : failedTranscriptionsCount}
                </span>
              )}
            </button>

            {/* Botão Anexar */}
            <label className="p-2.5 shrink-0 text-muted-foreground hover:bg-muted rounded-lg cursor-pointer transition-colors duration-150" title="Anexar arquivos (imagens, PDFs, documentos, áudios)">
              <Paperclip className="w-5 h-5" />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf,audio/wav,audio/mp3,audio/mpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              />
            </label>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={isDragging ? "Solte os arquivos aqui..." : "Digite sua mensagem..."}
              disabled={isLoading}
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground resize-none min-h-[40px] max-h-[200px] py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: getFontFamily(userProfile?.fontFamily || 'Inter'), fontSize: `${userProfile?.fontSize || 16}px` }}
              rows={1}
            />

            {/* Botão Enviar */}
            <button
              onClick={handleSend}
              disabled={(!input.trim() && selectedFiles.length === 0) || isLoading}
              className="p-2.5 shrink-0 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground rounded-lg shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
              title="Enviar (Ctrl+Enter)"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Audio Recorder Modal */}
        <AudioRecorder
          isOpen={showAudioRecorder}
          onClose={handleCloseAudioRecorder}
          onTranscriptionComplete={handleTranscriptionComplete}
        />
      </div>
    </div>
  );
});

// Attachment Pill Component
interface AttachmentPillProps {
  file: Attachment;
  onRemove: (id: string) => void;
}

const AttachmentPill = memo(function AttachmentPill({ file, onRemove }: AttachmentPillProps) {
  const category = getFileCategory(file.type);
  
  const renderIcon = () => {
    if (category === 'image' && file.preview) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.preview} alt="" className="w-6 h-6 rounded object-cover" />
      );
    }
    
    switch (category) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-blue-500" />;
      case 'pdf':
        return <FileIcon className="w-4 h-4 text-red-500" />;
      case 'audio':
        return <Music className="w-4 h-4 text-purple-500" />;
      case 'docx':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'txt':
        return <FileText className="w-4 h-4 text-gray-500" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-muted border border-border rounded-lg text-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
      {renderIcon()}

      <div className="flex flex-col min-w-0">
        <span className="text-foreground truncate max-w-[150px] text-xs font-medium">{file.name}</span>
        <span className="text-muted-foreground text-[10px]">{formatFileSize(file.size)}</span>
      </div>

      <button
        onClick={() => onRemove(file.id)}
        className="p-0.5 ml-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors duration-150"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
});
