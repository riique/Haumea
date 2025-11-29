'use client';

import { useState, useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import {
  X,
  Search,
  Sparkles,
  Eye,
  ShieldCheck,
  Loader2,
  ChevronRight,
  Filter,
  ArrowUpDown,
  ChevronDown,
  Star,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import {
  fetchAvailableModels,
  formatPricing,
  getProviderName,
  getModelShortName,
  parsePricing,
  invalidateModelsCache,
  type OpenRouterModel,
} from '@/lib/services/openrouter-service';
import { useAuth } from '@/contexts/AuthContext';
import { ExpensiveModelConfirmModal } from './ExpensiveModelConfirmModal';
import { updateNativeReasoningCache } from '@/lib/utils/model-reasoning';

interface ModelSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: string;
  onSelectModel: (modelId: string) => void;
  audioOnly?: boolean; // Se true, mostrar apenas modelos com suporte a áudio
}

type ProviderOption =
  | 'all'
  | 'anthropic'
  | 'cohere'
  | 'google'
  | 'meta'
  | 'mistral'
  | 'openai'
  | 'perplexity'
  | 'other';

type SortOption = 'popular' | 'name' | 'priceLow' | 'priceHigh' | 'context';

const ITEMS_PER_PAGE = 20;

// Simple Levenshtein distance for fuzzy matching
function getLevenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Advanced search scoring function
function calculateSearchScore(model: OpenRouterModel, tokens: string[]): number {
  if (tokens.length === 0) return 0;

  let totalScore = 0;

  const modelName = model.name.toLowerCase();
  const modelId = model.id.toLowerCase();
  const modelDescription = (model.description || '').toLowerCase();
  const provider = getProviderName(model.id).toLowerCase();
  const slug = (model.canonical_slug || getModelShortName(model.id)).toLowerCase();
  const supportedParams = (model.supported_parameters || []).join(' ').toLowerCase();

  tokens.forEach((token) => {
    // Exact match in name (highest priority)
    if (modelName === token) {
      totalScore += 100;
    } else if (modelName.includes(token)) {
      // Partial match in name
      const startsWith = modelName.startsWith(token);
      totalScore += startsWith ? 50 : 30;
    }

    // Match in ID
    if (modelId === token) {
      totalScore += 80;
    } else if (modelId.includes(token)) {
      const startsWith = modelId.startsWith(token);
      totalScore += startsWith ? 40 : 20;
    }

    // Match in slug
    if (slug.includes(token)) {
      totalScore += 15;
    }

    // Match in provider
    if (provider === token) {
      totalScore += 60;
    } else if (provider.includes(token)) {
      totalScore += 25;
    }

    // Match in description (lower priority)
    if (modelDescription.includes(token)) {
      const words = modelDescription.split(/\s+/);
      const exactWordMatch = words.some(word => word === token);
      totalScore += exactWordMatch ? 10 : 5;
    }

    // Match in supported parameters
    if (supportedParams.includes(token)) {
      totalScore += 8;
    }

    // Fuzzy matching for typos (basic Levenshtein distance)
    if (token.length >= 4) {
      // Check if token is similar to name words
      const nameWords = modelName.split(/[\s-_/]+/);
      nameWords.forEach(word => {
        if (word.length >= 3) {
          const distance = getLevenshteinDistance(token, word);
          if (distance === 1) {
            totalScore += 20; // One character off
          } else if (distance === 2) {
            totalScore += 10; // Two characters off
          }
        }
      });
    }
  });

  return totalScore;
}

export function ModelSelectModal({
  isOpen,
  onClose,
  currentModel,
  onSelectModel,
  audioOnly = false,
}: ModelSelectModalProps) {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption>('all');
  const [sortOption, setSortOption] = useState<SortOption>('popular');
  const [selectedModel, setSelectedModel] = useState(currentModel);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const { userProfile, updateUserProfile } = useAuth();
  const [favoriteModels, setFavoriteModels] = useState<string[]>(userProfile?.favoriteModels || []);
  const [favoriteUpdatingId, setFavoriteUpdatingId] = useState<string | null>(null);
  const [expensiveModelPending, setExpensiveModelPending] = useState<OpenRouterModel | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const providerDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const [providerOpen, setProviderOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const providerLabels: Record<ProviderOption, string> = {
    all: 'Todos Provedores',
    anthropic: 'Anthropic',
    cohere: 'Cohere',
    google: 'Google',
    meta: 'Meta',
    mistral: 'Mistral',
    openai: 'OpenAI',
    perplexity: 'Perplexity',
    other: 'Other',
  };

  const sortLabels: Record<SortOption, string> = {
    popular: 'Popular',
    name: 'Nome',
    priceLow: 'Preço (Baixo)',
    priceHigh: 'Preço (Alto)',
    context: 'Contexto',
  };

  useEffect(() => {
    if (!isOpen) return;
    setFavoriteModels(userProfile?.favoriteModels || []);
  }, [isOpen, userProfile?.favoriteModels]);

  // Fetch models from OpenRouter
  useEffect(() => {
    if (!isOpen) return;

    const loadModels = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout loading models')), 35000);
        });

        // Use cached models if available (skipCache = false by default)
        // This prevents timeout issues when OpenRouter API is slow
        const fetchedModels = await Promise.race([
          fetchAvailableModels(false),
          timeoutPromise
        ]);
        
        const sanitizedModels = fetchedModels.filter(
          (model) => getModelShortName(model.id).toLowerCase() !== 'auto'
        );
        setModels(sanitizedModels);
        
        // Update native reasoning cache with fresh API data
        updateNativeReasoningCache(sanitizedModels);
      } catch (error) {
        console.error('Error loading models:', error);
        setError('Failed to load models. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, [isOpen]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        providerDropdownRef.current &&
        !providerDropdownRef.current.contains(event.target as Node)
      ) {
        setProviderOpen(false);
      }

      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setSortOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset dropdowns when modal closes
  useEffect(() => {
    if (!isOpen) {
      setProviderOpen(false);
      setSortOpen(false);
    }
  }, [isOpen]);

  // Filter and sort models
  const filteredModels = useMemo(() => {
    let filtered = models;

    // Tokenize search query for multi-word search
    const searchTokens = searchQuery
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(token => token.length > 0);

    // Apply search filter with scoring
    if (searchTokens.length > 0) {
      const modelsWithScores = filtered.map(model => ({
        model,
        searchScore: calculateSearchScore(model, searchTokens)
      }));

      // Filter out models with zero score (no match)
      filtered = modelsWithScores
        .filter(item => item.searchScore > 0)
        .sort((a, b) => b.searchScore - a.searchScore)
        .map(item => item.model);
    }

    // Apply audio filter (if audioOnly mode is active)
    if (audioOnly) {
      filtered = filtered.filter((model) =>
        model.architecture?.input_modalities?.includes('audio')
      );
    }

    // Apply provider filter
    if (selectedProvider !== 'all') {
      filtered = filtered.filter((model) => {
        const provider = getProviderName(model.id).toLowerCase();
        const normalized = provider.replace(/\s+/g, '');

        const knownProviders: ProviderOption[] = [
          'anthropic',
          'cohere',
          'google',
          'meta',
          'mistral',
          'openai',
          'perplexity',
        ];

        if (selectedProvider === 'other') {
          return !knownProviders.some((item) => normalized.includes(item));
        }

        return normalized.includes(selectedProvider);
      });
    }

    // Apply sorting only if no search query (search already sorted by relevance)
    const sorted = [...filtered];
    
    if (searchTokens.length === 0) {
      switch (sortOption) {
        case 'name':
          sorted.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'priceLow': {
          sorted.sort((a, b) => (parsePricing(a.pricing.prompt) || Infinity) - (parsePricing(b.pricing.prompt) || Infinity));
          break;
        }
        case 'priceHigh': {
          sorted.sort((a, b) => (parsePricing(b.pricing.prompt) || 0) - (parsePricing(a.pricing.prompt) || 0));
          break;
        }
        case 'context': {
          const getContext = (model: OpenRouterModel) => model.context_length || model.top_provider.context_length || 0;
          sorted.sort((a, b) => getContext(b) - getContext(a));
          break;
        }
        case 'popular':
        default: {
          sorted.sort((a, b) => {
            const score = (model: OpenRouterModel) => {
              const contextScore = (model.context_length || model.top_provider.context_length || 0) * 0.1;
              const priceScore = 1 / ((parsePricing(model.pricing.prompt) || 1) + 0.001);
              return contextScore + priceScore;
            };
            return score(b) - score(a);
          });
        }
      }
    }

    // Prioritize favorites AND most used ONLY when there's NO active search
    // When searching, keep results sorted purely by relevance
    const hasActiveSearch = searchTokens.length > 0;
    
    if (hasActiveSearch) {
      // When searching, don't prioritize favorites/usage - keep relevance order
      return sorted;
    }

    // No search active - apply favorites and usage prioritization
    const favoritesSet = new Set(favoriteModels);
    const usageCounts = userProfile?.modelUsageCount || {};

    const prioritized = sorted
      .map((model, index) => ({ 
        model, 
        index, 
        isFavorite: favoritesSet.has(model.id),
        usageCount: usageCounts[model.id] || 0,
      }))
      .sort((a, b) => {
        // 1st: Favorites always first
        if (a.isFavorite !== b.isFavorite) {
          return a.isFavorite ? -1 : 1;
        }
        
        // 2nd: Among favorites OR non-favorites, sort by usage
        if (a.usageCount !== b.usageCount) {
          return b.usageCount - a.usageCount; // Higher usage first
        }
        
        // 3rd: Maintain original order (from previous sort)
        return a.index - b.index;
      })
      .map((item) => item.model);

    return prioritized;
  }, [models, searchQuery, selectedProvider, sortOption, favoriteModels, userProfile?.modelUsageCount, audioOnly]);

  // Virtualization: only show subset of models
  const visibleModels = useMemo(() => {
    return filteredModels.slice(0, visibleCount);
  }, [filteredModels, visibleCount]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredModels.length) {
          setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredModels.length));
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(sentinelRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [visibleCount, filteredModels.length]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, [selectedProvider, sortOption, searchQuery]);

  // Check if a model is expensive (> $15/M for input or output)
  const isExpensiveModel = (model: OpenRouterModel): boolean => {
    const inputPrice = parsePricing(model.pricing.prompt);
    const outputPrice = parsePricing(model.pricing.completion);
    
    const EXPENSIVE_THRESHOLD = 15; // $15 per million tokens
    
    return (inputPrice !== null && inputPrice > EXPENSIVE_THRESHOLD) || 
           (outputPrice !== null && outputPrice > EXPENSIVE_THRESHOLD);
  };

  const handleSelectModel = async (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    
    if (model && isExpensiveModel(model)) {
      // Show expensive model confirmation
      setExpensiveModelPending(model);
    } else {
      // Increment usage counter
      if (userProfile?.uid) {
        const currentCount = userProfile.modelUsageCount?.[modelId] || 0;
        const updatedCounts = {
          ...userProfile.modelUsageCount,
          [modelId]: currentCount + 1,
        };
        
        // Update optimistically (don't wait)
        updateUserProfile({ modelUsageCount: updatedCounts }).catch(err => {
          console.error('Erro ao atualizar contador de uso:', err);
          // Don't fail selection because of this
        });
      }
      
      // Normal selection
      setSelectedModel(modelId);
      onSelectModel(modelId);
      onClose();
    }
  };

  const handleConfirmExpensiveModel = () => {
    if (expensiveModelPending) {
      // Increment usage counter
      if (userProfile?.uid) {
        const modelId = expensiveModelPending.id;
        const currentCount = userProfile.modelUsageCount?.[modelId] || 0;
        const updatedCounts = {
          ...userProfile.modelUsageCount,
          [modelId]: currentCount + 1,
        };
        
        updateUserProfile({ modelUsageCount: updatedCounts }).catch(err => {
          console.error('Erro ao atualizar contador de uso:', err);
        });
      }
      
      setSelectedModel(expensiveModelPending.id);
      onSelectModel(expensiveModelPending.id);
      setExpensiveModelPending(null);
      onClose();
    }
  };

  const handleCancelExpensiveModel = () => {
    setExpensiveModelPending(null);
  };

  const handleToggleFavorite = async (modelId: string) => {
    if (favoriteUpdatingId) return;
    if (!userProfile?.uid) {
      alert('Você precisa estar autenticado para favoritar modelos.');
      return;
    }

    const previousFavorites = [...favoriteModels];
    const isFavorite = previousFavorites.includes(modelId);
    const updatedFavorites = isFavorite
      ? previousFavorites.filter((id) => id !== modelId)
      : [...previousFavorites, modelId];

    setFavoriteModels(updatedFavorites);
    setFavoriteUpdatingId(modelId);

    try {
      await updateUserProfile({ favoriteModels: updatedFavorites });
    } catch {
      setFavoriteModels(previousFavorites);
      alert('Erro ao atualizar favoritos. Tente novamente.');
    } finally {
      setFavoriteUpdatingId(null);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing || loading) return;

    try {
      setIsRefreshing(true);
      setError(null);

      // Invalidate cache first
      await invalidateModelsCache();

      // Fetch fresh models from API
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout loading models')), 35000);
      });

      const fetchedModels = await Promise.race([
        fetchAvailableModels(),
        timeoutPromise
      ]);

      const sanitizedModels = fetchedModels.filter(
        (model) => getModelShortName(model.id).toLowerCase() !== 'auto'
      );
      setModels(sanitizedModels);

      // Update native reasoning cache with fresh API data
      updateNativeReasoningCache(sanitizedModels);
    } catch (error) {
      console.error('Error refreshing models:', error);
      setError('Failed to refresh models. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <ExpensiveModelConfirmModal
        isOpen={!!expensiveModelPending}
        onClose={handleCancelExpensiveModel}
        onConfirm={handleConfirmExpensiveModel}
        modelId={expensiveModelPending?.id || ''}
        modelName={expensiveModelPending?.name || ''}
        inputPrice={formatPricing(expensiveModelPending?.pricing.prompt)}
        outputPrice={formatPricing(expensiveModelPending?.pricing.completion)}
      />
      
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-7xl bg-card border border-border rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-foreground">Selecione o modelo</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredModels.length} modelos disponíveis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="p-2 hover:bg-muted rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Refresh models"
              title="Atualizar lista de modelos"
            >
              <RefreshCw className={`w-5 h-5 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors duration-150"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Procure pelo nome, provedor, descrição, ou parâmetros..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-background text-foreground border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200 text-sm"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="mb-3 text-xs text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Results sorted by relevance</span>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap gap-3">
            <div ref={providerDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setProviderOpen((prev) => !prev)}
                className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-xl text-sm font-medium text-foreground hover:border-primary/60 hover:shadow-sm transition-all"
              >
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span>{providerLabels[selectedProvider]}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${providerOpen ? 'rotate-180' : ''}`} />
              </button>
              {providerOpen && (
                <div className="absolute left-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-lg py-1 z-50">
                  {(Object.keys(providerLabels) as ProviderOption[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setSelectedProvider(option);
                        setProviderOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-muted transition-colors ${
                        selectedProvider === option ? 'text-primary font-semibold' : 'text-foreground'
                      }`}
                    >
                      <span>{providerLabels[option]}</span>
                      {selectedProvider === option && <Sparkles className="w-4 h-4 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div ref={sortDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setSortOpen((prev) => !prev)}
                className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-xl text-sm font-medium text-foreground hover:border-primary/60 hover:shadow-sm transition-all"
              >
                <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                <span>{sortLabels[sortOption]}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
              </button>
              {sortOpen && (
                <div className="absolute left-0 mt-2 w-44 bg-card border border-border rounded-xl shadow-lg py-1 z-50">
                  {(Object.keys(sortLabels) as SortOption[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setSortOption(option);
                        setSortOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-muted transition-colors ${
                        sortOption === option ? 'text-primary font-semibold' : 'text-foreground'
                      }`}
                    >
                      <span>{sortLabels[option]}</span>
                      {sortOption === option && <Sparkles className="w-4 h-4 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Models Grid */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-6 py-4"
        >
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Loading models...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center max-w-md">
                <p className="text-sm text-destructive mb-2">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-sm text-primary hover:underline"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : visibleModels.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-muted-foreground">No models found</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {visibleModels.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    isSelected={selectedModel === model.id}
                    isFavorite={favoriteModels.includes(model.id)}
                    onClick={() => handleSelectModel(model.id)}
                    onToggleFavorite={() => handleToggleFavorite(model.id)}
                    favoriteDisabled={favoriteUpdatingId === model.id}
                  />
                ))}
              </div>
              
              {/* Sentinel for infinite scroll */}
              {visibleCount < filteredModels.length && (
                <div ref={sentinelRef} className="py-8 text-center">
                  <Loader2 className="w-6 h-6 text-muted-foreground animate-spin mx-auto" />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

// Model Card Component
interface ModelCardProps {
  model: OpenRouterModel;
  isSelected: boolean;
  isFavorite: boolean;
  onClick: () => void;
  onToggleFavorite: () => void;
  favoriteDisabled?: boolean;
}

function ModelCard({
  model,
  isSelected,
  isFavorite,
  onClick,
  onToggleFavorite,
  favoriteDisabled = false,
}: ModelCardProps) {
  const hasVision = model.architecture.input_modalities.includes('image');
  const isSafe = model.top_provider.is_moderated;
  const contextLength = model.context_length || model.top_provider.context_length;
  const provider = getProviderName(model.id);
  const slug = model.canonical_slug || getModelShortName(model.id);
  const promptPrice = formatPricing(model.pricing.prompt);
  const completionPrice = formatPricing(model.pricing.completion);
  
  // Check if expensive
  const inputPrice = parsePricing(model.pricing.prompt);
  const outputPrice = parsePricing(model.pricing.completion);
  const EXPENSIVE_THRESHOLD = 15;
  const isExpensive = (inputPrice !== null && inputPrice > EXPENSIVE_THRESHOLD) || 
                      (outputPrice !== null && outputPrice > EXPENSIVE_THRESHOLD);

  // Get provider icon
  const getProviderIcon = () => {
    const providerLower = provider.toLowerCase().replace(/\s+/g, '');
    
    if (providerLower.includes('anthropic')) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 92.2 65" fill="currentColor">
          <path d="M66.5,0H52.4l25.7,65h14.1L66.5,0z M25.7,0L0,65h14.4l5.3-13.6h26.9L51.8,65h14.4L40.5,0C40.5,0,25.7,0,25.7,0z M24.3,39.3l8.8-22.8l8.8,22.8H24.3z"/>
        </svg>
      );
    }
    
    if (providerLower.includes('google')) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 65 65" fill="none">
          <mask id="maskme" style={{maskType: 'alpha'}} maskUnits="userSpaceOnUse" x="0" y="0" width="65" height="65">
            <path d="M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z" fill="url(#paint0_linear)"/>
          </mask>
          <g mask="url(#maskme)">
            <path d="M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z" fill="url(#paint0_linear)"/>
          </g>
          <defs>
            <linearGradient id="paint0_linear" x1="18.447" y1="43.42" x2="52.153" y2="15.004" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4893FC"/>
              <stop offset=".27" stopColor="#4893FC"/>
              <stop offset=".777" stopColor="#969DFF"/>
              <stop offset="1" stopColor="#BD99FE"/>
            </linearGradient>
          </defs>
        </svg>
      );
    }
    
    if (providerLower.includes('openai')) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
        </svg>
      );
    }
    
    if (providerLower.includes('meta')) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
          <path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill="url(#meta-gradient-0)"/>
          <path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill="url(#meta-gradient-1)"/>
          <path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill="url(#meta-gradient-2)"/>
          <path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill="url(#meta-gradient-3)"/>
          <path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill="url(#meta-gradient-4)"/>
          <path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill="url(#meta-gradient-5)"/>
          <path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="#0082FB"/>
          <path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill="url(#meta-gradient-6)"/>
          <path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082FB"/>
          <path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill="url(#meta-gradient-7)"/>
          <path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill="url(#meta-gradient-8)"/>
          <path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill="url(#meta-gradient-9)"/>
          <path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill="url(#meta-gradient-10)"/>
          <path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill="url(#meta-gradient-11)"/>
          <path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill="url(#meta-gradient-12)"/>
          <defs>
            <linearGradient id="meta-gradient-0" x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%"><stop offset=".06%" stopColor="#0867DF"/><stop offset="45.39%" stopColor="#0668E1"/><stop offset="85.91%" stopColor="#0064E0"/></linearGradient>
            <linearGradient id="meta-gradient-1" x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%"><stop offset="13.23%" stopColor="#0064DF"/><stop offset="99.88%" stopColor="#0064E0"/></linearGradient>
            <linearGradient id="meta-gradient-2" x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%"><stop offset="1.47%" stopColor="#0072EC"/><stop offset="68.81%" stopColor="#0064DF"/></linearGradient>
            <linearGradient id="meta-gradient-3" x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%"><stop offset="7.31%" stopColor="#007CF6"/><stop offset="99.43%" stopColor="#0072EC"/></linearGradient>
            <linearGradient id="meta-gradient-4" x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%"><stop offset="7.31%" stopColor="#007FF9"/><stop offset="100%" stopColor="#007CF6"/></linearGradient>
            <linearGradient id="meta-gradient-5" x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%"><stop offset="7.31%" stopColor="#007FF9"/><stop offset="100%" stopColor="#0082FB"/></linearGradient>
            <linearGradient id="meta-gradient-6" x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%"><stop offset="27.99%" stopColor="#007FF8"/><stop offset="91.41%" stopColor="#0082FB"/></linearGradient>
            <linearGradient id="meta-gradient-7" x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%"><stop offset="0%" stopColor="#0082FB"/><stop offset="99.95%" stopColor="#0081FA"/></linearGradient>
            <linearGradient id="meta-gradient-8" x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%"><stop offset="6.19%" stopColor="#0081FA"/><stop offset="100%" stopColor="#0080F9"/></linearGradient>
            <linearGradient id="meta-gradient-9" x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%"><stop offset="0%" stopColor="#027AF3"/><stop offset="100%" stopColor="#0080F9"/></linearGradient>
            <linearGradient id="meta-gradient-10" x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%"><stop offset="0%" stopColor="#0377EF"/><stop offset="99.94%" stopColor="#0279F1"/></linearGradient>
            <linearGradient id="meta-gradient-11" x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%"><stop offset=".19%" stopColor="#0471E9"/><stop offset="100%" stopColor="#0377EF"/></linearGradient>
            <linearGradient id="meta-gradient-12" x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%"><stop offset="27.65%" stopColor="#0867DF"/><stop offset="100%" stopColor="#0471E9"/></linearGradient>
          </defs>
        </svg>
      );
    }
    
    if (providerLower.includes('mistral')) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 129 91" fill="none">
          <rect x="18.292" y="0" width="18.293" height="18.123" fill="#ffd800"/>
          <rect x="91.473" y="0" width="18.293" height="18.123" fill="#ffd800"/>
          <rect x="18.292" y="18.121" width="36.586" height="18.123" fill="#ffaf00"/>
          <rect x="73.181" y="18.121" width="36.586" height="18.123" fill="#ffaf00"/>
          <rect x="18.292" y="36.243" width="91.476" height="18.122" fill="#ff8205"/>
          <rect x="18.292" y="54.37" width="18.293" height="18.123" fill="#fa500f"/>
          <rect x="54.883" y="54.37" width="18.293" height="18.123" fill="#fa500f"/>
          <rect x="91.473" y="54.37" width="18.293" height="18.123" fill="#fa500f"/>
          <rect x="0" y="72.504" width="54.89" height="18.123" fill="#e10500"/>
          <rect x="73.181" y="72.504" width="54.89" height="18.123" fill="#e10500"/>
        </svg>
      );
    }
    
    if (providerLower.includes('cohere')) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
        </svg>
      );
    }
    
    if (providerLower.includes('qwen')) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
          <path d="M12.604 1.34c.393.69.784 1.382 1.174 2.075a.18.18 0 00.157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837-.26.43-.513.864-.76 1.3l-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77-.437.785-.882 1.564-1.335 2.34-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 00-.081.05 575.097 575.097 0 01-2.705 4.74c-.169.293-.38.363-.725.364-.997.003-2.002.004-3.017.002a.537.537 0 01-.465-.271l-1.335-2.323a.09.09 0 00-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 01-.002-.54l1.207-2.12a.198.198 0 000-.197 550.951 550.951 0 01-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965.465-.813.927-1.625 1.387-2.436.132-.234.304-.334.584-.335a338.3 338.3 0 012.589-.001.124.124 0 00.107-.063l2.806-4.895a.488.488 0 01.422-.246c.524-.001 1.053 0 1.583-.006L11.704 1c.341-.003.724.032.9.34zm-3.432.403a.06.06 0 00-.052.03L6.254 6.788a.157.157 0 01-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 00-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 01.096 0l1.424 2.53a.122.122 0 00.107.062l2.763-.02a.04.04 0 00.035-.02.041.041 0 000-.04l-2.9-5.086a.108.108 0 010-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 000-.114L9.225 1.774a.06.06 0 00-.053-.031zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 01-.05.029.058.058 0 01-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012z" fill="url(#qwen-gradient)" fillRule="nonzero"/>
          <defs>
            <linearGradient id="qwen-gradient" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#6336E7" stopOpacity=".84"/>
              <stop offset="100%" stopColor="#6F69F7" stopOpacity=".84"/>
            </linearGradient>
          </defs>
        </svg>
      );
    }
    
    if (providerLower.includes('perplexity')) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      );
    }
    
    if (providerLower.includes('xai') || providerLower.includes('x-ai')) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd">
          <path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"/>
        </svg>
      );
    }
    
    // Default icon for unknown providers
    return <Sparkles className="w-5 h-5" />;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`group relative flex flex-col p-4 text-left border-2 rounded-xl transition-all duration-200 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        isSelected
          ? 'border-primary bg-primary/5 shadow-md'
          : 'border-border hover:border-primary/40 bg-card'
      }`}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <ChevronRight className="w-3 h-3 text-primary-foreground" />
          </div>
        </div>
      )}

      {/* Favorite toggle - bottom right */}
      <div className="absolute bottom-3 right-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (!favoriteDisabled) {
              onToggleFavorite();
            }
          }}
          className={`p-1 rounded-full transition-colors duration-150 ${
            isFavorite ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:text-primary'
          } ${favoriteDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/10'}`}
          aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          disabled={favoriteDisabled}
        >
          <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/20 text-primary">
          {getProviderIcon()}
        </div>

        {/* Title and badges */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">
            {model.name}
          </h3>
          <p className="text-xs text-muted-foreground truncate">
            {slug}
          </p>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">{provider}</span>
            {isExpensive && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-warning/10 text-warning text-xs rounded border border-warning/20 font-semibold">
                <DollarSign className="w-3 h-3" />
                Caro
              </span>
            )}
            {hasVision && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded border border-primary/20">
                <Eye className="w-3 h-3" />
                Vision
              </span>
            )}
            {isSafe && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 text-success text-xs rounded border border-green-500/20">
                <ShieldCheck className="w-3 h-3" />
                Safe
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
        {model.description || 'No description available'}
      </p>

      {/* Footer with pricing and context */}
      <div className="flex items-center justify-between text-xs pt-3 border-t border-border">
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-primary">Input {promptPrice}</span>
          <span className="text-muted-foreground">Output {completionPrice}</span>
        </div>
        {contextLength && (
          <span className="text-muted-foreground">
            {contextLength >= 1000000
              ? `${(contextLength / 1000000).toFixed(1)}M`
              : `${(contextLength / 1000).toFixed(0)}K`}{' '}
            tokens
          </span>
        )}
      </div>

      {/* Supported parameters count */}
      {model.supported_parameters && model.supported_parameters.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {model.supported_parameters.slice(0, 5).map((param) => (
            <span
              key={param}
              className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] rounded"
            >
              {param}
            </span>
          ))}
          {model.supported_parameters.length > 5 && (
            <span className="px-1.5 py-0.5 text-muted-foreground text-[10px]">
              +{model.supported_parameters.length - 5}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
