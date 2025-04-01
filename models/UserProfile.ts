import mongoose from "mongoose";
import { HOUSING_REGIONS, NON_NEGOTIABLES } from "@/constants/survey-constants";

// Define interface for the UserProfile document
export interface IUserProfile extends mongoose.Document {
  email: string;
  name?: string;
  image?: string;
  emailVerified?: Date;
  bio?: string;
  preferences?: {
    theme?: string;
    notifications?: boolean;
  };
  // Survey data
  survey?: {
    gender: string;
    roomWithDifferentGender: boolean;
    housingRegion: string;
    housingCities: string[];
    internshipStartDate: Date;
    internshipEndDate: Date;
    desiredRoommates: string;
    monthlyBudget: number;
    nonNegotiables: string[];
    additionalNotes?: string;
    submitted: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Define the UserProfile schema
const UserProfileSchema = new mongoose.Schema<IUserProfile>(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: String,
    image: String,
    emailVerified: Date,
    bio: String,
    preferences: {
      theme: { type: String, default: "light" },
      notifications: { type: Boolean, default: true },
    },
    survey: {
      gender: { type: String },
      roomWithDifferentGender: { type: Boolean },
      housingRegion: { type: String },
      housingCities: [String],
      internshipStartDate: { type: Date },
      internshipEndDate: { type: Date },
      desiredRoommates: { 
        type: String,
        enum: ["1", "2", "3", "4+"]
      },
      monthlyBudget: { type: Number },
      nonNegotiables: [String],
      additionalNotes: String,
      submitted: { type: Boolean, default: false },
    }
  },
  { timestamps: true }
);

// Create and export the model
export const UserProfile = mongoose.models.UserProfile || 
  mongoose.model<IUserProfile>("UserProfile", UserProfileSchema); 