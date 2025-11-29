import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const encryptionKeyString = (process.env.ENCRYPTION_KEY || '').trim();
  const key = Buffer.from(encryptionKeyString, 'hex');

  if (key.length !== 32) {
    throw new Error(`ENCRYPTION_KEY deve ter 32 bytes (64 hex chars). Atual: ${key.length} bytes. Configure via Firebase Secret Manager.`);
  }

  return key;
}

export function encrypt(text: string): string {
  const ENCRYPTION_KEY = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encrypted: string): string {
  try {
    const ENCRYPTION_KEY = getEncryptionKey();
    const [ivHex, authTagHex, encryptedText] = encrypted.split(':');
    
    if (!ivHex || !authTagHex || !encryptedText) {
      throw new Error('Formato inválido');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Falha ao descriptografar');
  }
}
