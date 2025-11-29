'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, FileJson, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { convertOldChatToNew, validateOldChatFormat } from '@/lib/services/chat-converter-service';
import { doc, setDoc, Timestamp, collection } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { saveMessages } from '@/lib/services/message-service';

interface ImportResult {
  fileName: string;
  success: boolean;
  message: string;
  chatName?: string;
}

export default function ConverterPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);

  const handleFiles = async (files: FileList) => {
    if (!user) {
      setResults([{
        fileName: 'N/A',
        success: false,
        message: 'Você precisa estar logado para importar conversas.',
      }]);
      return;
    }

    const fileArray = Array.from(files);
    const jsonFiles = fileArray.filter(f => f.name.endsWith('.json'));

    if (jsonFiles.length === 0) {
      setResults([{
        fileName: 'N/A',
        success: false,
        message: 'Nenhum arquivo .json válido foi selecionado.',
      }]);
      return;
    }

    setIsProcessing(true);
    setResults([]);

    const importResults: ImportResult[] = [];

    // Process each file
    for (const file of jsonFiles) {
      setCurrentFile(file.name);

      try {
        // Read file
        const fileContent = await file.text();
        const oldChat = JSON.parse(fileContent);

        // Validate format
        if (!validateOldChatFormat(oldChat)) {
          throw new Error('Formato inválido');
        }

        // Convert to new format
        const { chatMetadata, messages } = convertOldChatToNew(oldChat);

        // Create chat in Firestore
        const chatRef = doc(collection(firestore, `users/${user.uid}/chats`));
        
        const firestoreData = {
          ...chatMetadata,
          createdAt: Timestamp.fromDate(chatMetadata.createdAt),
          lastMessageAt: Timestamp.fromDate(chatMetadata.lastMessageAt),
        };

        await setDoc(chatRef, firestoreData);

        // Save messages to Storage
        await saveMessages(user.uid, chatRef.id, messages);

        importResults.push({
          fileName: file.name,
          success: true,
          message: `${messages.length} mensagens importadas`,
          chatName: chatMetadata.name,
        });

      } catch (error) {
        console.error(`Error importing ${file.name}:`, error);
        importResults.push({
          fileName: file.name,
          success: false,
          message: error instanceof Error ? error.message : 'Erro ao processar arquivo',
        });
      }
    }

    setResults(importResults);
    setCurrentFile(null);
    setIsProcessing(false);

    // Redirect to dashboard after 5 seconds if at least one succeeded
    if (importResults.some(r => r.success)) {
      setTimeout(() => {
        router.push('/dashboard');
      }, 5000);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFiles(files);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFiles(files);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 rounded-lg border border-zinc-800 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Autenticação Necessária</h2>
          <p className="text-zinc-400 mb-6">
            Você precisa estar logado para importar conversas.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Fazer Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Dashboard
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">Importar Conversas</h1>
          <p className="text-zinc-400">
            Importe suas conversas do site antigo para continuar de onde parou.
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Como importar:</h2>
          <ol className="space-y-2 text-zinc-300">
            <li className="flex gap-3">
              <span className="font-semibold text-blue-500">1.</span>
              <span>Localize o arquivo .json da conversa exportada do site antigo</span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-blue-500">2.</span>
              <span>Arraste um ou mais arquivos para a área abaixo ou clique para selecionar</span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-blue-500">3.</span>
              <span>Aguarde a conversão e importação automática</span>
            </li>
          </ol>
        </div>

        {/* Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-12 text-center transition-all
            ${isDragging
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
            }
            ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          <input
            type="file"
            accept=".json"
            multiple
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isProcessing}
          />

          <div className="flex flex-col items-center gap-4">
            {isProcessing ? (
              <>
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-white font-medium">Processando conversas...</p>
                {currentFile && (
                  <p className="text-zinc-400 text-sm">Importando: {currentFile}</p>
                )}
                <p className="text-zinc-400 text-sm">Aguarde enquanto convertemos suas conversas</p>
              </>
            ) : (
              <>
                <div className="p-4 bg-zinc-800 rounded-full">
                  {isDragging ? (
                    <Upload className="w-12 h-12 text-blue-500" />
                  ) : (
                    <FileJson className="w-12 h-12 text-zinc-400" />
                  )}
                </div>
                <div>
                  <p className="text-white font-medium mb-1">
                    {isDragging ? 'Solte os arquivos aqui' : 'Arraste arquivos .json aqui'}
                  </p>
                  <p className="text-zinc-400 text-sm">ou clique para selecionar múltiplos arquivos</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Results List */}
        {results.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-lg font-semibold text-white mb-3">
              Resultados da Importação ({results.filter(r => r.success).length}/{results.length} sucesso)
            </h3>
            {results.map((result, index) => (
              <div
                key={index}
                className={`
                  p-4 rounded-lg border flex items-start gap-3
                  ${result.success
                    ? 'bg-green-500/10 border-green-500/50 text-green-400'
                    : 'bg-red-500/10 border-red-500/50 text-red-400'
                  }
                `}
              >
                {result.success ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium mb-1">
                    {result.chatName || result.fileName}
                  </p>
                  <p className="text-sm opacity-90 truncate">
                    {result.fileName} - {result.message}
                  </p>
                </div>
              </div>
            ))}
            {results.some(r => r.success) && (
              <p className="text-sm text-zinc-400 text-center mt-4">
                Redirecionando para o dashboard em alguns segundos...
              </p>
            )}
          </div>
        )}

        {/* Additional Info */}
        <div className="mt-8 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <h3 className="text-sm font-semibold text-white mb-2">ℹ️ Observações:</h3>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>• Apenas arquivos .json do site antigo são suportados</li>
            <li>• A conversa será adicionada à sua conta atual</li>
            <li>• Todas as mensagens e metadados serão preservados</li>
            <li>• Você pode importar múltiplas conversas de uma só vez</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
