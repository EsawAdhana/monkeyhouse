
import mongoose from "mongoose";

// Define interface for the MonkeyData document
export interface IMonkeyData extends mongoose.Document {
  title: string;
  description?: string;
  userId: string;
  data?: any;
  status: "active" | "archived";
}

// Define the MonkeyData schema
const MonkeyDataSchema = new mongoose.Schema<IMonkeyData>(
  {
    title: { type: String, required: true },
    description: String,
    userId: { type: String, required: true, index: true },
    data: mongoose.Schema.Types.Mixed,
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true }
);

// Create and export the model
export const MonkeyData = mongoose.models.MonkeyData || mongoose.model<IMonkeyData>("MonkeyData", MonkeyDataSchema);