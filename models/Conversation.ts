'use server';

import mongoose from "mongoose";

// Define interface for Conversation document
export interface IConversation extends mongoose.Document {
  name: string;
  participants: string[]; // Array of user emails
  createdBy: string; // Creator's email
  createdAt: Date;
  updatedAt: Date;
}

// Define Conversation schema
const ConversationSchema = new mongoose.Schema<IConversation>(
  {
    name: { type: String, required: true },
    participants: { 
      type: [String], 
      required: true,
      validate: {
        validator: function(v: string[]) {
          return v.length > 0;
        },
        message: "Conversation must have at least one participant"
      }
    },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

// Create and export the model
export const Conversation = mongoose.models.Conversation || 
  mongoose.model<IConversation>("Conversation", ConversationSchema); 