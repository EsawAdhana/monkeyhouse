'use server';

import mongoose from "mongoose";

// Define interface for the SurveyResponse document
export interface ISurveyResponse extends mongoose.Document {
  userId: string;
  gender: string;
  roomWithDifferentGender: boolean;
  housingRegion: string;
  housingCities: string[];
  internshipStartDate: Date;
  internshipEndDate: Date;
  desiredRoommates: string; // "1", "2", "3", "4+"
  monthlyBudget: number;
  nonNegotiables: string[];
  additionalNotes?: string;
  submitted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Define the SurveyResponse schema
const SurveyResponseSchema = new mongoose.Schema<ISurveyResponse>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    gender: { type: String, required: true },
    roomWithDifferentGender: { type: Boolean, required: true },
    housingRegion: { type: String, required: true },
    housingCities: [String],
    internshipStartDate: { type: Date, required: true },
    internshipEndDate: { type: Date, required: true },
    desiredRoommates: { 
      type: String, 
      required: true,
      enum: ["1", "2", "3", "4+"]
    },
    monthlyBudget: { type: Number, required: true },
    nonNegotiables: [String],
    additionalNotes: String,
    submitted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Create and export the model
export const SurveyResponse = mongoose.models.SurveyResponse || 
  mongoose.model<ISurveyResponse>("SurveyResponse", SurveyResponseSchema);