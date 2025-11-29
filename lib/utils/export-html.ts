import { Message } from '@/types/chat';
import katex from 'katex';

/**
 * Normaliza Unicode removendo caracteres de largura zero
 */
function normalizeUnicode(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width chars
}

/**
 * Converte acentos LaTeX para Unicode
 */
function convertLatexAccents(text: string): string {
  // CORREÇÃO: Objeto reescrito com sintaxe validada para evitar erros de compilação.
  const accentMap: Record<string, string> = {
    '\\\'a': 'á', '\\\'e': 'é', '\\\'i': 'í', '\\\'o': 'ó', '\\\'u': 'ú',
    '\\"a': 'ä', '\\"e': 'ë', '\\"i': 'ï', '\\"o': 'ö', '\\"u': 'ü',
    '\\^a': 'â', '\\^e': 'ê', '\\^i': 'î', '\\^o': 'ô', '\\^u': 'û',
    '\\`a': 'à', '\\`e': 'è', '\\`i': 'ì', '\\`o': 'ò', '\\`u': 'ù',
    '\\~a': 'ã', '\\~o': 'õ', '\\~n': 'ñ',
    '\\c{c}': 'ç', '\\c{C}': 'Ç',
  };

  let result = text;
  for (const [latex, unicode] of Object.entries(accentMap)) {
    result = result.replace(new RegExp(latex.replace(/\\/g, '\\\\'), 'g'), unicode);
  }
  return result;
}

/**
 * Tokeniza expressões LaTeX para protegê-las durante processamento Markdown
 */
function tokenizeLaTeX(content: string): { text: string; tokens: Map<string, string> } {
  const tokens = new Map<string, string>();
  let tokenCounter = 0;
  let text = content;

  // Proteger blocos display $$...$$
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
    const token = `HAUMEATOKEN_BLOCK_${tokenCounter++}_HAUMEA`;
    tokens.set(token, match);
    return token;
  });

  // Proteger blocos \[...\]
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (match) => {
    const token = `HAUMEATOKEN_BLOCK_${tokenCounter++}_HAUMEA`;
    tokens.set(token, match);
    return token;
  });

  // Proteger inline $...$
  text = text.replace(/\$([^\$\n]+?)\$/g, (match) => {
    const token = `HAUMEATOKEN_INLINE_${tokenCounter++}_HAUMEA`;
    tokens.set(token, match);
    return token;
  });

  // Proteger \(...\)
  text = text.replace(/\\\(([^\)]+?)\\\)/g, (match) => {
    const token = `HAUMEATOKEN_INLINE_${tokenCounter++}_HAUMEA`;
    tokens.set(token, match);
    return token;
  });

  return { text, tokens };
}

/**
 * Renderiza expressões LaTeX usando KaTeX
 */
function renderLaTeX(content: string): string {
  let result = content;

  // Renderizar blocos display $$...$$
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (match, latex) => {
    try {
      const html = katex.renderToString(latex.trim(), {
        displayMode: true,
        throwOnError: false,
        output: 'html',
      });
      return `<div class="math-display">${html}</div>`;
    } catch {
      return `<div class="latex-error">Erro LaTeX: ${match}</div>`;
    }
  });

  // Renderizar blocos \[...\]
  result = result.replace(/\\\[([\s\S]+?)\\\]/g, (match, latex) => {
    try {
      const html = katex.renderToString(latex.trim(), {
        displayMode: true,
        throwOnError: false,
        output: 'html',
      });
      return `<div class="math-display">${html}</div>`;
    } catch {
      return `<div class="latex-error">Erro LaTeX: ${match}</div>`;
    }
  });

  // Renderizar inline $...$
  result = result.replace(/\$([^\$\n]+?)\$/g, (match, latex) => {
    try {
      const html = katex.renderToString(latex.trim(), {
        displayMode: false,
        throwOnError: false,
        output: 'html',
      });
      return `<span class="math-inline">${html}</span>`;
    } catch {
      return `<span class="latex-error">${match}</span>`;
    }
  });

  // Renderizar \(...\)
  result = result.replace(/\\\(([^\)]+?)\\\)/g, (match, latex) => {
    try {
      const html = katex.renderToString(latex.trim(), {
        displayMode: false,
        throwOnError: false,
        output: 'html',
      });
      return `<span class="math-inline">${html}</span>`;
    } catch {
      return `<span class="latex-error">${match}</span>`;
    }
  });

  return result;
}

