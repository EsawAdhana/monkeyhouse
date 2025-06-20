import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Only for development
const ENABLE_TEST_ENDPOINT = process.env.NODE_ENV !== 'production';

export async function DELETE(req: NextRequest) {
  // Check if test endpoint is enabled
  if (!ENABLE_TEST_ENDPOINT) {
    return NextResponse.json(
      { error: 'Test endpoints are disabled in production' },
      { status: 403 }
    );
  }
  
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get all test users before deletion to properly clean up references using admin SDK
    const testSurveysCollection = adminDb.collection('test_surveys');
    const usersCollection = adminDb.collection('users');
    const testUsersSnapshot = await testSurveysCollection.get();
    const testUserEmails = testUsersSnapshot.docs.map(doc => doc.data().userEmail).filter(Boolean);
    
    // Track deletion counts for each collection
    const deletionCounts = {
      surveys: 0,
      users: 0,
      conversations: 0,
      messages: 0
    };
    
    // Delete all test surveys using admin SDK
    for (const testUserDoc of testUsersSnapshot.docs) {
      await testUserDoc.ref.delete();
      deletionCounts.surveys++;
    }
    
    // If there were test users, clean up related collections
    if (testUserEmails.length > 0) {
      // For each test user email, check if they exist in the main users collection
      for (const email of testUserEmails) {
        try {
          // In Firestore, we'll assume the document ID in users collection is the email
          const userDocRef = usersCollection.doc(email);
          await userDocRef.delete();
          deletionCounts.users++;
        } catch (error) {
          console.error(`Error deleting user with email ${email}:`, error);
          // Continue with other users even if one fails
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Deleted test users`,
      deletedCounts: deletionCounts
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to delete test users',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 