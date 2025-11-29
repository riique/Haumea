import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchOpenRouterCredits } from '@/lib/services/openrouter-service';

export function useOpenRouterBalance(apiKey?: string) {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const isLoadingRef = useRef(false);
  const lastApiKeyRef = useRef<string | undefined>(undefined);
  const lastFetchRef = useRef<number>(0);
  const CACHE_TIME = 5 * 60 * 1000; // 5 minutos

  const fetchBalance = useCallback(async (forceRefresh = false) => {
    if (!apiKey) {
      setBalance(null);
      return;
    }

    // Prevent simultaneous calls
    if (isLoadingRef.current) {
      return;
    }

    // Cache check
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;
    if (!forceRefresh && timeSinceLastFetch < CACHE_TIME && lastApiKeyRef.current === apiKey) {
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetchOpenRouterCredits();
      setBalance(result);
      lastApiKeyRef.current = apiKey;
      lastFetchRef.current = now;
    } catch (err) {
      console.error('Erro ao buscar saldo:', err);
      setError(err as Error);
      setBalance(null);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [apiKey]);

  // Load on API key change
  useEffect(() => {
    if (apiKey && lastApiKeyRef.current !== apiKey && !isLoadingRef.current) {
      fetchBalance();
    }
  }, [apiKey, fetchBalance]);

  return {
    balance,
    isLoading,
    error,
    refresh: () => fetchBalance(true),
  };
}

/**
 * VERSÃO COM SWR (recomendada)
 * Descomentar após instalar: npm install swr
 */

/*
export function useOpenRouterBalance(apiKey?: string) {
  const { data, error, isLoading, mutate } = useSWR(
    // Key: apenas fazer fetch se tiver API key
    apiKey ? ['openrouter-balance', apiKey] : null,
    // Fetcher
    () => fetchOpenRouterCredits(),
    {
      // Opções de cache e revalidação
      refreshInterval: 5 * 60 * 1000,       // Refresh a cada 5 minutos
      revalidateOnFocus: false,             // Não revalidar ao focar janela
      revalidateOnReconnect: true,          // Revalidar ao reconectar
      dedupingInterval: 2000,               // Dedupe requests em 2s
      shouldRetryOnError: true,             // Retry em caso de erro
      errorRetryCount: 3,                   // Máximo 3 retries
      errorRetryInterval: 5000,             // 5s entre retries
      
      // Fallback em caso de erro
      fallbackData: null,
      
      // Configurações de performance
      keepPreviousData: true,               // Manter dados anteriores durante revalidação
      
      // Callbacks
      onSuccess: (data) => {
        console.log('Saldo atualizado:', data);
      },
      onError: (error) => {
        console.error('Erro ao buscar saldo:', error);
      },
    }
  );

  return {
    balance: data ?? null,
    isLoading,
    error,
    // Função para forçar refresh (ex: após enviar mensagem)
    refresh: () => mutate(),
  };
}
*/

/**
 * EXEMPLO DE USO
 * 
 * No dashboard:
 * 
 * const { balance, isLoading, refresh } = useOpenRouterBalance(
 *   userProfile?.openRouterApiKey
 * );
 * 
 * // Após enviar mensagem
 * await handleSendMessage(...);
 * refresh(); // Forçar atualização do saldo
 * 
 * // Renderização
 * {isLoading ? (
 *   <Loader2 className="w-3 h-3 animate-spin" />
 * ) : balance !== null ? (
 *   `$${balance.toFixed(2)}`
 * ) : (
 *   <span className="text-destructive">Erro</span>
 * )}
 */
