import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dbConnect } from "@/lib/db/mongodb";
import { SurveyResponse } from "@/models/SurveyResponse";
import { User } from "@/models/User";
import { Account } from "@/models/Account";
import mongoose from "mongoose";

interface AccountDocument {
  userId: string;
  provider: string;
  providerAccountId: string;
}

export async function DELETE(req: Request) {
  // @ts-ignore - Ignoring the type error with authOptions
  const session = await getServerSession(authOptions);
    
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "You must be signed in to delete your account" },
      { status: 401 }
    );
  }

  const userEmail = session.user.email;
  
  try {
    // Connect to database
    await dbConnect();
    
    // Find user by email
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    const userId = user._id.toString();
    
    // Perform deletion operations sequentially
    
    // 1. Delete survey responses
    const surveyResult = await SurveyResponse.deleteMany({ userId: userEmail });
    
    // 2. Delete accounts
    const accountResult = await Account.deleteMany({ userId: userId });
    
    // 3. Delete user
    const userResult = await User.deleteOne({ _id: user._id });
    
    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
      details: {
        surveyResponsesDeleted: surveyResult.deletedCount,
        accountsDeleted: accountResult.deletedCount,
        userDeleted: userResult.deletedCount
      }
    });
  } catch (error) {
    console.error("Error during account deletion:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to delete account", 
        message: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
} 