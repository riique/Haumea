'use client';

import { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, Check } from 'lucide-react';
import { forceClearCacheForAllUsers, getForceClearCacheTimestamp } from '@/lib/services/admin-service';

export function AdminCacheControl() {
  const [isClearing, setIsClearing] = useState(false);
  const [lastForceTimestamp, setLastForceTimestamp] = useState<Date | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleForceClearCache = async () => {
    if (!confirm('⚠️ ATENÇÃO!\n\nIsso vai forçar TODOS os usuários a apagar o cache do IndexedDB na próxima vez que entrarem no site.\n\nAs mensagens estão seguras no Firebase Storage, mas o carregamento inicial deles será um pouco mais lento.\n\nTem certeza?')) {
      return;
    }

    setIsClearing(true);
    try {
      await forceClearCacheForAllUsers();
      const timestamp = await getForceClearCacheTimestamp();
      setLastForceTimestamp(timestamp);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error forcing cache clear:', error);
      alert('Erro ao forçar limpeza de cache. Tente novamente.');
    } finally {
      setIsClearing(false);
    }
  };

  const loadLastTimestamp = async () => {
    const timestamp = await getForceClearCacheTimestamp();
    setLastForceTimestamp(timestamp);
  };

  // Load timestamp on mount
  useEffect(() => {
    loadLastTimestamp();
  }, []);

  return (
    <div className="p-6 bg-card border border-border rounded-lg">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-destructive/10 rounded-lg">
          <Trash2 className="w-6 h-6 text-destructive" />
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2">
            Force Clear Cache (Todos os Usuários)
          </h3>
          
          <div className="space-y-3 mb-4">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-500 shrink-0" />
              <p>
                Força <strong>TODOS os usuários</strong> a apagar o cache do IndexedDB na próxima vez que entrarem no site.
                Use isso quando fizer mudanças críticas no código do cache.
              </p>
            </div>
            
            <div className="p-3 bg-muted rounded text-sm">
              <p className="font-medium mb-1">O que acontece:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Usuário entra no site</li>
                <li>Sistema detecta flag de force clear</li>
                <li>Apaga IndexedDB automaticamente</li>
                <li>Recarrega dados do Firebase Storage</li>
                <li>Recria cache limpo com código novo</li>
              </ul>
            </div>
            
            {lastForceTimestamp && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded text-sm">
                <p className="text-blue-600 dark:text-blue-400">
                  <strong>Última limpeza forçada:</strong>{' '}
                  {lastForceTimestamp.toLocaleString('pt-BR')}
                </p>
              </div>
            )}
          </div>
          
          <button
            onClick={handleForceClearCache}
            disabled={isClearing}
            className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isClearing ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Aplicando...
              </>
            ) : showSuccess ? (
              <>
                <Check className="w-4 h-4" />
                Aplicado!
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Force Clear Cache (Todos)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
