'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { 
  Shield, 
  Users, 
  Lock, 
  Unlock, 
  Trash2, 
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
  DollarSign,
  Trophy,
  Database
} from 'lucide-react';
import { AdminCacheControl } from '@/components/admin/AdminCacheControl';

interface User {
  uid: string;
  email: string;
  displayName: string;
  inviteCode: string | null;
  disabled: boolean;
  emailVerified: boolean;
  createdAt: string | null;
}

interface UserWithCosts {
  uid: string;
  email: string;
  displayName: string;
  totalCost: number;
  totalTokens: number;
  totalChats: number;
  totalMessages: number;
  createdAt: string | null;
}


// Helper para formatar datas
const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return 'N/A';
  }
};

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Data states
  const [users, setUsers] = useState<User[]>([]);
  const [usersWithCosts, setUsersWithCosts] = useState<UserWithCosts[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'costs' | 'cache'>('users');
  
  // UI states
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Verificar se usuário está logado
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const adminManagerFn = httpsCallable(functions, 'adminManager');
      const result = await adminManagerFn({ action: 'verifyAdminPassword', password });
      
      if ((result.data as { valid: boolean }).valid) {
        setIsAuthenticated(true);
        await loadData(password);
      } else {
        setError('Senha incorreta');
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Erro ao verificar senha');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async (adminPassword: string) => {
    try {
      setLoading(true);
      
      const adminManagerFn = httpsCallable(functions, 'adminManager');
      
      // Carregar usuários
      const usersResult = await adminManagerFn({ action: 'listUsers', adminPassword });
      setUsers((usersResult.data as { users: User[] }).users || []);
      
      // Carregar usuários com custos
      const usersWithCostsResult = await adminManagerFn({ action: 'getUsersWithCosts', adminPassword });
      setUsersWithCosts((usersWithCostsResult.data as { users: UserWithCosts[] }).users || []);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };


  const handleToggleUserBlock = async (userId: string, currentlyDisabled: boolean) => {
    setActionLoading(userId);
    try {
      const adminManagerFn = httpsCallable(functions, 'adminManager');
      await adminManagerFn({
        action: 'toggleUserBlock',
        adminPassword: password,
        userId,
        block: !currentlyDisabled
      });
      
      await loadData(password);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Erro ao atualizar status do usuário');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja excluir a conta de "${userName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setActionLoading(userId);
    try {
      const adminManagerFn = httpsCallable(functions, 'adminManager');
      await adminManagerFn({
        action: 'deleteUserAccount',
        adminPassword: password,
        userId
      });
      
      await loadData(password);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Erro ao excluir conta');
    } finally {
      setActionLoading(null);
    }
  };


  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Tela de autenticação
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 p-8 border-b border-border/50">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-display font-bold text-foreground">
                    Painel Admin
                  </h1>
                  <p className="text-muted-foreground">
                    Acesso restrito
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="p-8">
              {error && (
                <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label htmlFor="admin-password" className="block text-sm font-medium mb-1.5 text-foreground">
                    Senha de Administrador
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full pl-10 pr-12 py-2.5 bg-background border border-input rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
                      placeholder="Digite a senha de administrador"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    'Acessar Painel'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Painel administrativo
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-foreground">
                  Painel de Administração
                </h1>
                <p className="text-sm text-muted-foreground">
                  Gerencie usuários e códigos de convite
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="text-destructive hover:text-destructive/80 transition-colors"
            >
              ×
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 p-1 bg-muted/50 rounded-lg inline-flex">
          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              "px-6 py-2.5 rounded-md font-medium transition-all text-sm flex items-center gap-2",
              activeTab === 'users'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="w-4 h-4" />
            Usuários ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('costs')}
            className={cn(
              "px-6 py-2.5 rounded-md font-medium transition-all text-sm flex items-center gap-2",
              activeTab === 'costs'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <DollarSign className="w-4 h-4" />
            Leaderboard de Gastos
          </button>
          <button
            onClick={() => setActiveTab('cache')}
            className={cn(
              "px-6 py-2.5 rounded-md font-medium transition-all text-sm flex items-center gap-2",
              activeTab === 'cache'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Database className="w-4 h-4" />
            Cache
          </button>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Usuários Registrados</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerencie contas de usuários e permissões
                </p>
              </div>
              <button
                onClick={() => loadData(password)}
                disabled={loading}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                Atualizar
              </button>
            </div>

            {loading ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum usuário encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Usuário
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Código
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Criado em
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((user) => (
                      <tr key={user.uid} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-foreground">{user.displayName}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {user.inviteCode || 'N/A'}
                          </code>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                              user.disabled
                                ? "bg-destructive/10 text-destructive"
                                : "bg-accent/10 text-accent"
                            )}
                          >
                            {user.disabled ? 'Bloqueado' : 'Ativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleUserBlock(user.uid, user.disabled)}
                              disabled={actionLoading === user.uid}
                              className={cn(
                                "p-2 rounded-lg transition-all disabled:opacity-50",
                                user.disabled
                                  ? "bg-accent/10 text-accent hover:bg-accent/20"
                                  : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                              )}
                              title={user.disabled ? 'Desbloquear usuário' : 'Bloquear usuário'}
                            >
                              {actionLoading === user.uid ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : user.disabled ? (
                                <Unlock className="w-4 h-4" />
                              ) : (
                                <Lock className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.uid, user.displayName)}
                              disabled={actionLoading === user.uid}
                              className="p-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg transition-all disabled:opacity-50"
                              title="Excluir conta"
                            >
                              {actionLoading === user.uid ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Costs Tab - Leaderboard */}
        {activeTab === 'costs' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Leaderboard de Gastos</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Ranking de usuários por custo total acumulado
                </p>
              </div>
              <button
                onClick={() => loadData(password)}
                disabled={loading}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                Atualizar
              </button>
            </div>

            {loading ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : usersWithCosts.length === 0 ? (
              <div className="p-12 text-center">
                <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum dado de custo encontrado</p>
              </div>
            ) : (
              <>
                {/* Stats Summary */}
                <div className="grid grid-cols-4 gap-4 p-6 bg-muted/30 border-b border-border">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Total Gasto</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      ${usersWithCosts.reduce((sum, u) => sum + u.totalCost, 0).toFixed(4)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Total Tokens</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {usersWithCosts.reduce((sum, u) => sum + u.totalTokens, 0).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Total Chats</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {usersWithCosts.reduce((sum, u) => sum + u.totalChats, 0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Total Mensagens</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {usersWithCosts.reduce((sum, u) => sum + u.totalMessages, 0).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>

                {/* Leaderboard Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Posição
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Usuário
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Custo Total
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Tokens
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Chats
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Mensagens
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Média/Chat
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {usersWithCosts.map((user, index) => {
                        const avgCostPerChat = user.totalChats > 0 ? user.totalCost / user.totalChats : 0;
                        const isTop3 = index < 3;
                        
                        return (
                          <tr 
                            key={user.uid} 
                            className={cn(
                              "hover:bg-muted/30 transition-colors",
                              isTop3 && "bg-accent/5"
                            )}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                {index === 0 && (
                                  <Trophy className="w-5 h-5 text-yellow-500" />
                                )}
                                {index === 1 && (
                                  <Trophy className="w-5 h-5 text-gray-400" />
                                )}
                                {index === 2 && (
                                  <Trophy className="w-5 h-5 text-amber-700" />
                                )}
                                <span className={cn(
                                  "font-bold text-lg",
                                  isTop3 ? "text-foreground" : "text-muted-foreground"
                                )}>
                                  #{index + 1}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <div className="font-medium text-foreground">{user.displayName}</div>
                                <div className="text-sm text-muted-foreground">{user.email}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-green-600 dark:text-green-400">
                                  ${user.totalCost.toFixed(6)}
                                </span>
                                {user.totalCost > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {((user.totalCost / usersWithCosts.reduce((sum, u) => sum + u.totalCost, 0)) * 100).toFixed(1)}% do total
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="font-medium text-blue-600 dark:text-blue-400">
                                {user.totalTokens.toLocaleString('pt-BR')}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="font-medium text-foreground">
                                {user.totalChats}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="font-medium text-foreground">
                                {user.totalMessages.toLocaleString('pt-BR')}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-sm text-muted-foreground">
                                ${avgCostPerChat.toFixed(6)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Cache Tab */}
        {activeTab === 'cache' && (
          <div className="space-y-6">
            <AdminCacheControl />
            
            <div className="p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium mb-2">
                ⚠️ Gerenciamento de Cache
              </p>
              <p className="text-sm text-muted-foreground">
                Use o botão acima para forçar TODOS os usuários a limpar o cache do IndexedDB na próxima vez que entrarem no site.
                As mensagens permanecem seguras no Firebase Storage.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
