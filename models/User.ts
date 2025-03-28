import mongoose from "mongoose";

// Define interface for the User document
export interface IUser extends mongoose.Document {
  name?: string;
  email?: string;
  image?: string;
  emailVerified?: Date;
  // Add any custom fields you want for users here
  bio?: string;
  preferences?: {
    theme?: string;
    notifications?: boolean;
  };
}

// Define the User schema
const UserSchema = new mongoose.Schema<IUser>(
  {
    name: String,
    email: String,
    image: String,
    emailVerified: Date,
    bio: String,
    preferences: {
      theme: { type: String, default: "light" },
      notifications: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

// Create and export the model
export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);