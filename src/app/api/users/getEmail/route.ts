import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    // Try to get user document by email (userId is typically email)
    const userDoc = await adminDb.collection('users').doc(userId).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      return NextResponse.json({
        success: true,
        email: userData?.email || userId
      });
    }

    // If not found, return the userId as email (fallback)
    return NextResponse.json({
      success: true,
      email: userId
    });
  } catch (error) {
    console.error('Error getting user email:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get user email' },
      { status: 500 }
    );
  }
} 