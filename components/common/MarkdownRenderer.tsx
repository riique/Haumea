'use client';

import { memo, Children, isValidElement, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './CodeBlock';
import { ChemBlock } from './ChemBlock';
import { GraphBlock } from './GraphBlock';
import 'katex/dist/katex.min.css';
// Syntax highlighting styles now defined in globals.css for dual theme support

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Pre-process text to fix \text{R\$ } patterns BEFORE LaTeX parsing
const fixTextCurrencyPatterns = (text: string): string => {
  // The dollar sign $ is a special character in LaTeX (math mode delimiter)
  // Inside \text{}, we need to be careful with escaping
  // Strategy: Replace R\$ with just R or "reais" to avoid parsing issues
  let fixed = text;
  
  // Handle \text{R\$/something} - replace with descriptive text
  // Example: \text{R\$/J} becomes \text{reais/J}
  fixed = fixed.replace(/\\text\{R\\\$\/([^}]+)\}/g, '\\text{reais/$1}');
  
  // Handle \text{R\$ } or \text{R $} with trailing space - replace with "reais"
  fixed = fixed.replace(/\\text\{R\s*\\\$\s*\}/g, '\\text{reais}\\,');
  
  // Handle \text{R\$} alone without space - replace with "reais"
  fixed = fixed.replace(/\\text\{R\\\$\}/g, '\\text{reais}');
  
  return fixed;
};

const normalizeMathTextContent = (text: string): string => {
  const processMath = (content: string): string => {
    let fixed = content;

    // Normalize individual \text{...} segments
    fixed = fixed.replace(/\\text\{([^}]*)\}/g, (match: string, rawInner: string): string => {
      let inner = rawInner.replace(/\s+/g, ' ').trim();

      // Convert escaped spaces ("\\ ") to plain spaces for easier parsing
      inner = inner.replace(/\\\s+/g, ' ');
      
      // Remove escaped dollar signs for easier pattern matching
      inner = inner.replace(/\\\$/g, '');

      // Separate numbers and letters that got glued together (e.g., "por1")
      inner = inner.replace(/(\d)([A-Za-z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2');

      // Match currency patterns: "R$", "R $", "R", followed optionally by numbers
      const currencyMatch = inner.match(/^R\s*([0-9.,]+)(.*)$/i);
      if (currencyMatch) {
        const amount = currencyMatch[1].trim();
        const rest = currencyMatch[2].trim();
        const restPart = rest.length > 0 ? ` ${rest}` : '';
        return `\\text{${amount} reais${restPart}}`;
      }

      // Just "R$" or "R" alone
      if (/^R\s*$/i.test(inner)) {
        return '\\text{reais}';
      }

      return `\\text{${inner}}`;
    });

    // Convert standalone currency markers like R$0,80 (outside \text{})
    fixed = fixed.replace(/R\\\$\s*([0-9][0-9.,]*)/g, (_match: string, amount: string) => `${amount} \\text{ reais}`);
    fixed = fixed.replace(/R\$\s*([0-9][0-9.,]*)/g, (_match: string, amount: string) => `${amount} \\text{ reais}`);

    // Merge patterns like \text{reais}0{,}80 into \text{0{,}80 reais}
    fixed = fixed.replace(/\\text\{reais\}\s*([0-9][0-9\{\},.]*)/g, (_match: string, amount: string) => `\\text{${amount} reais}`);
    
    // Handle \text{R\$ } or \text{R $ } followed by numbers
    fixed = fixed.replace(/\\text\{R\s*\}\s*([0-9][0-9\{\},.]*)/gi, (_match: string, amount: string) => `\\text{${amount} reais}`);
    
    return fixed;
  };

  const normalizeDisplay = text.replace(/\$\$([\s\S]*?)\$\$/g, (match: string, mathContent: string): string => `$$${processMath(mathContent)}$$`);
  return normalizeDisplay.replace(/\$(?!\$)((?:[^$]|\\\$)+?)\$/g, (match: string, mathContent: string): string => `$${processMath(mathContent)}$`);
};

// Fix common LaTeX errors with unescaped dollar signs
const fixUnescapedDollarSigns = (text: string): string => {
  // Strategy: Fix only clearly wrong patterns where R$ or standalone $ appears 
  // inside math environments without proper escaping
  
  // Process display math $$...$$ first
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, content) => {
    let fixed = content;
    
    // Fix R$ patterns (check if not already escaped)
    if (!fixed.includes('R\\$')) {
      fixed = fixed.replace(/R\$/g, 'R\\$');
    }
    
    return `$$${fixed}$$`;
  });
  
  // Process inline math $...$ 
  // Use a more careful regex that won't match $$ delimiters
  text = text.replace(/\$(?!\$)((?:[^$]|\\\$)+?)\$/g, (match, content) => {
    let fixed = content;
    
    // Fix R$ patterns (check if not already escaped)
    if (!fixed.includes('R\\$')) {
      fixed = fixed.replace(/R\$/g, 'R\\$');
    }
    
    return `$${fixed}$`;
  });
  
  return text;
};

