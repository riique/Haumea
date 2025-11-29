'use client';

import { useState, ReactNode, isValidElement } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  children: ReactNode;
  className?: string;
  language?: string;
}

const extractTextContent = (node: ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractTextContent).join('');
  }

  if (isValidElement(node)) {
    const childProps = node.props as { children?: ReactNode } | undefined;
    return extractTextContent(childProps?.children ?? '');
  }

  return '';
};

export function CodeBlock({ children, className = '', language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const codeText = extractTextContent(children);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silent fail
    }
  };

  // Extract language from className (format: "language-typescript")
  const lang = language || className?.replace(/language-/, '') || 'text';

  return (
    <div className="relative group my-4">
      {/* Language badge and copy button container */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted border border-border border-b-0 rounded-t-lg">
        <span className="text-xs font-mono font-semibold text-muted-foreground uppercase">
          {lang}
        </span>
        <button
          onClick={handleCopy}
          type="button"
          className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-all duration-150 border border-border bg-background hover:bg-muted ${
            copied ? 'text-success border-success' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label={copied ? 'Código copiado' : 'Copiar código'}
          title={copied ? 'Copiado!' : 'Copiar código'}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-success" />
              <span className="text-success">Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <pre className="!mt-0 overflow-x-auto">
        <code className={`${className} block p-4 bg-muted rounded-b-lg text-sm font-mono border border-border border-t-0`}>
          {children}
        </code>
      </pre>
    </div>
  );
}
