import mongoose from "mongoose";

const accountSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  type: { type: String, required: true },
  provider: { type: String, required: true },
  providerAccountId: { type: String, required: true },
  refresh_token: String,
  access_token: String,
  expires_at: Number,
  token_type: String,
  scope: String,
  id_token: String,
  session_state: String,
});

// Create a compound unique index
accountSchema.index(
  { provider: 1, providerAccountId: 1 },
  { unique: true }
);

export const Account = mongoose.models.Account || mongoose.model("Account", accountSchema); 