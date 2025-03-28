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
    }
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw new Error("Failed to connect to database");
  }
};

// GET a specific item
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { id } = params;
    const data = await MonkeyData.findOne({ _id: id, userId: session.user.email });
    
    if (!data) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    
    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch item" }, { status: 500 });
  }
}

// PUT to update an item
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { id } = params;
    const body = await req.json();
    
    const data = await MonkeyData.findOneAndUpdate(
      { _id: id, userId: session.user.email },
      { $set: body },
      { new: true }
    );
    
    if (!data) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    
    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

// DELETE an item
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { id } = params;
    
    const data = await MonkeyData.findOneAndUpdate(
      { _id: id, userId: session.user.email },
      { $set: { status: "archived" } },
      { new: true }
    );
    
    if (!data) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}