/**
 * Renderiza estruturas químicas SMILES usando OpenChemLib
 */
async function renderSMILES(content: string): Promise<string> {
  let result = content;

  // Detectar blocos SMILES (```smiles\n...\n```)
  const smilesBlockRegex = /```smiles\n([\s\S]*?)\n```/g;
  const matches = Array.from(content.matchAll(smilesBlockRegex));

  if (matches.length === 0) {
    return result;
  }

  try {
    const OCL = await import('openchemlib');

    for (const match of matches) {
      const fullMatch = match[0];
      const smilesCode = match[1].trim();

      try {
        const molecule = OCL.Molecule.fromSmiles(smilesCode);
        
        if (!molecule || molecule.getAllAtoms() === 0) {
          throw new Error('SMILES inválido');
        }

        const formula = molecule.getMolecularFormula().formula;
        const weight = molecule.getMolecularFormula().absoluteWeight.toFixed(2);
        const svg = molecule.toSVG(400, 300, undefined, {
          autoCrop: true,
          autoCropMargin: 20,
          suppressChiralText: false,
          suppressESR: false,
          suppressCIPParity: false,
          noStereoProblem: false,
        });

        const html = `
          <div class="chem-display">
            <div class="chem-header">
              <strong>Estrutura Molecular</strong>
              <span class="chem-info">Fórmula: ${formula} | Peso: ${weight} g/mol</span>
            </div>
            <div class="chem-structure">
              ${svg}
            </div>
            <details class="chem-details">
              <summary>Ver SMILES</summary>
              <code>${smilesCode}</code>
            </details>
          </div>
        `;

        result = result.replace(fullMatch, html);
      } catch (error) {
        const errorHtml = `
          <div class="chem-error">
            <strong>Erro ao renderizar estrutura química</strong>
            <p>${error instanceof Error ? error.message : 'Erro desconhecido'}</p>
            <pre><code>${smilesCode}</code></pre>
          </div>
        `;
        result = result.replace(fullMatch, errorHtml);
      }
    }

    return result;
  } catch (importError) {
    console.error('Erro ao importar OpenChemLib:', importError);
    return result;
  }
}

/**
 * Restaura tokens LaTeX protegidos
 */
function restoreTokens(text: string, tokens: Map<string, string>): string {
  let result = text;
  for (const [token, original] of tokens.entries()) {
    // Usar replace global para garantir que todos os tokens sejam substituídos
    const regex = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    result = result.replace(regex, original);
  }
  return result;
}

/**
 * Processa conteúdo de mensagem: LaTeX + Markdown + Sanitização
 */
export async function processMessageContent(content: string): Promise<string> {
  // 1. Normalizar Unicode
  let processed = normalizeUnicode(content);

  // 2. Converter acentos LaTeX
  processed = convertLatexAccents(processed);

  // 3. Tokenizar LaTeX
  const { text: withTokens, tokens } = tokenizeLaTeX(processed);

  // 4. Processar Markdown (usando marked - será importado dinamicamente)
  const { marked } = await import('marked');
  
  // Configurar marked para não processar HTML
  marked.setOptions({
    breaks: true,
    gfm: true,
  });
  
  let markdownHtml = await marked(withTokens);

  // 5. Restaurar tokens LaTeX
  markdownHtml = restoreTokens(markdownHtml, tokens);

  // 6. Renderizar LaTeX
  const latexRendered = renderLaTeX(markdownHtml);

  // 7. Renderizar SMILES (estruturas químicas)
  const smilesRendered = await renderSMILES(latexRendered);

  // 8. Sanitizar HTML (usando DOMPurify - será importado dinamicamente)
  const DOMPurify = (await import('dompurify')).default;
  const sanitized = DOMPurify.sanitize(smilesRendered, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'strong', 'em', 'u', 's',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'table', 'thead',
      'tbody', 'tr', 'th', 'td', 'div', 'span', 'details', 'summary', 'svg', 'path',
      'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'g', 'defs',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'aria-hidden', 
      'viewBox', 'xmlns', 'width', 'height', 'd', 'fill', 'stroke', 'stroke-width',
      'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'points',
      'font-family', 'font-size', 'text-anchor', 'transform'],
  });

  return sanitized;
}

