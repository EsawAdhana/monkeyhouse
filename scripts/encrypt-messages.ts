// Run this script to encrypt existing messages in the database
// Usage: npx ts-node scripts/encrypt-messages.ts

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Message } from '../models/Message';
import { encryptMessage } from '../lib/encryption';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Connect to MongoDB
async function connectToDB() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Encrypt all unencrypted messages
async function encryptAllMessages() {
  try {
    // Find all messages that are not encrypted yet
    const unencryptedMessages = await Message.find({ 
      $or: [
        { isEncrypted: { $exists: false } },
        { isEncrypted: false }
      ]
    });
    
    console.log(`Found ${unencryptedMessages.length} unencrypted messages`);
    
    // Encrypt each message
    let encryptedCount = 0;
    for (const message of unencryptedMessages) {
      // Encrypt the message content
      const encryptedContent = await encryptMessage(
        message.content,
        message.conversationId.toString()
      );
      
      // Update the message with encrypted content
      await Message.updateOne(
        { _id: message._id },
        { 
          $set: { 
            content: encryptedContent,
            isEncrypted: true
          } 
        }
      );
      
      encryptedCount++;
      if (encryptedCount % 100 === 0) {
        console.log(`Encrypted ${encryptedCount} messages so far...`);
      }
    }
    
    console.log(`Successfully encrypted ${encryptedCount} messages`);
  } catch (error) {
    console.error('Error encrypting messages:', error);
  }
}

// Main function
async function main() {
  await connectToDB();
  await encryptAllMessages();
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
  console.log('Migration complete');
}

// Run the script
main().catch(console.error); 