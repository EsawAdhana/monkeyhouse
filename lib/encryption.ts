'use server';

import crypto from 'crypto';

// Set a strong encryption key - in production, this would come from environment variables
// DO NOT hardcode in real production apps - use process.env.ENCRYPTION_SECRET
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '8ce3da310b0632abbd48bb6ef11462b8db9a8530682070dedac2e90a76b4c95d';

// Algorithm to use for encryption
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt a message string
 * @param text The plain text message to encrypt
 * @param conversationId Used as part of the encryption key to make each conversation's messages unique
 * @returns Encrypted message with IV and auth tag
 */
export async function encryptMessage(text: string, conversationId: string): Promise<string> {
  try {
    if (!ENCRYPTION_SECRET) {
      throw new Error('Encryption secret is not configured');
    }

    // Create a unique key for this conversation
    const key = crypto.scryptSync(ENCRYPTION_SECRET + conversationId, 'salt', 32);
    
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher with key and iv
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the message
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);
    
    // Get the authentication tag (for GCM mode)
    const authTag = cipher.getAuthTag();
    
    // Combine everything into a single string: iv:authTag:encryptedContent
    return Buffer.concat([
      iv,
      authTag,
      encrypted
    ]).toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt message');
  }
}

/**
 * Decrypt an encrypted message
 * @param encryptedText The encrypted message (iv:authTag:encryptedContent format)
 * @param conversationId Used to derive the same key used for encryption
 * @returns The original plain text message
 */
export async function decryptMessage(encryptedText: string, conversationId: string): Promise<string> {
  try {
    if (!ENCRYPTION_SECRET) {
      throw new Error('Encryption secret is not configured');
    }
    
    // Recreate the same key used for encryption
    const key = crypto.scryptSync(ENCRYPTION_SECRET + conversationId, 'salt', 32);
    
    // Convert the combined string back to a buffer
    const encryptedBuffer = Buffer.from(encryptedText, 'base64');
    
    // Extract the IV (first 16 bytes)
    const iv = encryptedBuffer.subarray(0, 16);
    
    // Extract the auth tag (next 16 bytes)
    const authTag = encryptedBuffer.subarray(16, 32);
    
    // Extract the encrypted content (everything after the first 32 bytes)
    const encrypted = encryptedBuffer.subarray(32);
    
    // Create a decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    // Set the auth tag
    decipher.setAuthTag(authTag);
    
    // Decrypt the message
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    // Return the original text
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt message');
  }
} 