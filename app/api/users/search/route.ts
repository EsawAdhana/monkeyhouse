import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { dbConnect } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET to search for users by email
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Get query params
    const url = new URL(req.url);
    const email = url.searchParams.get("email");
    
    if (!email) {
      return NextResponse.json({ error: "Email search term is required" }, { status: 400 });
    }
    
    // Find users that match (excluding current user)
    const users = await User.find({
      email: { $regex: email, $options: "i" },
      email: { $ne: session.user.email }
    }).select("name email").limit(10);
    
    return NextResponse.json({ data: users });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ 
      error: "Failed to search users",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 