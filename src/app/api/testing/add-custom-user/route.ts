import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { adminDb } from '@/lib/firebase-admin';

// This endpoint is for testing purposes only
// Should be disabled in production
const ENABLE_TEST_ENDPOINT = process.env.NODE_ENV !== 'production';

export async function POST(req: NextRequest) {
  // Check if test endpoint is enabled
  if (!ENABLE_TEST_ENDPOINT) {
    return NextResponse.json(
      { error: 'Test endpoints are disabled in production' },
      { status: 403 }
    );
  }
  
  try {
    const session = await getServerSession();
    
    // Only allow authenticated users to create custom test users
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await req.json();
    const { numCopies = 1, ...userData } = body;
    
    // Validate required fields
    if (!userData.name || !userData.email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }
    
    // Limit number of copies to prevent abuse
    const copyCount = Math.min(Math.max(1, numCopies), 10);
    
    const testSurveysCollection = adminDb.collection('test_surveys');
    const addedUsers = [];
    const errors = [];
    
    // Create the specified number of copies
    for (let i = 0; i < copyCount; i++) {
      try {
        // For multiple copies, append a number to make emails unique
        const emailSuffix = copyCount > 1 ? `+${i + 1}` : '';
        const userEmail = userData.email.replace('@', `${emailSuffix}@`);
        
        // Prepare the user data for Firestore
        const testUser = {
          firstName: userData.name.split(' ')[0] || userData.name,
          name: userData.name,
          email: userEmail,
          userEmail: userEmail,
          gender: userData.gender || 'Male',
          roomWithDifferentGender: !!userData.roomWithDifferentGender,
          housingRegion: userData.housingRegion || 'Bay Area',
          housingCities: Array.isArray(userData.housingCities) ? userData.housingCities : ['San Francisco'],
          internshipCompany: userData.internshipCompany || '',
          internshipStartDate: userData.internshipStartDate || '',
          internshipEndDate: userData.internshipEndDate || '',
          desiredRoommates: userData.desiredRoommates || '2',
          minBudget: typeof userData.minBudget === 'number' ? userData.minBudget : 1500,
          maxBudget: typeof userData.maxBudget === 'number' ? userData.maxBudget : 2500,
          preferences: Array.isArray(userData.preferences) ? userData.preferences : [],
          additionalNotes: userData.additionalNotes || '',
          currentPage: 5,
          isDraft: false,
          isSubmitted: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Check if user already exists
        const existingDoc = await testSurveysCollection.doc(userEmail).get();
        if (existingDoc.exists) {
          errors.push(`User with email ${userEmail} already exists`);
          continue;
        }
        
        // Add to test_surveys collection using admin SDK
        await testSurveysCollection.doc(userEmail).set(testUser);
        addedUsers.push({
          name: testUser.name,
          email: testUser.email,
          gender: testUser.gender,
          region: testUser.housingRegion
        });
        
      } catch (error) {
        console.error(`Error adding custom test user copy ${i + 1}:`, error);
        errors.push(`Failed to add copy ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    if (addedUsers.length === 0) {
      return NextResponse.json(
        { 
          error: 'Failed to add any custom test users',
          details: errors
        },
        { status: 500 }
      );
    }
    
    const responseMessage = copyCount === 1 
      ? `Added custom test user: ${addedUsers[0].name}`
      : `Added ${addedUsers.length} custom test users (${copyCount} requested)`;
    
    return NextResponse.json({
      success: true,
      message: responseMessage,
      count: addedUsers.length,
      users: addedUsers,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    console.error('Error adding custom test user:', error);
    return NextResponse.json(
      { 
        error: 'Failed to add custom test user',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
