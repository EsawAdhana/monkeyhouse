import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import clientPromise from "@/lib/db/mongodb";
import { MonkeyData } from "@/models/MonkeyData";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Connect to MongoDB
const connectDB = async () => {
  try {
    const client = await clientPromise;
    const uri = process.env.MONGODB_URI!;
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
      console.log("Connected to MongoDB");
    }
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw new Error("Failed to connect to database");
  }
};

// GET all data for the current user
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await MonkeyData.find({ userId: session.user.email, status: "active" })
      .sort({ createdAt: -1 })
      .limit(20);
    
    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

// POST to create new data
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await req.json();
    const { title, description, data } = body;
    
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    
    const newData = new MonkeyData({
      title,
      description,
      data,
      userId: session.user.email,
    });
    
    await newData.save();
    
    return NextResponse.json({ data: newData }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create data" }, { status: 500 });
  }
}