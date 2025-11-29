'use client';

import { useState, useEffect } from 'react';
import { Download, X, Users, User, Bot, FileCode, FileText, FileJson } from 'lucide-react';
import { Message } from '@/types/chat';
import { processMessageContent, generateHTML } from '@/lib/utils/export-html';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  chatName: string;
}

type MessageFilter = 'all' | 'user' | 'assistant';
type ExportFormat = 'html' | 'json' | 'txt';

export function DownloadModal({ isOpen, onClose, messages, chatName }: DownloadModalProps) {
  const [selectedFilter, setSelectedFilter] = useState<MessageFilter>('all');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('html');
  const [downloading, setDownloading] = useState(false);

  // Count messages by role
  const userCount = messages.filter(m => m.role === 'user').length;
  const assistantCount = messages.filter(m => m.role === 'assistant').length;
  const totalCount = messages.length;

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setDownloading(true);

    try {
      // Filter messages based on selection
      let filteredMessages = messages;
      if (selectedFilter === 'user') {
        filteredMessages = messages.filter(m => m.role === 'user');
      } else if (selectedFilter === 'assistant') {
        filteredMessages = messages.filter(m => m.role === 'assistant');
      }

      if (selectedFormat === 'json') {
        await downloadJSON(chatName, filteredMessages);
      } else if (selectedFormat === 'txt') {
        await downloadTXT(chatName, filteredMessages);
      } else {
        await downloadHTML(chatName, filteredMessages);
      }

      // Success feedback
      await new Promise((resolve) => setTimeout(resolve, 500));
      onClose();
    } catch {
      alert(`Erro ao gerar o arquivo. Por favor, tente novamente.`);
    } finally {
      setDownloading(false);
    }
  };

  const downloadHTML = async (chatName: string, filteredMessages: Message[]) => {
    // Generate base HTML structure
    let htmlContent = generateHTML(chatName, filteredMessages);

      // Process each message content (LaTeX + Markdown + Sanitization)
      const processedMessages = await Promise.all(
        filteredMessages.map(async (msg) => {
          const processedContent = await processMessageContent(msg.content);
          return {
            ...msg,
            processedContent,
          };
        })
      );

      // Generate messages HTML
      const messagesHTML = processedMessages
        .map((msg) => {
          const roleClass = msg.role === 'user' ? 'user' : 'assistant';
          const roleIcon = msg.role === 'user' ? '👤' : '🤖';
          const roleName = msg.role === 'user' ? 'Você' : 'IA';
          const timestamp = msg.createdAt.toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          return `
      <div class="message ${roleClass}">
        <div class="message-header">
          <div class="message-role">
            <div class="role-icon">${roleIcon}</div>
            <span>${roleName}</span>
          </div>
          <div class="timestamp">${timestamp}</div>
        </div>
        <div class="message-content">
          ${msg.processedContent}
        </div>
      </div>`;
        })
        .join('\n');

      // Insert messages into HTML
      htmlContent = htmlContent.replace(
        '<!-- Messages will be inserted here -->',
        messagesHTML
      );

      // Sanitize filename
      const sanitizedName = chatName.replace(/[^a-z0-9]/gi, '_');
      const filename = `${sanitizedName}_${Date.now()}.html`;

    // Create and download blob
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadJSON = async (chatName: string, filteredMessages: Message[]) => {
    const exportData = {
      chatName,
      exportDate: new Date().toISOString(),
      totalMessages: filteredMessages.length,
      messages: filteredMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
        model: msg.model,
        webSearchEnabled: msg.webSearchEnabled,
        citations: msg.citations,
        attachments: msg.attachments?.map(att => ({
          id: att.id,
          name: att.name,
          type: att.type,
          size: att.size,
          url: att.url,
          isActive: att.isActive,
        })),
        isFavorite: msg.isFavorite,
        reasoning: msg.reasoning,
      })),
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const sanitizedName = chatName.replace(/[^a-z0-9]/gi, '_');
    const filename = `${sanitizedName}_${Date.now()}.json`;

    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadTXT = async (chatName: string, filteredMessages: Message[]) => {
    let txtContent = `========================================\n`;
    txtContent += `Chat: ${chatName}\n`;
    txtContent += `Data de exportação: ${new Date().toLocaleString('pt-BR')}\n`;
    txtContent += `Total de mensagens: ${filteredMessages.length}\n`;
    txtContent += `========================================\n\n`;

    filteredMessages.forEach((msg, index) => {
      const roleName = msg.role === 'user' ? 'Você' : 'IA';
      const timestamp = msg.createdAt.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      txtContent += `----------------------------------------\n`;
      txtContent += `[${index + 1}] ${roleName} - ${timestamp}\n`;
      if (msg.model) {
        txtContent += `Modelo: ${msg.model}\n`;
      }
      txtContent += `----------------------------------------\n`;
      txtContent += `${msg.content}\n\n`;

      // Add citations if any
      if (msg.citations && msg.citations.length > 0) {
        txtContent += `\n📚 Citações:\n`;
        msg.citations.forEach((citation, i) => {
          txtContent += `  ${i + 1}. ${citation.title}\n`;
          txtContent += `     ${citation.url}\n`;
          if (citation.snippet) {
            txtContent += `     ${citation.snippet}\n`;
          }
        });
        txtContent += `\n`;
      }

      // Add attachments if any
      if (msg.attachments && msg.attachments.length > 0) {
        txtContent += `\n📎 Anexos:\n`;
        msg.attachments.forEach((att, i) => {
          txtContent += `  ${i + 1}. ${att.name} (${att.type}) - ${att.isActive ? 'Ativo' : 'Inativo'}\n`;
          txtContent += `     ${att.url}\n`;
        });
        txtContent += `\n`;
      }

      txtContent += `\n`;
    });

    txtContent += `========================================\n`;
    txtContent += `Fim do chat\n`;
    txtContent += `========================================\n`;

    const sanitizedName = chatName.replace(/[^a-z0-9]/gi, '_');
    const filename = `${sanitizedName}_${Date.now()}.txt`;

    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Exportar Chat</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Escolha o formato de exportação
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Chat Info */}
          <div className="mb-6 p-4 bg-muted/30 rounded-xl border border-border">
            <p className="text-xs text-muted-foreground mb-1.5">Chat</p>
            <p className="font-semibold text-foreground text-lg mb-4">{chatName}</p>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-semibold text-foreground">{totalCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Suas</p>
                  <p className="font-semibold text-foreground">{userCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">IA</p>
                  <p className="font-semibold text-foreground">{assistantCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Format Selection */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-foreground mb-3">
              Formato de exportação:
            </p>
            <div className="grid grid-cols-3 gap-2 mb-6">
              <button
                onClick={() => setSelectedFormat('html')}
                className={`p-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                  selectedFormat === 'html'
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border hover:border-primary/30 hover:bg-muted'
                }`}
              >
                <FileCode className={`w-6 h-6 ${
                  selectedFormat === 'html' ? 'text-primary' : 'text-muted-foreground'
                }`} />
                <span className={`text-xs font-medium ${
                  selectedFormat === 'html' ? 'text-primary' : 'text-foreground'
                }`}>HTML</span>
              </button>
              <button
                onClick={() => setSelectedFormat('json')}
                className={`p-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                  selectedFormat === 'json'
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border hover:border-primary/30 hover:bg-muted'
                }`}
              >
                <FileJson className={`w-6 h-6 ${
                  selectedFormat === 'json' ? 'text-primary' : 'text-muted-foreground'
                }`} />
                <span className={`text-xs font-medium ${
                  selectedFormat === 'json' ? 'text-primary' : 'text-foreground'
                }`}>JSON</span>
              </button>
              <button
                onClick={() => setSelectedFormat('txt')}
                className={`p-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                  selectedFormat === 'txt'
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border hover:border-primary/30 hover:bg-muted'
                }`}
              >
                <FileText className={`w-6 h-6 ${
                  selectedFormat === 'txt' ? 'text-primary' : 'text-muted-foreground'
                }`} />
                <span className={`text-xs font-medium ${
                  selectedFormat === 'txt' ? 'text-primary' : 'text-foreground'
                }`}>TXT</span>
              </button>
            </div>
          </div>

          {/* Filter Selection */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-foreground mb-3">
              Selecione quais mensagens exportar:
            </p>
            <div className="space-y-2">
              <FilterOption
                value="all"
                icon={Users}
                label="Todas as mensagens"
                count={totalCount}
                description="Exportar a conversa completa"
                selected={selectedFilter === 'all'}
                onClick={() => setSelectedFilter('all')}
              />
              <FilterOption
                value="user"
                icon={User}
                label="Apenas suas mensagens"
                count={userCount}
                description="Exportar somente o que você escreveu"
                selected={selectedFilter === 'user'}
                onClick={() => setSelectedFilter('user')}
              />
              <FilterOption
                value="assistant"
                icon={Bot}
                label="Apenas mensagens da IA"
                count={assistantCount}
                description="Exportar somente respostas da IA"
                selected={selectedFilter === 'assistant'}
                onClick={() => setSelectedFilter('assistant')}
              />
            </div>
          </div>

          {/* Info Banner */}
          <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
            <p className="text-sm text-foreground leading-relaxed">
              {selectedFormat === 'html' && (
                <><span className="font-semibold text-primary">HTML:</span> Inclui renderização de LaTeX, Markdown, syntax highlighting e botão para PDF.</>
              )}
              {selectedFormat === 'json' && (
                <><span className="font-semibold text-primary">JSON:</span> Formato estruturado com todos os metadados das mensagens, ideal para processamento automático.</>
              )}
              {selectedFormat === 'txt' && (
                <><span className="font-semibold text-primary">TXT:</span> Formato simples e legível, ideal para leitura rápida e compatibilidade universal.</>
              )}
            </p>
          </div>
        </div>

        {/* Footer with Download Button */}
        <div className="p-6 border-t border-border">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
          >
            {downloading ? (
              <>
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Baixar {selectedFormat.toUpperCase()}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Filter Option Component
interface FilterOptionProps {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  description: string;
  selected: boolean;
  onClick: () => void;
}

function FilterOption({
  icon: Icon,
  label,
  count,
  description,
  selected,
  onClick,
}: FilterOptionProps) {

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left ${
        selected
          ? 'border-primary bg-primary/5 shadow-sm hover:shadow-md'
          : 'border-border hover:border-primary/20 hover:bg-muted/50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            selected
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p
              className={`font-medium text-sm ${
                selected ? 'text-primary' : 'text-foreground'
              }`}
            >
              {label}
            </p>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                selected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {count}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  );
}
