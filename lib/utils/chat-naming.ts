/**
 * Chat Auto-Naming Utilities
 * 
 * Handles automatic chat naming based on AI response
 */

/**
 * Extract chat name from AI response
 * Looks for <name>...</name> tags in the response
 * @param response - AI response text
 * @returns Extracted name or null if not found
 */
export function extractChatName(response: string): string | null {
  // Regex to match <name>content</name>
  const nameRegex = /<name>(.+?)<\/name>/i;
  const match = response.match(nameRegex);
  
  if (match && match[1]) {
    const extractedName = match[1].trim();
    
    // Validate name
    if (extractedName.length === 0) {
      return null;
    }
    
    // Truncate if too long (max 60 chars)
    if (extractedName.length > 60) {
      return extractedName.substring(0, 57) + '...';
    }
    
    // Sanitize special characters that might cause issues
    return sanitizeChatName(extractedName);
  }
  
  return null;
}

/**
 * Remove the <name> tag from the AI response
 * @param response - AI response text
 * @returns Response without the name tag
 */
export function removeChatNameTag(response: string): string {
  const nameRegex = /<name>(.+?)<\/name>/i;
  return response.replace(nameRegex, '').trim();
}

/**
 * Sanitize chat name by removing/escaping problematic characters
 * @param name - Raw chat name
 * @returns Sanitized name
 */
function sanitizeChatName(name: string): string {
  return name
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

/**
 * Get the naming system prompt to append to the regular system prompt
 * Should only be used on the first message of an auto-created chat
 */
export function getNamingSystemPrompt(): string {
  return `

Além de responder à mensagem do usuário, você deve gerar um nome descritivo e conciso para esta conversa. O nome deve capturar a essência do tópico ou pergunta principal.

**Diretrizes para o nome:**
- Máximo de 50 caracteres
- Seja específico e descritivo
- Use linguagem natural e clara
- Não use pontuação final
- Não use aspas ou formatação especial
- Capitalize adequadamente (primeira letra de palavras importantes em maiúscula)

**Formato obrigatório:**
Após sua resposta normal ao usuário, adicione o nome do chat entre as tags XML <name> e </name>. Esta tag será extraída automaticamente pelo sistema e não será visível ao usuário.

**Exemplos de nomes adequados:**

Para "Como fazer bolo de chocolate?":
<name>Receita de Bolo de Chocolate</name>

Para "Explique a teoria da relatividade":
<name>Teoria da Relatividade de Einstein</name>

Para "Quais as melhores práticas de React?":
<name>Boas Práticas em React</name>

Para "Help me debug this Python code":
<name>Debugging Código Python</name>

Para "Me conte uma história de aventura":
<name>História de Aventura</name>

**Importante:**
- O nome deve refletir o tópico REAL da conversa, não ser genérico
- Se a mensagem for muito vaga, escolha o aspecto mais relevante
- Para conversas casuais sem tópico claro, use algo como "Conversa Casual" ou "Chat Geral"
- SEMPRE inclua a tag <name> mesmo que seja difícil nomear

Lembre-se: A tag <name> será automaticamente removida da mensagem exibida ao usuário. Você não precisa mencioná-la ou explicá-la.`;
}

/**
 * Generate a temporary chat name
 * @returns Temporary name for new chat
 */
export function getTemporaryChatName(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `Chat ${hours}:${minutes}`;
}
