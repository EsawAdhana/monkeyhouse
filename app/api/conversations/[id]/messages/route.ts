import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { dbConnect } from "@/lib/db/mongodb";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { encryptMessage, decryptMessage } from "@/lib/encryption";

interface Params {
  params: {
    id: string;
  };
}

// GET messages for a conversation
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
    
    // Verify user is a participant
    const conversation = await Conversation.findOne({ 
      _id: id, 
      participants: { $in: [userEmail] }
    });
    
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found or you don't have permission" }, { status: 404 });
    }
    
    // Fetch messages and decrypt them
    const messages = await Message.find({ conversationId: id })
      .sort({ createdAt: 1 }) // Sort by creation date ascending
      .lean(); // Use lean to get plain objects
    
    // Decrypt messages before sending to client
    const decryptedMessages = await Promise.all(messages.map(async message => {
      try {
        const content = await decryptMessage(message.content, id);
        return { ...message, content };
      } catch (error) {
        console.error("Error decrypting message:", error);
        return { ...message, content: "[Encrypted message]" };
      }
    }));
    
    return NextResponse.json({ data: decryptedMessages });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ 
      error: "Failed to fetch messages",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

// POST a new message
export async function POST(req: NextRequest, params: Params) {
  try {
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params before destructuring
    const { id } = await params.params;
    const userEmail = session.user.email;
    const userName = session.user.name || userEmail;
    
    // Verify user is a participant
    const conversation = await Conversation.findOne({ 
      _id: id, 
      participants: { $in: [userEmail] }
    });
    
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found or you don't have permission" }, { status: 404 });
    }
    
    // Get message content from request body
    const body = await req.json();
    const { content } = body;
    
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }
    
    // Encrypt message content before storing
    const encryptedContent = await encryptMessage(content, id);
    
    // Create and save the new message
    const newMessage = new Message({
      conversationId: id,
      sender: userEmail,
      senderName: userName,
      content: encryptedContent,
      createdAt: new Date()
    });
    
    await newMessage.save();
    
    // Update conversation's lastActivity
    conversation.lastActivity = new Date();
    await conversation.save();
    
    // Return the decrypted message for immediate display
    return NextResponse.json({ 
      data: {
        ...newMessage.toObject(),
        content // Return the original content, not the encrypted version
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ 
      error: "Failed to send message",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 