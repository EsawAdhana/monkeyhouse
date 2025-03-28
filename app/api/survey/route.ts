import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { dbConnect } from "@/lib/db/mongodb";
import { SurveyResponse } from "@/models/SurveyResponse";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET the current user's survey response
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await SurveyResponse.findOne({ userId: session.user.email });
    
    return NextResponse.json({ data: response || null });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch survey response" }, { status: 500 });
  }
}

// POST to create or update a survey response
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await req.json();
    
    // Validate required fields
    const requiredFields = [
      "gender", 
      "roomWithDifferentGender", 
      "housingRegion",
      "internshipStartDate", 
      "internshipEndDate", 
      "desiredRoommates",
      "monthlyBudget"
    ];
    
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null || body[field] === "") {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }
    
    // Find existing response or create new one
    const existingResponse = await SurveyResponse.findOne({ userId: session.user.email });
    
    if (existingResponse) {
      // Update existing response
      Object.assign(existingResponse, body);
      await existingResponse.save();
      return NextResponse.json({ data: existingResponse });
    } else {
      // Create new response
      const newResponse = new SurveyResponse({
        ...body,
        userId: session.user.email,
      });
      
      await newResponse.save();
      return NextResponse.json({ data: newResponse }, { status: 201 });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ 
      error: "Failed to save survey response", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
} 