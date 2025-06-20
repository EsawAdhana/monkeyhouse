import { SurveyFormData } from '@/constants/survey-constants';
import { compareUsers } from './recommendations';

/**
 * Debug compatibility between two users by logging detailed information
 */
export async function debugCompatibility(userEmail1: string, userEmail2: string): Promise<void> {
  try {
    // Only log in development environment
    if (process.env.NODE_ENV !== 'production') {
      console.log(`===== DEBUG COMPATIBILITY =====`);
      console.log(`Comparing users: ${userEmail1} and ${userEmail2}`);

      // Get detailed comparison with enhanced scoring
      const comparison = await compareUsers(userEmail1, userEmail2, true);
      
      // Log user profiles
      console.log('\n--- USER 1 PROFILE ---');
      console.log(JSON.stringify(comparison.user1, null, 2));
      
      console.log('\n--- USER 2 PROFILE ---');
      console.log(JSON.stringify(comparison.user2, null, 2));
      
      // Log constraints details
      console.log('\n--- CONSTRAINT DETAILS ---');
      console.log('Passes hard constraints:', comparison.passesHardConstraints);
      console.log(JSON.stringify(comparison.constraintDetails, null, 2));
      
      // Log compatibility score if any
      if (comparison.compatibilityScore) {
        console.log('\n--- COMPATIBILITY SCORE ---');
        console.log('Overall Score:', comparison.compatibilityScore.score.toFixed(2));
        console.log('Score Details:', JSON.stringify(comparison.compatibilityScore.compatibilityDetails, null, 2));
        
        if (comparison.compatibilityScore.explanations?.additionalNotesExplanation) {
          console.log('\n--- ADDITIONAL NOTES ANALYSIS ---');
          console.log(comparison.compatibilityScore.explanations.additionalNotesExplanation);
        }
      } else {
        console.log('\n--- NO COMPATIBILITY SCORE ---');
        console.log('Users are not compatible based on hard constraints or fall below minimum threshold');
      }
      
      console.log('\n===== END DEBUG COMPATIBILITY =====');
    }
    
    // Always perform the comparison for return data, just don't log in production
    await compareUsers(userEmail1, userEmail2, true);
  } catch (error) {
    console.error('Error in debug compatibility:', error);
    throw error;
  }
} 