// Convert Unicode math symbols to LaTeX within math delimiters
const convertUnicodeMathToLatex = (text: string): string => {
  const convertMath = (content: string): string => {
    return content
      // Superscripts
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/⁰/g, '^0')
      .replace(/¹/g, '^1')
      .replace(/⁴/g, '^4')
      .replace(/⁵/g, '^5')
      .replace(/⁶/g, '^6')
      .replace(/⁷/g, '^7')
      .replace(/⁸/g, '^8')
      .replace(/⁹/g, '^9')
      // Greek letters
      .replace(/α/g, '\\alpha')
      .replace(/β/g, '\\beta')
      .replace(/γ/g, '\\gamma')
      .replace(/δ/g, '\\delta')
      .replace(/ε/g, '\\epsilon')
      .replace(/θ/g, '\\theta')
      .replace(/λ/g, '\\lambda')
      .replace(/μ/g, '\\mu')
      .replace(/ν/g, '\\nu')
      .replace(/π/g, '\\pi')
      .replace(/ρ/g, '\\rho')
      .replace(/σ/g, '\\sigma')
      .replace(/τ/g, '\\tau')
      .replace(/φ/g, '\\phi')
      .replace(/ω/g, '\\omega')
      .replace(/Γ/g, '\\Gamma')
      .replace(/Δ/g, '\\Delta')
      .replace(/Θ/g, '\\Theta')
      .replace(/Λ/g, '\\Lambda')
      .replace(/Π/g, '\\Pi')
      .replace(/Σ/g, '\\Sigma')
      .replace(/Φ/g, '\\Phi')
      .replace(/Ω/g, '\\Omega')
      // Math operators
      .replace(/∑/g, '\\sum')
      .replace(/∫/g, '\\int')
      .replace(/∂/g, '\\partial')
      .replace(/∇/g, '\\nabla')
      .replace(/√/g, '\\sqrt')
      .replace(/∞/g, '\\infty')
      .replace(/±/g, '\\pm')
      .replace(/×/g, '\\times')
      .replace(/÷/g, '\\div')
      .replace(/≠/g, '\\neq')
      .replace(/≈/g, '\\approx')
      .replace(/≤/g, '\\leq')
      .replace(/≥/g, '\\geq')
      .replace(/→/g, '\\to')
      .replace(/←/g, '\\leftarrow')
      .replace(/↔/g, '\\leftrightarrow')
      .replace(/⇒/g, '\\Rightarrow')
      .replace(/∈/g, '\\in')
      .replace(/∉/g, '\\notin')
      .replace(/⊂/g, '\\subset')
      .replace(/⊃/g, '\\supset')
      .replace(/∀/g, '\\forall')
      .replace(/∃/g, '\\exists')
      .replace(/∧/g, '\\land')
      .replace(/∨/g, '\\lor')
      .replace(/¬/g, '\\neg');
  };
  
  // Process both inline $...$ and display $$...$$ math
  return text
    .replace(/\$\$([\s\S]*?)\$\$/g, (match, content) => `$$${convertMath(content)}$$`)
    .replace(/\$([^\$]+)\$/g, (match, content) => `$${convertMath(content)}$`);
};

