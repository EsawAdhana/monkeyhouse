import { NextResponse } from "next/server";
import clientPromise from "@/lib/db/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("monkey-house");
    
    // Simple test query
    const collections = await db.listCollections().toArray();
    
    return NextResponse.json({
      status: "Connected to MongoDB!",
      collections: collections.map(col => col.name),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to connect to database" },
      { status: 500 }
    );
  }
}