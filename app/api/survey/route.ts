import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { dbConnect } from "@/lib/db/mongodb";
import { SurveyResponse } from "@/models/SurveyResponse";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET the current user's survey response
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
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
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await req.json();
    const partialSubmission = new URL(req.url).searchParams.get('partial') === 'true';
    
    // Only validate required fields for final submission
    if (!partialSubmission) {
      const requiredFields = [
        "gender", 
        "roomWithDifferentGender", 
        "housingRegion",
        "internshipStartDate", 
        "internshipEndDate", 
        "internshipCompany",
        "sameCompanyOnly",
        "desiredRoommates",
        "monthlyBudget",
        "preferences"
      ];
      
      const missingFields = requiredFields.filter(field => !body[field]);
      if (missingFields.length > 0) {
        return NextResponse.json({ 
          error: "Missing required fields", 
          fields: missingFields 
        }, { status: 400 });
      }
    }
    
    await dbConnect();
    
    // Find existing response or create new one
    const existingResponse = await SurveyResponse.findOne({ userId: session.user.email });
    
    if (existingResponse) {
      // Update existing response
      if (partialSubmission) {
        // For partial submissions, only update the fields that were provided
        Object.keys(body).forEach(key => {
          if (body[key] !== undefined) {
            existingResponse[key] = body[key];
          }
        });
        
        // Save with validation disabled for partial submissions
        await existingResponse.save({ validateBeforeSave: false });
      } else {
        // For final submission, update all fields
        Object.assign(existingResponse, body);
        // Set submitted to true for final submissions
        existingResponse.submitted = true;
        await existingResponse.save();
      }
      return NextResponse.json({ data: existingResponse });
    } else {
      // Create new response
      const newResponse = new SurveyResponse({
        ...body,
        userId: session.user.email,
        submitted: !partialSubmission, // Only mark as submitted for final submissions
      });
      
      // Save with validation disabled for partial submissions
      if (partialSubmission) {
        await newResponse.save({ validateBeforeSave: false });
      } else {
        await newResponse.save();
      }
      
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