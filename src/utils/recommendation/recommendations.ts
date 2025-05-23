import { SurveyFormData } from '@/constants/survey-constants';
import { CompatibilityScore, UserComparisonResult } from './types';
import { calculateCompatibilityScore } from './scoring';
import { calculateEnhancedCompatibilityScore } from './enhanced-scoring';
import { isUserBlocked, getUserSurveyData, documentToSurveyData, testSurveysCollection } from './helpers';
import { getConstraintDetails } from './constraints';
import { DEFAULT_MIN_COMPATIBILITY_THRESHOLD } from './constants';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Get recommended matches for a user with scores
 */
export async function getRecommendedMatches(
  userEmail: string,
  testMinCompatibilityScore?: number,
  filterEmails?: string[],
  useEnhancedScoring: boolean = true,
  showTestUsers: boolean = false
): Promise<CompatibilityScore[]> {
  // Get the user's survey data
  let userSurveyDoc;
  let isTestUser = false;
  
  try {
    const result = await getUserSurveyData(userEmail);
    isTestUser = result.isTestUser;
    userSurveyDoc = result.userData;
  } catch (error) {
    console.error('Error fetching user survey data:', error);
    return [];
  }
  
  const userData = userSurveyDoc;
  
  // Get all other users' survey data
  let otherUsersSurveys = [];
  
  // If specific emails are provided, only get those
  if (filterEmails && filterEmails.length > 0) {
    // Regular surveys for specific emails
    const regularSurveysSnapshot = await adminDb.collection('surveys')
      .where('isSubmitted', '==', true)
      .where('userEmail', 'in', filterEmails)
      .get();
    const regularSurveys = regularSurveysSnapshot.docs;
    
    // Test surveys for specific emails (if showTestUsers is true)
    let testSurveys: any[] = [];
    if (showTestUsers) {
      const testSurveysSnapshot = await adminDb.collection('test-surveys')
        .where('isSubmitted', '==', true)
        .where('userEmail', 'in', filterEmails)
        .get();
      testSurveys = testSurveysSnapshot.docs;
    }
    
    otherUsersSurveys = [...regularSurveys, ...(showTestUsers ? testSurveys : [])];
  } else {
    // Get all surveys except current user
    // Note: Firestore doesn't support $ne directly, so we'll filter after fetching
    const regularSurveysSnapshot = await adminDb.collection('surveys')
      .where('isSubmitted', '==', true)
      .get();
    const regularSurveys = regularSurveysSnapshot.docs.filter(
      doc => doc.data().userEmail !== userEmail
    );
    
    // Test surveys (if showTestUsers is true)
    let testSurveys: any[] = [];
    if (showTestUsers) {
      const testSurveysSnapshot = await adminDb.collection('test-surveys')
        .where('isSubmitted', '==', true)
        .get();
      testSurveys = testSurveysSnapshot.docs.filter(
        doc => doc.data().userEmail !== userEmail
      );
    }
    
    otherUsersSurveys = [...regularSurveys, ...(showTestUsers ? testSurveys : [])];
  }

  // Convert to survey data format
  const otherUsersData = otherUsersSurveys.map(documentToSurveyData);
  
  // Filter out blocked users
  const nonBlockedUsers = [];
  for (const otherUserData of otherUsersData) {
    const [isSystemBlocked, isIndividuallyBlocked] = await Promise.all([
      isUserBlocked(otherUserData.userEmail!),
      isUserBlocked(otherUserData.userEmail!, userEmail)
    ]);
    
    if (!isSystemBlocked && !isIndividuallyBlocked) {
      nonBlockedUsers.push(otherUserData);
    }
  }
  
  // Calculate compatibility scores
  const minCompatibilityScore = testMinCompatibilityScore ?? DEFAULT_MIN_COMPATIBILITY_THRESHOLD;
  const compatibilityScores = await Promise.all(
    nonBlockedUsers.map(async (otherUserData) => {
      if(useEnhancedScoring) {
        return calculateEnhancedCompatibilityScore(userData, otherUserData, minCompatibilityScore);
      } else {
        const score = calculateCompatibilityScore(userData, otherUserData);
        if (score && score.score < minCompatibilityScore) {
          return null;
        }
        return score;
      }
    })
  );
  
  // Filter out nulls (failed calculations or below threshold)
  const validScores = compatibilityScores.filter(
    (score): score is CompatibilityScore => score !== null
  );
  
  // Sort by score (highest first)
  return validScores.sort((a, b) => b.score - a.score);
}

/**
 * Get top matches for a specific housing region
 */