// Remove zero-width characters and normalize Unicode
const sanitizeUnicodeAndZeroWidth = (text: string): string => {
  if (!text) return '';
  return text
    .normalize('NFC')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    // Normalize smart quotes to regular quotes
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"');
};

// Normalize malformed single-backtick code fences for multi-line code
const normalizeMalformedCodeBlocks = (text: string): string => {
  if (!text) return '';

  // Pattern 1: Specific SMILES pattern - most common case
  // Matches: `smiles\nCC(=O)C\n` or variations
  const smilesPattern = /`smiles\s*\n([\s\S]+?)\n\s*`/gi;
  let normalized = text.replace(smilesPattern, (match, smilesCode) => {
    const trimmedCode = smilesCode.trim();
    return `\n\n\`\`\`smiles\n${trimmedCode}\n\`\`\`\n\n`;
  });

  // Pattern 2: Multi-line code with language identifier (general case)
  // Matches: `language\ncode\n` or `language\ncode`
  const multiLinePattern = /(^|\n)`([a-zA-Z0-9+#_.-]+)\n([\s\S]*?)(?:\n)?`(?=\s*(\n|$))/g;
  normalized = normalized.replace(multiLinePattern, (fullMatch, prefix: string, language: string, body: string) => {
    // Ignore if the body already contains a proper code fence to avoid double wrapping
    if (body.includes('```') || fullMatch.includes('```')) {
      return fullMatch;
    }

    const trimmedBody = body.replace(/\s+$/g, '');
    const fence = `\n\n\u0060\u0060\u0060${language}\n${trimmedBody}\n\u0060\u0060\u0060\n`;
    return `${prefix}${fence}`;
  });

  // Pattern 3: Inline SMILES with spaces (fallback)
  // Matches: `smiles CC(=O)C` (single line with space instead of newline)
  const inlineSmilesPattern = /`smiles\s+([A-Z\[\]()=#@\+\-\d\/\\cnosp]+)`/gi;
  normalized = normalized.replace(inlineSmilesPattern, (match, smilesCode) => {
    // Skip if already converted
    if (match.includes('```')) {
      return match;
    }
    return `\n\`\`\`smiles\n${smilesCode.trim()}\n\`\`\`\n`;
  });

  return normalized;
};

// Normalize display math blocks to be on their own lines
const normalizeDisplayMathBlocks = (text: string): string => {
  // Avoid touching code blocks
  const segments = text.split(/```([\s\S]*?)```/g);
  for (let i = 0; i < segments.length; i += 2) {
    // Only parts outside code blocks
    segments[i] = segments[i]
      // Ensure line breaks before and after $$ ... $$
      .replace(/\s*\$\$([\s\S]*?)\$\$\s*/g, (m, inner) => `\n\n$$\n${inner.trim()}\n$$\n\n`);
  }
  // Reassemble preserving code blocks
  let rebuilt = '';
  for (let i = 0; i < segments.length; i++) {
    rebuilt += segments[i];
    if (i + 1 < segments.length) {
      rebuilt += '```' + segments[i + 1] + '```';
      i += 1;
    }
  }
  return rebuilt;
};

