import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For CBC, 128-bit IV
const KEY_LENGTH = 32; // 256-bit key

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  // Convert hex string to buffer
  if (key.length !== KEY_LENGTH * 2) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes), got ${key.length} characters`);
  }
  
  try {
    return Buffer.from(key, 'hex');
  } catch (error) {
    throw new Error(`Invalid ENCRYPTION_KEY format: ${error}`);
  }
}

export interface EncryptedData {
  encryptedContent: string; // Base64 encoded
  iv: string; // Base64 encoded initialization vector
}

/**
 * Encrypt a string using AES-256-CBC
 */
export function encryptMessage(plaintext: string): EncryptedData {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return {
      encryptedContent: encrypted,
      iv: iv.toString('base64')
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt message');
  }
}

/**
 * Decrypt a string using AES-256-CBC
 */
export function decryptMessage(encryptedData: EncryptedData): string {
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(encryptedData.iv, 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encryptedData.encryptedContent, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt message');
  }
}

/**
 * Check if a message appears to be encrypted
 */
export function isEncryptedMessage(content: any): content is EncryptedData {
  return (
    typeof content === 'object' &&
    content !== null &&
    typeof content.encryptedContent === 'string' &&
    typeof content.iv === 'string'
  );
}

/**
 * Utility to handle backward compatibility - decrypt if encrypted, return as-is if plain text
 */
export function safeDecryptMessage(content: any): string {
  if (isEncryptedMessage(content)) {
    return decryptMessage(content);
  }
  
  // Return as plain text (for backward compatibility with existing messages)
  return typeof content === 'string' ? content : String(content);
} 