export async function getTopMatchesByRegion(
  userEmail: string,
  region: string,
  limit: number = 10,
  useEnhancedScoring: boolean = true,
  testMinCompatibilityScore?: number,
  showTestUsers: boolean = false
): Promise<CompatibilityScore[]> {
  try {
    // Get the user's survey data
    const { userData: user } = await getUserSurveyData(userEmail);
    
    // Get all submitted surveys in the specified region except the current user
    let potentialMatchDocs = [];
    
    // Get regular surveys in the specified region
    const regularSurveysSnapshot = await adminDb.collection('surveys')
      .where('isSubmitted', '==', true)
      .where('housingRegion', '==', region)
      .get();
    const regularSurveys = regularSurveysSnapshot.docs.filter(
      doc => doc.data().userEmail !== userEmail
    );
    
    // Get test surveys in the specified region if showTestUsers is true
    let testSurveys: any[] = [];
    if (showTestUsers) {
      const testSurveysSnapshot = await adminDb.collection('test-surveys')
        .where('isSubmitted', '==', true)
        .where('housingRegion', '==', region)
        .get();
      testSurveys = testSurveysSnapshot.docs.filter(
        doc => doc.data().userEmail !== userEmail
      );
    }
    
    potentialMatchDocs = [...regularSurveys, ...(showTestUsers ? testSurveys : [])];
    
    // Filter out blocked users
    const nonBlockedDocs = [];
    for (const doc of potentialMatchDocs) {
      const [isSystemBlocked, isIndividuallyBlocked] = await Promise.all([
        isUserBlocked(doc.data().userEmail),
        isUserBlocked(doc.data().userEmail, userEmail)
      ]);
      
      if (!isSystemBlocked && !isIndividuallyBlocked) {
        nonBlockedDocs.push(doc);
      }
    }
    
    // Calculate compatibility scores
    let compatibilityScores: CompatibilityScore[] = [];
    
    // Process each potential match
    for (const matchDoc of nonBlockedDocs) {
      const match = documentToSurveyData(matchDoc);
      
      let score;
      if (useEnhancedScoring) {
        score = await calculateEnhancedCompatibilityScore(
          user, 
          match, 
          testMinCompatibilityScore
        );
      } else {
        score = calculateCompatibilityScore(user, match);
        
        // Use provided threshold if any, otherwise default to 50
        const effectiveThreshold = testMinCompatibilityScore !== undefined
          ? testMinCompatibilityScore
          : DEFAULT_MIN_COMPATIBILITY_THRESHOLD;
          
        if (score && score.score < effectiveThreshold) {
          score = null;
        }
      }
      
      if (score !== null) {
        compatibilityScores.push(score);
      }
    }
    
    // Sort by score (highest first) and limit
    return compatibilityScores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting top matches by region:', error);
    return [];
  }
}

/**
 * Compare two specific users and return detailed compatibility information
 */
export async function compareUsers(
  userEmail1: string,
  userEmail2: string,
  useEnhancedScoring: boolean = true,
  testMinCompatibilityScore?: number
): Promise<UserComparisonResult> {
  try {
    // Add check to prevent self-comparison
    if (userEmail1 === userEmail2) {
      throw new Error('Cannot compare a user with themselves');
    }

    // Check if either user is blocked (system-wide or individually)
    const [user1SystemBlocked, user2SystemBlocked, user1BlockedByUser2, user2BlockedByUser1] = await Promise.all([
      isUserBlocked(userEmail1),
      isUserBlocked(userEmail2),
      isUserBlocked(userEmail1, userEmail2),
      isUserBlocked(userEmail2, userEmail1)
    ]);

    if (user1SystemBlocked || user2SystemBlocked || user1BlockedByUser2 || user2BlockedByUser1) {
      throw new Error('One or both users are blocked');
    }
    
    // Get both users' survey data
    const { userData: user1 } = await getUserSurveyData(userEmail1);
    const { userData: user2 } = await getUserSurveyData(userEmail2);
    
    // Get constraint details
    const constraintDetails = getConstraintDetails(user1, user2);
    
    // Calculate overall constraints check - if all individual constraints are satisfied
    const passesHardConstraints = constraintDetails.genderCompatible && 
                               constraintDetails.regionMatch && 
                               constraintDetails.timingOverlap && 
                               constraintDetails.budgetCompatible && 
                               constraintDetails.roommatesCompatible && 
                               constraintDetails.preferencesCompatible;
    
    // Calculate compatibility score
    let score;
    if (useEnhancedScoring) {
      // Pass the adjustable threshold if provided
      score = await calculateEnhancedCompatibilityScore(
        user1, 
        user2, 
        testMinCompatibilityScore
      );
    } else {
      score = calculateCompatibilityScore(user1, user2);
      
      // Use provided threshold if any, otherwise default to 50
      const effectiveThreshold = testMinCompatibilityScore !== undefined
        ? testMinCompatibilityScore
        : DEFAULT_MIN_COMPATIBILITY_THRESHOLD;
        
      if (score && score.score < effectiveThreshold) {
        score = null;
      }
    }
    
    return {
      user1,
      user2,
      compatibilityScore: score,
      passesHardConstraints,
      constraintDetails
    };
  } catch (error) {
    console.error('Error comparing users:', error);
    throw new Error(`Failed to compare users: ${(error as Error).message}`);
  }
} 