// Merge standalone inline math with neighboring text paragraphs
const mergeStandaloneInlineMath = (text: string): string => {
  const splitByCode = text.split(/```([\s\S]*?)```/g);
  for (let i = 0; i < splitByCode.length; i += 2) {
    const block = splitByCode[i];
    const paragraphs = block.split(/\n\s*\n/g);
    const result: string[] = [];

    let idx = 0;
    while (idx < paragraphs.length) {
      const current = paragraphs[idx].trim();
      const isInlineMathOnly = /^\$(?!\$)[\s\S]*?\$(?!\$)$/.test(current);

      if (isInlineMathOnly) {
        const math = current;
        const hasPrev = result.length > 0 && result[result.length - 1].trim().length > 0;
        const next = paragraphs[idx + 1] ?? '';
        const hasNext = next.trim().length > 0;

        if (hasPrev && hasNext) {
          // Merge with previous and next
          const prev = result.pop() as string;
          result.push(prev.replace(/\s*$/, ' ') + math + ' ' + next.trim());
          idx += 2; // consumed next as well
          continue;
        }
        if (hasPrev && !hasNext) {
          const prev = result.pop() as string;
          result.push(prev.replace(/\s*$/, ' ') + math);
          idx += 1;
          continue;
        }
        if (!hasPrev && hasNext) {
          result.push(math + ' ' + next.trim());
          idx += 2;
          continue;
        }
        // no neighbors (isolated paragraph) just keep it
        result.push(current);
        idx += 1;
        continue;
      }

      result.push(paragraphs[idx]);
      idx += 1;
    }

    splitByCode[i] = result.join('\n\n');
  }

  // Rebuild preserving code blocks
  let rebuilt = '';
  for (let i = 0; i < splitByCode.length; i++) {
    rebuilt += splitByCode[i];
    if (i + 1 < splitByCode.length) {
      rebuilt += '```' + splitByCode[i + 1] + '```';
      i += 1;
    }
  }
  return rebuilt;
};

// Convert small generic code blocks to inline code
const convertSmallCodeBlocksToInline = (text: string): string => {
  // Match code blocks with various formats:
  // ```language
  // content
  // ```
  // or
  // ```
  // content
  // ```
  return text.replace(/```(text|txt|plain|test|TEST|TEXT)?\s*\n([^\n]+?)\n```/gi, (match, language, content) => {
    const trimmedContent = content.trim();
    
    // Convert to inline code if:
    // 1. Single line (no newlines in content - already enforced by [^\n]+)
    // 2. Short (less than 100 chars)
    // 3. Generic language or no language specified
    const isShort = trimmedContent.length > 0 && trimmedContent.length < 100;
    const isGenericOrEmpty = !language || ['text', 'txt', 'plain', 'test', 'TEST', 'TEXT'].includes(language);
    
    if (isShort && isGenericOrEmpty) {
      return `\`${trimmedContent}\``;
    }
    
    // Keep as block if doesn't meet criteria
    return match;
  });
};

/**
 * MarkdownRenderer com Memoização
 * 
 * Otimização: Apenas re-renderiza se content ou className mudarem
 */
