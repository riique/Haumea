'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Paperclip,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Music,
  File as FileIcon,
  Info,
  ToggleLeft,
  ToggleRight,
  Clock,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { Message, Attachment } from '@/types/chat';
import { formatFileSize } from '@/lib/services/upload-service';
import { ImageViewerModal } from './ImageViewerModal';

interface AttachmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onToggleAttachment?: (attachmentId: string, isActive: boolean) => void;
  onDeleteAttachment?: (attachmentId: string, storageRef: string) => void;
}

interface AttachmentWithMetadata extends Attachment {
  messageId: string;
  messageDate: Date;
}

interface GeneratedImageWithMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  messageId: string;
  messageDate: Date;
  isGenerated: true; // Flag to identify generated images
  storageRef: string;
}

type MediaItem = AttachmentWithMetadata | GeneratedImageWithMetadata;

export function AttachmentsModal({
  isOpen,
  onClose,
  messages,
  onToggleAttachment,
  onDeleteAttachment,
}: AttachmentsModalProps) {
  const [attachments, setAttachments] = useState<MediaItem[]>([]);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Extract all attachments and generated images from messages with metadata
    const allItems: MediaItem[] = [];

    messages.forEach((message) => {
      // Add regular attachments
      if (message.attachments && message.attachments.length > 0) {
        message.attachments.forEach((attachment) => {
          allItems.push({
            ...attachment,
            messageId: message.id,
            messageDate: message.createdAt,
            isActive: attachment.isActive !== false, // Default to true if not explicitly false
          });
        });
      }
      
      // Add generated images
      if (message.generatedImages && message.generatedImages.length > 0) {
        message.generatedImages.forEach((image) => {
          allItems.push({
            id: image.id,
            name: `Imagem Gerada - ${new Date(image.createdAt).toLocaleString()}`,
            type: 'image/png', // Assume PNG for generated images
            size: image.size || 0,
            url: image.url,
            messageId: message.id,
            messageDate: message.createdAt,
            isGenerated: true,
            storageRef: image.storageRef,
          });
        });
      }
    });

    // Sort by date (most recent first)
    allItems.sort((a, b) => b.messageDate.getTime() - a.messageDate.getTime());

    setAttachments(allItems);
  }, [messages, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeCount = attachments.filter((a) => 'isActive' in a ? a.isActive : true).length;
  const totalCount = attachments.length;

  const handleToggle = (attachmentId: string) => {
    const attachment = attachments.find((a) => a.id === attachmentId);
    if (attachment && !('isGenerated' in attachment)) { // Only toggle regular attachments
      const currentIsActive = 'isActive' in attachment ? attachment.isActive : true;
      // Atualiza localmente de forma otimista
      setAttachments((prev) =>
        prev.map((att) =>
          att.id === attachmentId && 'isActive' in att ? { ...att, isActive: !currentIsActive } : att
        )
      );
      
      // Propaga a mudança para o pai
      onToggleAttachment?.(attachmentId, !currentIsActive);
    }
  };

  const handleToggleAll = (active: boolean) => {
    // Atualiza localmente de forma otimista (only regular attachments)
    setAttachments((prev) =>
      prev.map((att) => 
        'isGenerated' in att ? att : { ...att, isActive: active }
      )
    );
    
    // Propaga mudanças para o pai (only regular attachments)
    attachments.forEach((att) => {
      if (!('isGenerated' in att)) {
        onToggleAttachment?.(att.id, active);
      }
    });
  };

  const handleViewImage = (attachment: MediaItem) => {
    setSelectedImage({ url: attachment.url, name: attachment.name });
    setImageViewerOpen(true);
  };

  const handleDownload = async (attachment: MediaItem) => {
    try {
      const response = await fetch(attachment.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.name;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao fazer download do arquivo.');
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    if (type === 'application/pdf') return FileText;
    if (type.startsWith('audio/')) return Music;
    if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return FileText;
    if (type === 'text/plain') return FileText;
    return FileIcon;
  };

  const getFileTypeLabel = (type: string): string => {
    if (type.startsWith('image/')) return 'Imagem';
    if (type === 'application/pdf') return 'PDF';
    if (type.startsWith('audio/')) return 'Áudio';
    if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'DOCX';
    if (type === 'text/plain') return 'TXT';
    return 'Arquivo';
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <div className="relative w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Paperclip className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Gerenciar Anexos</h2>
                <p className="text-sm text-muted-foreground">
                  {activeCount} de {totalCount} anexos ativos no contexto
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors duration-150"
              title="Fechar"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Info Banner */}
          <div className="mx-6 mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-3">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-foreground font-medium">Dica</p>
              <p className="text-xs text-muted-foreground mt-1">
                Anexos desativados não serão incluídos no contexto da conversa, mas permanecerão
                salvos no chat.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          {totalCount > 0 && (
            <div className="flex items-center gap-2 px-6 mt-4">
              <button
                onClick={() => handleToggleAll(true)}
                className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-2"
              >
                <ToggleRight className="w-4 h-4" />
                Ativar Todos
              </button>
              <button
                onClick={() => handleToggleAll(false)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-2"
              >
                <ToggleLeft className="w-4 h-4" />
                Desativar Todos
              </button>
            </div>
          )}

          {/* Attachments List */}
          <div className="flex-1 overflow-y-auto p-6">
            {attachments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Paperclip className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-foreground mb-2">Nenhum anexo encontrado</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Os arquivos enviados neste chat aparecerão aqui para você gerenciar.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {attachments.map((attachment) => (
                  <AttachmentCard
                    key={attachment.id}
                    attachment={attachment}
                    onToggle={handleToggle}
                    onView={handleViewImage}
                    onDownload={handleDownload}
                    onDelete={onDeleteAttachment}
                    getFileIcon={getFileIcon}
                    getFileTypeLabel={getFileTypeLabel}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Viewer Modal */}
      {selectedImage && (
        <ImageViewerModal
          isOpen={imageViewerOpen}
          onClose={() => {
            setImageViewerOpen(false);
            setSelectedImage(null);
          }}
          imageUrl={selectedImage.url}
          imageName={selectedImage.name}
        />
      )}
    </>
  );
}

// Attachment Card Component
interface AttachmentCardProps {
  attachment: MediaItem;
  onToggle: (id: string) => void;
  onView: (attachment: MediaItem) => void;
  onDownload: (attachment: MediaItem) => void;
  onDelete?: (attachmentId: string, storageRef: string) => void;
  getFileIcon: (type: string) => React.ComponentType<{ className?: string }>;
  getFileTypeLabel: (type: string) => string;
}

function AttachmentCard({
  attachment,
  onToggle,
  onView,
  onDownload,
  onDelete,
  getFileIcon,
  getFileTypeLabel,
}: AttachmentCardProps) {
  const FileIconComponent = getFileIcon(attachment.type);
  const isImage = attachment.type.startsWith('image/');
  const isGenerated = 'isGenerated' in attachment;
  const isActive = 'isActive' in attachment ? attachment.isActive : true;

  return (
    <div
      className={`group bg-card border-2 rounded-xl p-4 transition-all duration-200 ${
        isActive
          ? 'border-primary/30 hover:border-primary/50 shadow-sm hover:shadow-md'
          : 'border-border opacity-60 hover:opacity-80'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Thumbnail / Icon */}
        <div className="shrink-0">
          {isImage && attachment.url ? (
            <div
              className="w-20 h-20 rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onView(attachment);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment.url}
                alt={attachment.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
              <FileIconComponent className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Header with Title and Toggle */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-foreground truncate">{attachment.name}</h3>
                {isGenerated && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent text-xs font-semibold rounded shrink-0">
                    <Sparkles className="w-3 h-3" />
                    IA
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <FileIconComponent className="w-3 h-3" />
                  {getFileTypeLabel(attachment.type)}
                </span>
                <span>•</span>
                <span>{formatFileSize(attachment.size)}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {attachment.messageDate.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {/* Active Badge Inline */}
                {isActive && !isGenerated && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Ativo
                  </span>
                )}
              </div>
            </div>

            {/* Toggle Switch - mais visível (hidden for generated images) */}
            {!isGenerated && (
              <div className="shrink-0 flex flex-col items-end gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(attachment.id);
                  }}
                  className="group/toggle"
                  title={isActive ? 'Desativar anexo' : 'Ativar anexo'}
                >
                  <div
                    className={`h-7 w-12 rounded-full border-2 transition-all duration-200 flex items-center px-0.5 ${
                      isActive
                        ? 'border-primary bg-primary'
                        : 'border-border bg-muted'
                    }`}
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-card shadow-sm transition-transform duration-200 ${
                        isActive ? 'translate-x-[20px]' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {isActive ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-3">
            {isImage && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onView(attachment);
                }}
                className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-medium transition-colors duration-150 flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                Visualizar
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(attachment);
              }}
              className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs font-medium transition-colors duration-150 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
            {onDelete && attachment.storageRef && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (attachment.storageRef) {
                    onDelete(attachment.id, attachment.storageRef);
                  }
                }}
                className="px-3 py-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg text-xs font-medium transition-colors duration-150 flex items-center gap-1.5"
                title="Excluir anexo"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
