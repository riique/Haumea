/**
 * Utilitários de criptografia para o frontend
 * 
 * IMPORTANTE: A criptografia de API Keys deve ser feita no BACKEND (Firebase Functions)
 * Este arquivo contém apenas funções auxiliares para o frontend.
 * 
 * Para salvar API Keys criptografadas, use a Cloud Function 'saveApiKey'
 */

/**
 * Gera uma chave de criptografia aleatória (32 bytes)
 * Útil para gerar ENCRYPTION_KEY inicial
 * 
 * @returns Chave em formato hexadecimal (64 caracteres)
 */
export function generateEncryptionKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Valida formato de API Key criptografada
 * 
 * Formato esperado: "iv:authTag:encryptedText"
 * Onde cada parte é uma string hexadecimal
 * 
 * @param encryptedKey - String criptografada a validar
 * @returns true se o formato é válido
 */
export function isEncryptedApiKey(encryptedKey: string): boolean {
  if (!encryptedKey || typeof encryptedKey !== 'string') {
    return false;
  }
  
  const parts = encryptedKey.split(':');
  return parts.length === 3 && parts.every(part => /^[0-9a-f]+$/i.test(part));
}

/**
 * Valida formato de API Key do OpenRouter
 * 
 * OpenRouter API Keys começam com "sk-or-"
 * 
 * @param apiKey - API Key a validar
 * @returns true se o formato é válido
 */
export function isValidOpenRouterKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  // OpenRouter keys começam com "sk-or-v1-" e têm pelo menos 50 caracteres
  return apiKey.startsWith('sk-or-') && apiKey.length >= 50;
}

/**
 * Mascara uma API Key para exibição segura
 * 
 * Exibe apenas os primeiros e últimos caracteres
 * 
 * @param apiKey - API Key a mascarar
 * @param visibleChars - Número de caracteres visíveis em cada extremidade
 * @returns API Key mascarada
 * 
 * @example
 * maskApiKey('sk-or-v1-1234567890abcdef', 6)
 * // => 'sk-or-...cdef'
 */
export function maskApiKey(apiKey: string, visibleChars: number = 6): string {
  if (!apiKey || apiKey.length <= visibleChars * 2) {
    return '***';
  }
  
  const start = apiKey.substring(0, visibleChars);
  const end = apiKey.substring(apiKey.length - visibleChars);
  
  return `${start}...${end}`;
}

/**
 * Sanitiza entrada de API Key
 * Remove espaços em branco e caracteres inválidos
 * 
 * @param apiKey - API Key a sanitizar
 * @returns API Key sanitizada
 */
export function sanitizeApiKey(apiKey: string): string {
  if (!apiKey) return '';
  
  // Remover espaços em branco e quebras de linha
  return apiKey.trim().replace(/\s/g, '');
}

/**
 * Valida força de senha
 * 
 * @param password - Senha a validar
 * @returns Objeto com resultado da validação
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number; // 0-4
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;
  
  if (!password) {
    return {
      isValid: false,
      score: 0,
      feedback: ['Senha é obrigatória'],
    };
  }
  
  // Critérios de validação
  const minLength = 6;
  const hasMinLength = password.length >= minLength;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  // Calcular score
  if (hasMinLength) score++;
  if (hasUpperCase) score++;
  if (hasLowerCase) score++;
  if (hasNumber) score++;
  if (hasSpecialChar) score++;
  
  // Gerar feedback
  if (!hasMinLength) {
    feedback.push(`Senha deve ter pelo menos ${minLength} caracteres`);
  }
  if (!hasUpperCase) {
    feedback.push('Adicione letras maiúsculas');
  }
  if (!hasLowerCase) {
    feedback.push('Adicione letras minúsculas');
  }
  if (!hasNumber) {
    feedback.push('Adicione números');
  }
  if (!hasSpecialChar) {
    feedback.push('Adicione caracteres especiais (!@#$%...)');
  }
  
  // Senha é válida se tiver comprimento mínimo
  const isValid = hasMinLength;
  
  return {
    isValid,
    score: Math.min(score, 4),
    feedback,
  };
}

/**
 * Hash simples para gerar IDs únicos
 * NÃO use para senhas - apenas para IDs e checksums
 * 
 * @param str - String a fazer hash
 * @returns Hash da string
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Converter para 32bit integer
  }
  return Math.abs(hash).toString(36);
}