const extractTextContent = (node: ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractTextContent).join('');
  }

  if (isValidElement(node)) {
    return extractTextContent((node.props as { children?: ReactNode } | undefined)?.children ?? '');
  }

  return '';
};

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Preprocess content for LaTeX rendering and code block optimization
  const prepared = mergeStandaloneInlineMath(
    normalizeDisplayMathBlocks(
      convertSmallCodeBlocksToInline(
        fixUnescapedDollarSigns(
          normalizeMathTextContent(
            convertUnicodeMathToLatex(
              normalizeMalformedCodeBlocks(
                fixTextCurrencyPatterns(
                  sanitizeUnicodeAndZeroWidth(content)
                )
              )
            )
          )
        )
      )
    )
  );

  // Error callback to log KaTeX rendering failures
  const handleKatexError = (error: Error, errorCode: string, latex: string) => {
    // Simplified error logging - only in development
    if (process.env.NODE_ENV === 'development') {
      console.error('LaTeX Rendering Error:', error.message, '| Content:', latex.substring(0, 50));
    }
  };

  return (
    <div className={`markdown-body break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[
          [rehypeKatex, { 
            strict: false, 
            throwOnError: false, 
            trust: true,
            errorColor: '#cc0000',
            output: 'html',
            macros: {
              "\\det": "\\operatorname{det}",
              "\\tr": "\\operatorname{tr}"
            },
            errorCallback: handleKatexError
          }],
          [rehypeHighlight, { detect: true, ignoreMissing: true }]
        ]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-foreground mt-6 mb-4 pb-2 border-b border-border first:mt-0 break-words">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-foreground mt-5 mb-3 pb-1.5 border-b border-border/50 break-words">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2 break-words">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold text-foreground mt-3 mb-2 break-words">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-semibold text-foreground mt-2 mb-1.5 break-words">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-sm font-medium text-muted-foreground mt-2 mb-1.5 break-words">
              {children}
            </h6>
          ),

          // Paragraph
          p: ({ children }) => (
            <p className="text-foreground leading-7 mb-4 last:mb-0 break-words">
              {children}
            </p>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-outside space-y-2 mb-4 ml-6 text-foreground break-words">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside space-y-2 mb-4 ml-6 text-foreground break-words">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-7 pl-2 break-words">
              {children}
            </li>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors duration-150 break-all"
            >
              {children}
            </a>
          ),

          // Code
          code: ({ inline, className, children, ...props }: React.ComponentProps<'code'> & {
            inline?: boolean;
          }) => {
            const codeNodes = Children.toArray(children);
            const codeString = codeNodes.map(extractTextContent).join('').replace(/\n$/, '');
            
            // Extract language from className
            const languageMatch = className?.match(/(?:^|\s)language-([a-zA-Z0-9+#_.-]+)/);
            const language = languageMatch?.[1]?.toLowerCase() || '';
            
            // Determine if this is truly inline code:
            // 1. Explicitly marked as inline
            // 2. No className (i.e., not a fenced code block with language)
            // 3. Generic language (text, txt, plain, test) AND short single-line content
            const genericLanguages = ['text', 'txt', 'plain', 'test', ''];
            const isSingleLine = !codeString.includes('\n');
            const isShort = codeString.length < 100;
            const isGenericLanguage = genericLanguages.includes(language);

            const isInlineCode =
              inline ||
              !className ||
              (isGenericLanguage && isSingleLine && isShort);
            
            if (isInlineCode) {
              return (
                <code
                  className="px-1.5 py-0.5 bg-muted text-foreground rounded text-sm font-mono border border-border break-all"
                  {...props}
                >
                  {codeNodes}
                </code>
              );
            }
            
            // Check if this is a SMILES chemical structure block
            if (language === 'smiles') {
              return <ChemBlock smiles={codeString} className="my-4" />;
            }
            
            // Check if this is a graph block
            if (language === 'graph') {
              return <GraphBlock graphData={codeString} className="my-4" />;
            }
            
            // This is a true code block
            return (
              <CodeBlock className={className} language={language || className?.replace(/language-/, '')}>
                {children}
              </CodeBlock>
            );
          },

          pre: ({ children }: { children?: React.ReactNode }) => {
            // When code block is detected, just return children (CodeBlock handles its own pre)
            return <>{children}</>;
          },

          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary pl-4 py-2 my-4 bg-primary/5 text-foreground italic break-words">
              {children}
            </blockquote>
          ),

          // Table
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-border">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-muted/50 transition-colors duration-150">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-sm font-semibold text-foreground border border-border">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-sm text-foreground border border-border">
              {children}
            </td>
          ),

          // Horizontal Rule
          hr: () => (
            <hr className="my-6 border-t border-border" />
          ),

          // Images
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt}
              className="max-w-full h-auto rounded-lg border border-border my-4 shadow-sm"
            />
          ),

          // Strong and Em
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground">
              {children}
            </em>
          ),

          // Strikethrough (from remark-gfm)
          del: ({ children }) => (
            <del className="line-through text-muted-foreground">
              {children}
            </del>
          ),
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: apenas re-renderizar se content ou className mudarem
  return prevProps.content === nextProps.content && prevProps.className === nextProps.className;
});
