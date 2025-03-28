import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { User } from "@/models/User";
import { dbConnect } from "@/lib/db/mongodb";
import { SurveyResponse } from "@/models/SurveyResponse";

export async function DELETE(req: Request) {
  try {
    // Get the current user's session
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "You must be signed in to delete your account" },
        { status: 401 }
      );
    }

    // Connect to the database
    await dbConnect();

    // Get user ID from session
    const userId = session.user.id;
    
    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found in session" },
        { status: 400 }
      );
    }

    // Delete all related data (survey responses)
    try {
      await SurveyResponse.deleteMany({ userId });
    } catch (error) {
      console.error("Error deleting survey responses:", error);
      // Continue with deletion even if survey deletion fails
    }

    // Delete the user account
    try {
      const deletedUser = await User.findByIdAndDelete(userId);
      
      if (!deletedUser) {
        return NextResponse.json(
          { error: "User not found in database" },
          { status: 404 }
        );
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      return NextResponse.json(
        { error: "Failed to delete user from database" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Account deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account: " + (error as Error).message },
      { status: 500 }
    );
  }
} 