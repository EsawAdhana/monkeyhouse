import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { dbConnect } from "@/lib/db/mongodb";
import { Conversation } from "@/models/Conversation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET all conversations for current user
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userEmail = session.user.email;
    
    // Find all conversations where user is a participant
    const conversations = await Conversation.find({ 
      participants: { $in: [userEmail] } 
    }).sort({ lastActivity: -1 }); // Most recent activity first
    
    return NextResponse.json({ data: conversations });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ 
      error: "Failed to fetch conversations",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

// POST to create a new conversation
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userEmail = session.user.email;
    const body = await req.json();
    
    // Ensure required fields are present
    const { title, participants } = body;
    
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return NextResponse.json({ error: "At least one participant is required" }, { status: 400 });
    }
    
    // Create a new conversation
    const newConversation = new Conversation({
      title,
      participants: [...new Set([userEmail, ...participants])], // Ensure uniqueness and include current user
      createdBy: userEmail,
      lastActivity: new Date()
    });
    
    await newConversation.save();
    
    return NextResponse.json({ data: newConversation }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ 
      error: "Failed to create conversation",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 