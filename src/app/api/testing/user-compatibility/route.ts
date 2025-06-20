import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { calculateCompatibilityScore, calculateEnhancedCompatibilityScore } from '@/utils/recommendationEngine';
import { SurveyFormData } from '@/constants/survey-constants';
import { ExtendedSurveyData } from '@/types/survey';
import { adminDb } from '@/lib/firebase-admin';

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
    userEmail: docData.userEmail || docData.email || '',
    name: docData.name || '',
    email: docData.email || docData.userEmail || '',
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
    
    // Get parameters
    const { searchParams } = new URL(req.url);
    const centralUserEmail = searchParams.get('user');
    const minScore = searchParams.get('minScore');
    const useEnhancedScoring = searchParams.get('enhanced') !== 'false'; // Default to true
    
    if (!centralUserEmail) {
      return NextResponse.json(
        { error: 'Missing central user email parameter' },
        { status: 400 }
      );
    }
    
    // Parse minimum score, defaulting to 50
    const minScoreValue = minScore ? parseInt(minScore, 10) : 50;
    if (isNaN(minScoreValue)) {
      return NextResponse.json(
        { error: 'Invalid minScore parameter, must be a number' },
        { status: 400 }
      );
    }
    
    // First try direct document lookup by email using admin SDK
    const testSurveysCollection = adminDb.collection('test_surveys');
    let userDoc = await testSurveysCollection.doc(centralUserEmail).get();
    
    // If not found, try query by userEmail field
    if (!userDoc.exists) {
      const userQuery = testSurveysCollection.where('userEmail', '==', centralUserEmail);
      
      const userSnapshot = await userQuery.get();
      if (!userSnapshot.empty) {
        userDoc = userSnapshot.docs[0];
      } else {
        return NextResponse.json(
          { error: 'Central user not found' },
          { status: 404 }
        );
      }
    }
    
    // Convert to SurveyFormData
    const userData = documentToSurveyData(userDoc.data());
    
    // Get all other users
    const otherUsersQuery = testSurveysCollection.where('isSubmitted', '==', true);
    
    const otherUsersSnapshot = await otherUsersQuery.get();
    
    // Filter out the central user
    const otherUserDocs = otherUsersSnapshot.docs.filter(doc => {
      const data = doc.data();
      return (data.userEmail !== centralUserEmail && data.email !== centralUserEmail);
    });
    
    // Calculate compatibility with each other user
    const compatibilityResults = [];
    
    // Process each potential match
    for (const otherUserDoc of otherUserDocs) {
      const otherUserData = otherUserDoc.data();
      const otherUser = documentToSurveyData(otherUserData);
      
      let score;
      if (useEnhancedScoring) {
        // Pass the minimum score threshold to the enhanced scoring function
        score = await calculateEnhancedCompatibilityScore(userData, otherUser, minScoreValue);
      } else {
        score = calculateCompatibilityScore(userData, otherUser);
        // Filter by threshold for basic scoring
        if (score && score.score < minScoreValue) {
          score = null;
        }
      }
      
      // Only include matches that meet the threshold (after potential adjustment)
      if (score !== null) {
        compatibilityResults.push({
          user: {
            email: otherUser.userEmail!,
            name: otherUserData.name || otherUser.userEmail!,
            surveyData: otherUser
          },
          score: score.score,
          details: score.compatibilityDetails,
          explanation: score.explanations?.additionalNotesExplanation || 'No explanation available'
        });
      }
    }
    
    // Sort by score (highest first)
    compatibilityResults.sort((a, b) => b.score - a.score);
    
    // Map to include the full user data for the client
    const userDataMap = new Map();
    for (const result of compatibilityResults) {
      userDataMap.set(result.user.email, result.user);
    }

    return NextResponse.json({
      centralUser: {
        email: userData.userEmail,
        name: userData.name || userData.userEmail,
        surveyData: userData
      },
      compatibleUsers: compatibilityResults,
      totalUsersChecked: otherUserDocs.length,
      compatibleUsersCount: compatibilityResults.length,
      enhancedScoring: useEnhancedScoring,
      explanation: 'This is the explanation for the user compatibility calculation'
    });
    
  } catch (error) {
    console.error('Error calculating user compatibility:', error);
    return NextResponse.json(
      { 
        error: 'Failed to calculate user compatibility',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 