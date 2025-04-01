import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import clientPromise from "@/lib/db/mongodb";
import { SurveyResponse } from "@/models/SurveyResponse";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Connect to MongoDB
const connectDB = async () => {
  try {
    const client = await clientPromise;
    const uri = process.env.MONGODB_URI!;
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw new Error("Failed to connect to database");
  }
};

// GET the current user's survey response
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    
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
    await connectDB();
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await req.json();
    
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
    return NextResponse.json({ error: "Failed to save survey response" }, { status: 500 });
  }
}