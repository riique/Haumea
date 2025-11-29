'use client';

import { useState } from 'react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';

interface ReasoningBlockProps {
  reasoning: string;
  model?: string;
}

export function ReasoningBlock({ reasoning, model }: ReasoningBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!reasoning || reasoning.trim().length === 0) {
    return null;
  }

  // Determine provider for display
  const provider = model?.split('/')[0]?.toLowerCase() || 'ai';
  const isOpenAI = provider === 'openai';
  
  // Format reasoning label based on provider
  const reasoningLabel = isOpenAI 
    ? 'Reasoning Effort' 
    : 'Reasoning Tokens';

  return (
    <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-primary/10 transition-colors duration-150"
      >
        <div className="flex items-center gap-2 flex-1">
          <div className="p-1.5 rounded-md bg-primary/20">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">{reasoningLabel}</p>
            <p className="text-xs text-muted-foreground">
              {isExpanded ? 'Clique para ocultar' : 'Clique para ver o raciocínio'}
            </p>
          </div>
        </div>
        <div className="text-primary">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 py-3 border-t border-primary/20 bg-background/50">
          <pre className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed font-mono bg-muted/30 p-3 rounded-lg border border-border overflow-x-auto max-w-none">
            {reasoning}
          </pre>
        </div>
      )}
    </div>
  );
}
