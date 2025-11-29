'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Chat, Folder, Message } from '@/types/chat';

interface DashboardContextType {
  // Sidebar State
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Chat State
  currentChatId: string | null;
  setCurrentChatId: (id: string | null) => void;
  chats: Chat[];
  setChats: (chats: Chat[]) => void;
  folders: Folder[];
  setFolders: (folders: Folder[]) => void;
  failedTranscriptionsCount: number;
  setFailedTranscriptionsCount: (count: number) => void;

  // Messages State
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;

  // Loading State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Settings State
  webSearchEnabled: boolean;
  setWebSearchEnabled: (enabled: boolean) => void;
  deepThinkingEnabled: boolean;
  setDeepThinkingEnabled: (enabled: boolean) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [failedTranscriptionsCount, setFailedTranscriptionsCount] = useState<number>(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [deepThinkingEnabled, setDeepThinkingEnabled] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const value: DashboardContextType = {
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    currentChatId,
    setCurrentChatId,
    chats,
    setChats,
    folders,
    setFolders,
    failedTranscriptionsCount,
    setFailedTranscriptionsCount,
    messages,
    setMessages,
    addMessage,
    isLoading,
    setIsLoading,
    webSearchEnabled,
    setWebSearchEnabled,
    deepThinkingEnabled,
    setDeepThinkingEnabled,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard deve ser usado dentro de DashboardProvider');
  }
  return context;
}
