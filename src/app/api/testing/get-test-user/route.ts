import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { adminDb } from '@/lib/firebase-admin';
import { SurveyFormData } from '@/constants/survey-constants';
import { ExtendedSurveyData } from '@/types/survey';

// This endpoint is for testing purposes only
// Should be disabled in production
const ENABLE_TEST_ENDPOINT = process.env.NODE_ENV !== 'production';

// Convert Firestore document to SurveyFormData
function documentToSurveyData(docData: any): ExtendedSurveyData {
  return {
    firstName: docData.firstName || '',
    gender: docData.gender || '',
    roomWithDifferentGender: !!docData.roomWithDifferentGender,
    housingRegion: docData.housingRegion || '',
    housingCities: Array.isArray(docData.housingCities) ? docData.housingCities : [],
    internshipCompany: docData.internshipCompany || '',
    internshipStartDate: docData.internshipStartDate || '',
    internshipEndDate: docData.internshipEndDate || '',
    desiredRoommates: docData.desiredRoommates || '1',
    minBudget: typeof docData.minBudget === 'number' ? docData.minBudget : 1000,
    maxBudget: typeof docData.maxBudget === 'number' ? docData.maxBudget : 1500,
    preferences: Array.isArray(docData.preferences) ? docData.preferences : [],
    additionalNotes: docData.additionalNotes || '',
    currentPage: typeof docData.currentPage === 'number' ? docData.currentPage : 1,
    isDraft: !!docData.isDraft,
    isSubmitted: !!docData.isSubmitted,
    userEmail: docData.userEmail || '',
    name: docData.name || '',
    email: docData.email || '',
  };
}

export async function GET(req: NextRequest) {
  // Check if test endpoint is enabled
  if (!ENABLE_TEST_ENDPOINT) {
    return NextResponse.json(
      { error: 'Test endpoints are disabled in production' },
      { status: 403 }
    );
  }
  
  try {
    const session = await getServerSession();
    
    // Only allow authenticated users to access this endpoint
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const url = new URL(req.url);
    const userEmail = url.searchParams.get('userEmail');
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing required parameter: userEmail' },
        { status: 400 }
      );
    }
    
    // Get user survey data from Firestore using admin SDK
    const testSurveysCollection = adminDb.collection('test_surveys');
    const userDoc = await testSurveysCollection.doc(userEmail).get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Convert to SurveyFormData
    const userData = documentToSurveyData(userDoc.data());
    
    return NextResponse.json({
      user: {
        email: userData.userEmail,
        name: userData.name || userData.userEmail,
        surveyData: userData
      }
    });
    
  } catch (error: unknown) {
    console.error('Error getting test user:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get test user',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
} 