'use server';

import mongoose from "mongoose";

// Define interface for Message document
export interface IMessage extends mongoose.Document {
  conversationId: mongoose.Types.ObjectId;
  sender: string; // Sender's email
  content: string; // This will store encrypted content
  isEncrypted: boolean; // Flag to indicate if the content is encrypted
  createdAt: Date;
  updatedAt: Date;
}

// Define Message schema
const MessageSchema = new mongoose.Schema<IMessage>(
  {
    conversationId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Conversation',
      required: true 
    },
    sender: { type: String, required: true },
    content: { type: String, required: true },
    isEncrypted: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Create and export the model
export const Message = mongoose.models.Message || 
  mongoose.model<IMessage>("Message", MessageSchema); 