/**
 * Gera HTML completo com estilos e scripts
 */
export function generateHTML(chatName: string, messages: Message[]): string {
  const messageCount = messages.length;
  const exportDate = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${chatName} - Haumea Chat Export</title>
  
  <!-- KaTeX CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
  
  <!-- Highlight.js CSS (GitHub Dark theme) -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  
  <!-- Highlight.js JS for syntax highlighting -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  
  <!-- Libraries for PDF Export -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --bg-primary: #0a0a0f;
      --bg-secondary: #13131a;
      --bg-tertiary: #1a1a24;
      --text-primary: #e4e4e7;
      --text-secondary: #a1a1aa;
      --border-color: #27272a;
      --user-bg: #14532d;
      --user-border: #16a34a;
      --ai-bg: #1e3a8a;
      --ai-border: #3b82f6;
      --accent: #8b5cf6;
    }

    body {
      background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
      color: var(--text-primary);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      min-height: 100vh;
      padding: 2rem 1rem;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
    }

    /* Floating Toolbar */
    .toolbar {
      position: fixed;
      top: 2rem;
      right: 2rem;
      z-index: 1000;
      background: rgba(26, 26, 36, 0.95);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 0.75rem 1.25rem;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    }

    .btn-pdf {
      background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-pdf:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4);
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 2.5rem 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }

    h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 1rem;
      background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .meta {
      display: flex;
      gap: 2rem;
      flex-wrap: wrap;
      color: var(--text-secondary);
      font-size: 0.95rem;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Messages */
    .messages {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .message {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.75rem;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .message:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }

    .message.user {
      border-left: 4px solid var(--user-border);
      background: linear-gradient(135deg, rgba(20, 83, 45, 0.2) 0%, var(--bg-tertiary) 100%);
    }

    .message.assistant {
      border-left: 4px solid var(--ai-border);
      background: linear-gradient(135deg, rgba(30, 58, 138, 0.2) 0%, var(--bg-tertiary) 100%);
    }

    .message-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border-color);
    }

    .message-role {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 600;
      font-size: 1.05rem;
    }

    .role-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }

    .user .role-icon {
      background: var(--user-bg);
    }

    .assistant .role-icon {
      background: var(--ai-bg);
    }

    .timestamp {
      color: var(--text-secondary);
      font-size: 0.85rem;
    }

    .message-content {
      color: var(--text-primary);
      font-size: 1rem;
      line-height: 1.7;
    }

    /* Typography */
    .message-content h1,
    .message-content h2,
    .message-content h3,
    .message-content h4 {
      margin: 1.5rem 0 1rem 0;
      font-weight: 600;
      color: var(--text-primary);
    }

    .message-content h1 { font-size: 2rem; }
    .message-content h2 { font-size: 1.75rem; }
    .message-content h3 { font-size: 1.5rem; }
    .message-content h4 { font-size: 1.25rem; }

    .message-content p {
      margin-bottom: 1rem;
    }

    .message-content ul,
    .message-content ol {
      margin: 1rem 0 1rem 2rem;
    }

    .message-content li {
      margin: 0.5rem 0;
    }

    .message-content blockquote {
      border-left: 4px solid var(--accent);
      padding-left: 1.5rem;
      margin: 1.5rem 0;
      color: var(--text-secondary);
      font-style: italic;
    }

    /* Inline Code - Replicando do site */
    .message-content code:not(pre code) {
      padding: 0.125rem 0.375rem;
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border-radius: 4px;
      font-size: 0.875rem;
      font-family: 'Fira Code', 'Monaco', 'Courier New', monospace;
      border: 1px solid var(--border-color);
    }

    /* Code Blocks - Replicando do site */
    .message-content pre {
      background: #0d1117;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
      margin: 1.5rem 0;
      position: relative;
    }

    .message-content pre code {
      background: transparent;
      padding: 0;
      border: none;
      color: #e6edf3;
      font-size: 0.875rem;
      line-height: 1.6;
      font-family: 'Fira Code', 'Monaco', 'Courier New', monospace;
      display: block;
    }

    /* Scrollbar para blocos de código */
    .message-content pre::-webkit-scrollbar {
      height: 8px;
    }

    .message-content pre::-webkit-scrollbar-track {
      background: #161b22;
      border-radius: 4px;
    }

    .message-content pre::-webkit-scrollbar-thumb {
      background: var(--accent);
      border-radius: 4px;
    }

    .message-content pre::-webkit-scrollbar-thumb:hover {
      background: #9333ea;
    }

    .message-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
    }

    .message-content th,
    .message-content td {
      border: 1px solid var(--border-color);
      padding: 0.75rem;
      text-align: left;
    }

    .message-content th {
      background: var(--bg-secondary);
      font-weight: 600;
    }

    .message-content a {
      color: #3b82f6;
      text-decoration: none;
      border-bottom: 1px solid transparent;
      transition: border-color 0.2s;
    }

    .message-content a:hover {
      border-bottom-color: #3b82f6;
    }

    /* KaTeX Styles - Estilo glassmorphism elegante */
    
    /* Display Math - Blocos de fórmulas destacados */
    .math-display {
      margin: 1.75rem 0;
      padding: 1.25rem 1.5rem;
      background: rgba(26, 26, 36, 0.45);
      border: 1px solid rgba(39, 39, 42, 0.7);
      border-radius: 12px;
      overflow-x: auto;
      overflow-y: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
    }

    .math-display .katex-display {
      display: inline-block !important;
      max-width: 100%;
    }

    .math-display .katex-display > .katex {
      display: inline-block !important;
    }

    .math-display .katex {
      color: #e4e4e7;
      font-size: 1.12em;
    }

    .math-display::-webkit-scrollbar {
      height: 8px;
    }

    .math-display::-webkit-scrollbar-track {
      background: rgba(26, 26, 36, 0.3);
      border-radius: 4px;
    }

    .math-display::-webkit-scrollbar-thumb {
      background: var(--accent);
      border-radius: 4px;
    }

    .math-display::-webkit-scrollbar-thumb:hover {
      background: #a855f7;
    }

    /* Inline Math - Fórmulas no meio do texto */
    .math-inline {
      display: inline-block;
      margin: 0 0.25em;
      padding: 0.15em 0.4em;
      background: rgba(100, 116, 139, 0.15);
      border: 1px solid rgba(100, 116, 139, 0.3);
      border-radius: 4px;
      vertical-align: middle;
      white-space: nowrap;
    }

    .math-inline .katex {
      font-size: 1.05em;
      color: #e4e4e7;
    }

    /* Cores customizadas para operadores matemáticos */
    .katex .mbin,
    .katex .mrel {
      color: #60a5fa !important;
    }

    .katex .mop {
      color: #34d399 !important;
    }

    .katex .mopen,
    .katex .mclose {
      color: #fbbf24 !important;
    }

    .katex .mord {
      color: #e4e4e7 !important;
    }

    .katex .mpunct {
      color: #a1a1aa !important;
    }

    /* Tratamento de erros LaTeX */
    .latex-error {
      display: inline-block;
      color: #fca5a5;
      background: rgba(239, 68, 68, 0.15);
      padding: 0.35rem 0.65rem;
      border: 1px dashed rgba(239, 68, 68, 0.5);
      border-radius: 6px;
      font-family: 'Fira Code', monospace;
      font-size: 0.9em;
      margin: 0.25rem;
    }

    /* Blocos de estruturas químicas SMILES */
    .chem-display {
      margin: 1.5rem 0;
      padding: 1.25rem;
      background: var(--code-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      text-align: center;
    }

    .chem-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border-color);
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .chem-header strong {
      color: var(--text-primary);
      font-size: 0.95rem;
    }

    .chem-info {
      color: var(--text-secondary);
      font-size: 0.85rem;
      font-family: 'Fira Code', monospace;
    }

    .chem-structure {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 1rem;
      background: #ffffff;
      border-radius: 8px;
      margin: 0.75rem 0;
    }

    .chem-structure svg {
      max-width: 100%;
      height: auto;
    }

    .chem-details {
      margin-top: 0.75rem;
      text-align: left;
    }

    .chem-details summary {
      cursor: pointer;
      color: var(--text-secondary);
      font-size: 0.85rem;
      padding: 0.5rem;
      border-radius: 6px;
      user-select: none;
      transition: background-color 0.2s;
    }

    .chem-details summary:hover {
      background: var(--hover-bg);
    }

    .chem-details code {
      display: block;
      margin-top: 0.5rem;
      padding: 0.75rem;
      background: var(--hover-bg);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-family: 'Fira Code', monospace;
      font-size: 0.9rem;
      color: var(--text-primary);
      overflow-x: auto;
    }

    .chem-error {
      margin: 1.5rem 0;
      padding: 1rem;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 8px;
      color: #fca5a5;
    }

    .chem-error strong {
      display: block;
      margin-bottom: 0.5rem;
      color: #f87171;
    }

    .chem-error p {
      margin: 0.5rem 0;
      font-size: 0.9rem;
    }

    .chem-error pre {
      margin-top: 0.75rem;
      padding: 0.75rem;
      background: rgba(239, 68, 68, 0.05);
      border: 1px dashed rgba(239, 68, 68, 0.3);
      border-radius: 6px;
      overflow-x: auto;
    }

    .chem-error code {
      font-family: 'Fira Code', monospace;
      font-size: 0.85rem;
      color: #fca5a5;
    }

    /* Footer */
    .footer {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid var(--border-color);
      text-align: center;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    /* Responsive */
    @media (max-width: 768px) {
      body {
        padding: 1rem 0.5rem;
      }

      .toolbar {
        position: static;
        margin-bottom: 1.5rem;
      }

      h1 {
        font-size: 2rem;
      }

      .message {
        padding: 1.25rem;
      }

      .meta {
        gap: 1rem;
      }
    }

    @media print {
      .toolbar {
        display: none;
      }
      
      body {
        background: white;
        color: black;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn-pdf" onclick="exportToPDF()">
      <span>📄</span>
      <span>Salvar como PDF</span>
    </button>
  </div>

  <div class="container">
    <div class="header">
      <h1>${chatName}</h1>
      <div class="meta">
        <div class="meta-item">
          <span>💬</span>
          <span>${messageCount} mensagens</span>
        </div>
        <div class="meta-item">
          <span>📅</span>
          <span>Exportado em ${exportDate}</span>
        </div>
      </div>
    </div>

    <div class="messages" id="messages-container">
      <!-- Messages will be inserted here -->
    </div>

    <div class="footer">
      <p>Exportado do <strong>Haumea Chat</strong> • haumea.fun</p>
      <p style="margin-top: 0.5rem; font-size: 0.85rem;">
        Este documento foi gerado automaticamente e contém ${messageCount} mensagens.
      </p>
    </div>
  </div>

  <script>
    // Initialize syntax highlighting when page loads
    document.addEventListener('DOMContentLoaded', function() {
      // Highlight all code blocks
      document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    });

    async function exportToPDF() {
      const button = document.querySelector('.btn-pdf');
      const originalHTML = button.innerHTML;
      button.innerHTML = '<span>⏳</span><span>Gerando PDF...</span>';
      button.disabled = true;

      try {
        const container = document.querySelector('.container');
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#0a0a0f',
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(\`${chatName.replace(/[^a-z0-9]/gi, '_')}_\${Date.now()}.pdf\`);
        
        button.innerHTML = '<span>✅</span><span>PDF Salvo!</span>';
        setTimeout(() => {
          button.innerHTML = originalHTML;
          button.disabled = false;
        }, 2000);
      } catch (error) {
        button.innerHTML = '<span>❌</span><span>Erro ao gerar PDF</span>';
        setTimeout(() => {
          button.innerHTML = originalHTML;
          button.disabled = false;
        }, 2000);
      }
    }
  </script>
</body>
</html>`;
}