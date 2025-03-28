import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { dbConnect } from "@/lib/db/mongodb";
import { Conversation } from "@/models/Conversation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

interface Params {
  params: {
    id: string;
  };
}

// GET a specific conversation
export async function GET(req: NextRequest, params: Params) {
  try {
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params before destructuring
    const { id } = await params.params;
    const userEmail = session.user.email;
    
    // Find the conversation by ID and ensure the user is a participant
    const conversation = await Conversation.findOne({ 
      _id: id, 
      participants: { $in: [userEmail] } 
    });
    
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    
    return NextResponse.json({ data: conversation });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ 
      error: "Failed to fetch conversation",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

// PUT to add participants
export async function PUT(req: NextRequest, params: Params) {
  try {
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params before destructuring
    const { id } = await params.params;
    const userEmail = session.user.email;
    
    // Find the conversation
    const conversation = await Conversation.findOne({ 
      _id: id, 
      participants: { $in: [userEmail] } 
    });
    
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    
    const body = await req.json();
    const { participants } = body;
    
    // Validate input
    if (!Array.isArray(participants) || participants.length === 0) {
      return NextResponse.json({ error: "At least one participant is required" }, { status: 400 });
    }
    
    // Add new participants (avoiding duplicates)
    const updatedParticipants = [...new Set([...conversation.participants, ...participants])];
    conversation.participants = updatedParticipants;
    
    await conversation.save();
    
    return NextResponse.json({ data: conversation });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ 
      error: "Failed to update conversation",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 