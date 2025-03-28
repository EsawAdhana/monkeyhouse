import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dbConnect } from "@/lib/db/mongodb";
import { SurveyResponse } from "@/models/SurveyResponse";

export async function GET(req: Request) {
  try {
    // Get the current user's session
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "You must be signed in to check survey status" },
        { status: 401 }
      );
    }

    // Connect to the database
    await dbConnect();

    // Get user ID from session
    const userId = session.user.email;
    
    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found in session" },
        { status: 400 }
      );
    }

    // Check if user has a survey response and if it's been submitted
    const surveyResponse = await SurveyResponse.findOne({ userId });
    
    return NextResponse.json({
      hasSurvey: !!surveyResponse,
      isSubmitted: surveyResponse ? surveyResponse.submitted : false
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error checking survey status:", error);
    return NextResponse.json(
      { error: "Failed to check survey status: " + (error as Error).message },
      { status: 500 }
    );
  }
} 