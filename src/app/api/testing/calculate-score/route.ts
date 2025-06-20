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
    
    // Get email parameters
    const { searchParams } = new URL(req.url);
    const email1 = searchParams.get('email1') || searchParams.get('user1');
    const email2 = searchParams.get('email2') || searchParams.get('user2');
    const useEnhancedScoring = searchParams.get('enhanced') !== 'false'; // Default to true
    
    if (!email1 || !email2) {
      return NextResponse.json(
        { error: 'Missing email parameters. Use email1 and email2 query parameters.' },
        { status: 400 }
      );
    }
    
    // First try direct document lookup by email using admin SDK
    const testSurveysCollection = adminDb.collection('test_surveys');
    let user1Doc = await testSurveysCollection.doc(email1).get();
    let user2Doc = await testSurveysCollection.doc(email2).get();
    
    // If not found, try query by userEmail or email field
    if (!user1Doc.exists) {
      const user1Query = testSurveysCollection.where('userEmail', '==', email1);
      const user1Snapshot = await user1Query.get();
      if (!user1Snapshot.empty) {
        user1Doc = user1Snapshot.docs[0];
      }
    }
    
    if (!user2Doc.exists) {
      const user2Query = testSurveysCollection.where('userEmail', '==', email2);
      const user2Snapshot = await user2Query.get();
      if (!user2Snapshot.empty) {
        user2Doc = user2Snapshot.docs[0];
      }
    }
    
    if (!user1Doc.exists || !user2Doc.exists) {
      return NextResponse.json(
        { error: 'One or both users not found' },
        { status: 404 }
      );
    }
    
    // Convert to SurveyFormData
    const user1 = documentToSurveyData(user1Doc.data());
    const user2 = documentToSurveyData(user2Doc.data());
    
    // Calculate compatibility scores in both directions
    let score1to2, score2to1;
    
    if (useEnhancedScoring) {
      // Use enhanced scoring with LLM analysis
      score1to2 = await calculateEnhancedCompatibilityScore(user1, user2);
      score2to1 = await calculateEnhancedCompatibilityScore(user2, user1);
    } else {
      // Use basic scoring without LLM
      score1to2 = calculateCompatibilityScore(user1, user2);
      score2to1 = calculateCompatibilityScore(user2, user1);
    }
    
    // If both scores are null, these users are incompatible
    if (!score1to2 && !score2to1) {
      return NextResponse.json({
        score: null,
        message: 'These users are incompatible due to hard constraints',
      });
    }
    
    // Use the score that's available, or average them if both are
    const finalScore = score1to2 && score2to1 
      ? (score1to2.score + score2to1.score) / 2
      : (score1to2 ? score1to2.score : score2to1!.score);
    
    // Merge details if both scores exist
    const details = score1to2 && score2to1
      ? {
          locationScore: (score1to2.compatibilityDetails.locationScore + score2to1.compatibilityDetails.locationScore) / 2,
          budgetScore: (score1to2.compatibilityDetails.budgetScore + score2to1.compatibilityDetails.budgetScore) / 2,
          genderScore: (score1to2.compatibilityDetails.genderScore + score2to1.compatibilityDetails.genderScore) / 2,
          timingScore: (score1to2.compatibilityDetails.timingScore + score2to1.compatibilityDetails.timingScore) / 2,
          roommateScore: (score1to2.compatibilityDetails.roommateScore + score2to1.compatibilityDetails.roommateScore) / 2,
          preferencesScore: (score1to2.compatibilityDetails.preferencesScore + score2to1.compatibilityDetails.preferencesScore) / 2,
          additionalInfoScore: (score1to2.compatibilityDetails.additionalInfoScore + score2to1.compatibilityDetails.additionalInfoScore) / 2,
        }
      : (score1to2 ? score1to2.compatibilityDetails : score2to1!.compatibilityDetails);
    
    return NextResponse.json({
      score: finalScore,
      details: details,
      direction: score1to2 && score2to1 ? 'both' : (score1to2 ? '1to2' : '2to1'),
      enhancedScoring: useEnhancedScoring,
      user1Notes: user1.additionalNotes,
      user2Notes: user2.additionalNotes,
      explanation: score1to2?.explanations?.additionalNotesExplanation || 
                  score2to1?.explanations?.additionalNotesExplanation || 
                  'No explanation available'
    });
  } catch (error) {
    console.error('Error calculating compatibility score:', error);
    return NextResponse.json(
      { error: 'Failed to calculate compatibility score', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 