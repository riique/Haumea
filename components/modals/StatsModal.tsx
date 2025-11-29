'use client';

import { useState, useMemo } from 'react';
import { MessageSquare, User, Bot, Type, X, DollarSign, Clock, FileText, BarChart3, TrendingUp } from 'lucide-react';
import { Message } from '@/types/chat';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, TooltipProps } from 'recharts';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  chatName: string;
  totalCost?: number;
  totalTokens?: number;
}

type TabType = 'overview' | 'analysis';

// Componente customizado de Tooltip para os gráficos
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-3">
        {label && <p className="text-sm font-semibold text-foreground mb-1">{label}</p>}
        {payload.map((entry, index) => (
          <p key={index} className="text-sm text-foreground">
            <span className="font-medium">{entry.name}: </span>
            <span className="font-bold">{entry.value?.toLocaleString('pt-BR')}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function StatsModal({ isOpen, onClose, messages, chatName, totalCost = 0, totalTokens = 0 }: StatsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Calcular todas as estatísticas
  const stats = useMemo(() => {
    const totalMessages = messages.length;
    const userMessages = messages.filter((m) => m.role === 'user');
    const aiMessages = messages.filter((m) => m.role === 'assistant');
    
    // Caracteres
    const userChars = userMessages.reduce((sum, m) => sum + m.content.length, 0);
    const aiChars = aiMessages.reduce((sum, m) => sum + m.content.length, 0);
    const totalChars = userChars + aiChars;
    
    // Palavras
    const allWords = messages.map(m => m.content).join(' ').toLowerCase();
    const words = allWords.match(/\b[a-záàâãéêíóôõúçA-ZÁÀÂÃÉÊÍÓÔÕÚÇ]+\b/g) || [];
    const totalWords = words.length;
    const avgWordsPerMessage = totalMessages > 0 ? Math.round(totalWords / totalMessages) : 0;
    
    // Frases (contando pontos finais, interrogações e exclamações)
    const totalSentences = messages.reduce((sum, m) => {
      const sentences = m.content.match(/[.!?]+/g);
      return sum + (sentences ? sentences.length : 1); // Pelo menos 1 frase por mensagem
    }, 0);
    const avgSentencesPerMessage = totalMessages > 0 ? (totalSentences / totalMessages).toFixed(1) : '0';
    
    // Tempo de leitura (assumindo 200 palavras por minuto)
    const readingTimeMinutes = Math.ceil(totalWords / 200);
    
    // Frequência de palavras (top 10)
    const wordFrequency: Record<string, number> = {};
    const stopWords = new Set(['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'à', 'seu', 'sua', 'ou', 'ser', 'quando', 'muito', 'há', 'nos', 'já', 'está', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso', 'ela', 'entre', 'era', 'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem', 'nas', 'me', 'esse', 'eles', 'estão', 'você', 'tinha', 'foram', 'essa', 'num', 'nem', 'suas', 'meu', 'às', 'minha', 'têm', 'numa', 'pelos', 'elas', 'havia', 'seja', 'qual', 'será', 'nós', 'tenho', 'lhe', 'deles', 'essas', 'esses', 'pelas', 'este', 'fosse', 'dele']);
    
    words.forEach(word => {
      if (word.length > 3 && !stopWords.has(word)) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });
    
    const topWords = Object.entries(wordFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    return {
      totalMessages,
      userMessages: userMessages.length,
      aiMessages: aiMessages.length,
      userChars,
      aiChars,
      totalChars,
      avgWordsPerMessage,
      avgSentencesPerMessage,
      readingTimeMinutes,
      topWords,
      firstMessage: messages[0]?.createdAt,
      lastMessage: messages[messages.length - 1]?.createdAt,
      totalCost,
      totalTokens,
    };
  }, [messages, totalCost, totalTokens]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl bg-card border border-border rounded-2xl shadow-lg animate-in slide-in-from-bottom-2 duration-300 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Estatísticas do Chat</h2>
            <p className="text-sm text-muted-foreground mt-1">{chatName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors duration-150"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Visão Geral
            </div>
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'analysis'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Análise Avançada
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' ? (
            <OverviewTab stats={stats} />
          ) : (
            <AnalysisTab stats={stats} />
          )}
        </div>
      </div>
    </div>
  );
}

interface OverviewTabProps {
  stats: {
    totalMessages: number;
    userMessages: number;
    aiMessages: number;
    userChars: number;
    aiChars: number;
    totalChars: number;
    avgWordsPerMessage: number;
    avgSentencesPerMessage: string;
    readingTimeMinutes: number;
    firstMessage?: Date;
    lastMessage?: Date;
    totalCost: number;
    totalTokens: number;
  };
}

function OverviewTab({ stats }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          icon={MessageSquare}
          label="Total de Mensagens"
          value={stats.totalMessages}
          color="primary"
        />
        <StatCard 
          icon={User} 
          label="Suas Mensagens" 
          value={stats.userMessages} 
          color="accent" 
        />
        <StatCard
          icon={Bot}
          label="Mensagens da IA"
          value={stats.aiMessages}
          color="warning"
        />
        <StatCard 
          icon={Type} 
          label="Caracteres Totais" 
          value={stats.totalChars.toLocaleString('pt-BR')} 
          color="success" 
        />
        <StatCard
          icon={FileText}
          label="Frases por Mensagem"
          value={stats.avgSentencesPerMessage}
          color="primary"
        />
        <StatCard
          icon={Clock}
          label="Tempo de Leitura"
          value={`${stats.readingTimeMinutes} min`}
          color="accent"
        />
      </div>

      {/* Cost and Tokens Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Total Cost Card */}
        <div className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Custo Total do Chat</p>
              <p className="text-2xl font-bold text-success">
                ${(stats.totalCost || 0).toFixed(6)}
              </p>
            </div>
          </div>
        </div>

        {/* Total Tokens Card */}
        <div className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Total de Tokens</p>
              <p className="text-2xl font-bold text-primary">
                {(stats.totalTokens || 0).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Character Distribution Chart */}
      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm font-semibold text-foreground mb-3">Distribuição de Caracteres</p>
        <div className="flex gap-2 h-8 rounded-lg overflow-hidden">
          <div
            className="bg-accent rounded-l-lg flex items-center justify-center text-xs font-semibold text-accent-foreground"
            style={{
              width: `${stats.totalChars > 0 ? (stats.userChars / stats.totalChars) * 100 : 0}%`,
            }}
            title={`Usuário: ${stats.userChars.toLocaleString('pt-BR')} caracteres`}
          >
            {stats.totalChars > 0 &&
              stats.userChars / stats.totalChars > 0.15 &&
              `${((stats.userChars / stats.totalChars) * 100).toFixed(0)}%`}
          </div>
          <div
            className="bg-warning rounded-r-lg flex items-center justify-center text-xs font-semibold text-white"
            style={{
              width: `${stats.totalChars > 0 ? (stats.aiChars / stats.totalChars) * 100 : 0}%`,
            }}
            title={`IA: ${stats.aiChars.toLocaleString('pt-BR')} caracteres`}
          >
            {stats.totalChars > 0 &&
              stats.aiChars / stats.totalChars > 0.15 &&
              `${((stats.aiChars / stats.totalChars) * 100).toFixed(0)}%`}
          </div>
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>
            Usuário ({stats.totalChars > 0 ? ((stats.userChars / stats.totalChars) * 100).toFixed(1) : 0}% - {stats.userChars.toLocaleString('pt-BR')} chars)
          </span>
          <span>
            IA ({stats.totalChars > 0 ? ((stats.aiChars / stats.totalChars) * 100).toFixed(1) : 0}% - {stats.aiChars.toLocaleString('pt-BR')} chars)
          </span>
        </div>
      </div>

      {/* Average Words */}
      <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
        <p className="text-sm font-semibold text-primary">Média de Palavras por Mensagem</p>
        <p className="text-3xl font-bold text-primary mt-2">{stats.avgWordsPerMessage}</p>
      </div>

      {/* Timeline */}
      {stats.firstMessage && stats.lastMessage && (
        <div className="pt-6 border-t border-border">
          <p className="text-sm font-semibold text-foreground mb-3">Linha do Tempo</p>
          <div className="flex justify-between text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Primeira mensagem</p>
              <p>{stats.firstMessage.toLocaleString('pt-BR')}</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-foreground">Última mensagem</p>
              <p>{stats.lastMessage.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AnalysisTabProps {
  stats: {
    topWords: Array<{ word: string; count: number }>;
    totalMessages: number;
    userMessages: number;
    aiMessages: number;
    userChars: number;
    aiChars: number;
  };
}

function AnalysisTab({ stats }: AnalysisTabProps) {
  const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--warning))', 'hsl(var(--success))', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444', '#06b6d4'];

  const messageDistributionData = [
    { name: 'Usuário', value: stats.userMessages, fill: 'hsl(var(--accent))' },
    { name: 'IA', value: stats.aiMessages, fill: 'hsl(var(--warning))' },
  ];

  const characterDistributionData = [
    { name: 'Usuário', value: stats.userChars, fill: 'hsl(var(--accent))' },
    { name: 'IA', value: stats.aiChars, fill: 'hsl(var(--warning))' },
  ];

  return (
    <div className="space-y-8">
      {/* Palavras Mais Usadas */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Palavras Mais Usadas</h3>
        <div className="bg-muted rounded-lg p-4">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.topWords}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="word" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {stats.topWords.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráficos de Pizza */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Distribuição de Mensagens */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Distribuição de Mensagens</h3>
          <div className="bg-muted rounded-lg p-4">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={messageDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {messageDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribuição de Caracteres */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Distribuição de Caracteres</h3>
          <div className="bg-muted rounded-lg p-4">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={characterDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {characterDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lista de Palavras com Contagem */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Detalhamento de Frequência</h3>
        <div className="bg-muted rounded-lg p-4">
          <div className="grid grid-cols-2 gap-3">
            {stats.topWords.map((item, index) => (
              <div 
                key={item.word} 
                className="flex items-center justify-between p-3 bg-card rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  >
                    {index + 1}
                  </div>
                  <span className="font-medium text-foreground">{item.word}</span>
                </div>
                <span className="text-sm font-semibold text-muted-foreground">
                  {item.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: 'primary' | 'accent' | 'warning' | 'success';
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent/10 text-accent',
    warning: 'bg-warning/10 text-warning',
    success: 'bg-success/10 text-success',
  };

  return (
    <div className="p-4 bg-card border border-border rounded-lg hover:shadow-md transition-shadow duration-200">
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}
