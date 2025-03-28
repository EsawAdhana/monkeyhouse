import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import clientPromise from "@/lib/db/mongodb";
import { SurveyResponse } from "@/models/SurveyResponse";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Admin emails that are allowed to access this endpoint
const ADMIN_EMAILS = ["adhanaesaw@gmail.com"];

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

// GET all survey responses (admin only)
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check if user is an admin
    if (!ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db();
    
    // Get responses and join with user data
    const responses = await SurveyResponse.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "email",
          as: "userDetails"
        }
      },
      {
        $addFields: {
          user: { $arrayElemAt: ["$userDetails", 0] }
        }
      },
      {
        $project: {
          userDetails: 0,
          "user.emailVerified": 0,
          "user.createdAt": 0,
          "user.updatedAt": 0
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);
    
    return NextResponse.json({ data: responses });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch survey responses" }, { status: 500 });
  }
} 