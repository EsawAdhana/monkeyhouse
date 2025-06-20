import { NextResponse } from 'next/server';
import { encryptMessage, decryptMessage, safeDecryptMessage } from '@/lib/encryption';

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    
    // Test encryption
    const encrypted = encryptMessage(message);
    console.log('Encrypted data:', encrypted);
    
    // Test decryption
    const decrypted = decryptMessage(encrypted);
    console.log('Decrypted message:', decrypted);
    
    // Test safe decryption (backward compatibility)
    const safeDecrypted = safeDecryptMessage(encrypted);
    const plainTextSafe = safeDecryptMessage(message);
    
    const isWorking = message === decrypted && message === safeDecrypted && message === plainTextSafe;
    
    return NextResponse.json({
      success: true,
      originalMessage: message,
      encrypted: encrypted,
      decrypted: decrypted,
      safeDecrypted: safeDecrypted,
      plainTextSafe: plainTextSafe,
      encryptionWorking: isWorking,
      message: isWorking ? 'Encryption is working correctly!' : 'Encryption test failed'
    });
    
  } catch (error) {
    console.error('Encryption test error:', error);
    return NextResponse.json({ 
      error: 'Encryption test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    info: 'POST a message to test encryption',
    example: {
      method: 'POST',
      body: {
        message: 'Hello, this is a test message!'
      }
    }
  });
} 