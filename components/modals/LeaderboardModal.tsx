'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Trophy, DollarSign, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { cn } from '@/lib/utils';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserWithCosts {
  uid: string;
  email: string;
  displayName: string;
  totalCost: number;
  totalTokens: number;
  totalChats: number;
  totalMessages: number;
  mostUsedModel: string;
  avgCostPerMessage: number;
}

export function LeaderboardModal({ isOpen, onClose }: LeaderboardModalProps) {
  const { user } = useAuth();
  const [usersWithCosts, setUsersWithCosts] = useState<UserWithCosts[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError('');
      const getUsersWithCostsPublic = httpsCallable(functions, 'getUsersWithCostsPublic');
      const result = await getUsersWithCostsPublic();
      const data = result.data as { users: UserWithCosts[]; lastUpdated: string | null };
      setUsersWithCosts(data.users || []);
      setLastUpdated(data.lastUpdated);
    } catch (err: unknown) {
      setError((err as Error).message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) loadLeaderboard();
  }, [isOpen, loadLeaderboard]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-7xl bg-card border border-border rounded-2xl shadow-lg animate-in slide-in-from-bottom-2 duration-300 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Leaderboard de Gastos</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground">Ranking por custo total acumulado</p>
                <span className="text-xs text-muted-foreground">•</span>
                <p className="text-xs text-muted-foreground">Atualizado a cada 24h</p>
              </div>
              {lastUpdated && (
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Última atualização: {new Date(lastUpdated).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="p-12 text-center text-destructive">{error}</div>
          ) : usersWithCosts.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum dado encontrado</p>
            </div>
          ) : (
            <>
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

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Pos.</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Usuário</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Custo Total</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Tokens</th>
                      <th className="px-2 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Chats</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Msgs</th>
                      <th className="px-2 py-3 text-right text-xs font-medium text-muted-foreground uppercase">$/Chat</th>
                      <th className="px-2 py-3 text-right text-xs font-medium text-muted-foreground uppercase">$/Msg</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Modelo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {usersWithCosts.map((user, index) => {
                      const avgCostPerChat = user.totalChats > 0 ? user.totalCost / user.totalChats : 0;
                      const isTop3 = index < 3;
                      
                      // Extrair nome do modelo (remover prefixo do provider)
                      const modelName = user.mostUsedModel.includes('/') 
                        ? user.mostUsedModel.split('/').pop() || user.mostUsedModel
                        : user.mostUsedModel;
                      
                      return (
                        <tr key={user.uid} className={cn("hover:bg-muted/30 transition-colors", isTop3 && "bg-accent/5")}>
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-1">
                              {index === 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
                              {index === 1 && <Trophy className="w-4 h-4 text-gray-400" />}
                              {index === 2 && <Trophy className="w-4 h-4 text-amber-700" />}
                              <span className={cn("font-bold text-base", isTop3 ? "text-foreground" : "text-muted-foreground")}>
                                #{index + 1}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-sm text-foreground">{user.displayName}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-green-600 dark:text-green-400">
                                ${user.totalCost.toFixed(6)}
                              </span>
                              {user.totalCost > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {((user.totalCost / usersWithCosts.reduce((sum, u) => sum + u.totalCost, 0)) * 100).toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="font-medium text-sm text-blue-600 dark:text-blue-400">
                              {user.totalTokens.toLocaleString('pt-BR')}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-right">
                            <span className="font-medium text-sm text-foreground">{user.totalChats}</span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="font-medium text-sm text-foreground">
                              {user.totalMessages.toLocaleString('pt-BR')}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-right">
                            <span className="text-xs text-muted-foreground">${avgCostPerChat.toFixed(5)}</span>
                          </td>
                          <td className="px-2 py-3 text-right">
                            <span className="text-xs text-muted-foreground">
                              ${user.avgCostPerMessage.toFixed(5)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                              <span className="text-xs text-foreground truncate max-w-[150px]" title={user.mostUsedModel}>
                                {modelName}
                              </span>
                            </div>
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
      </div>
    </div>
  );
}
