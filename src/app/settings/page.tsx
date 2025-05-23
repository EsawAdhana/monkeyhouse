'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SurveyFormData } from '@/constants/survey-constants';
import { FiHome, FiUser, FiCalendar, FiUsers, FiList, FiStar, FiMapPin, FiEdit } from 'react-icons/fi';
import Image from 'next/image';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [surveyData, setSurveyData] = useState<SurveyFormData | null>(null);
  const [userData, setUserData] = useState<{ name?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // Format date helper function
  const formatDate = (date: Date): string => {
    // Create a new date using the UTC components to prevent timezone offset issues
    const utcDate = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
      )
    );
    
    return utcDate.toLocaleDateString('en-US', {
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      timeZone: 'UTC' // Force UTC timezone for display
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch survey data
        const surveyResponse = await fetch('/api/survey');
        const surveyResult = await surveyResponse.json();
        
        if (surveyResult.data) {
          setSurveyData(surveyResult.data);
        }

        // Fetch user profile data
        const userResponse = await fetch('/api/user/profile');
        const userResult = await userResponse.json();
        
        if (userResult.success && userResult.data) {
          setUserData(userResult.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (session?.user) {
      fetchData();
    }
  }, [session]);

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      setIsDeleting(true);
      try {
        const response = await fetch('/api/user', {
          method: 'DELETE',
        });
        
        const data = await response.json();
        
        if (response.ok) {
          await signOut({ callbackUrl: '/' });
        } else if (response.status === 404) {
          alert('Account data not found. You will be signed out.');
          await signOut({ callbackUrl: '/' });
        } else {
          throw new Error(data.error || 'Failed to delete account');
        }
      } catch (error) {
        console.error('Error deleting account:', error);
        alert(error instanceof Error ? error.message : 'Failed to delete account. Please try again.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!session) {
    router.push('/');
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:shadow-gray-700/20 mb-6">
          <div className="bg-indigo-50 dark:bg-indigo-900/30 px-5 py-3 rounded-t-lg">
            <h2 className="text-lg font-semibold text-indigo-900 dark:text-indigo-200">Your Housing Preferences</h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column - Basic Info, Location, Housing Details */}
              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-indigo-600 dark:text-indigo-400 mr-2">
                      <FiUsers className="inline" />
                    </span>
                    <h3 className="text-gray-900 dark:text-gray-100 font-medium">Basic Information</h3>
                  </div>
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4">
                    <div className="grid grid-cols-[1fr_auto] gap-y-2">
                      <div className="text-gray-600 dark:text-gray-300">First Name:</div>
                      <div className="text-right dark:text-gray-200">{(surveyData?.isSubmitted && surveyData.firstName) ? surveyData.firstName : (userData?.name || 'User')}</div>
                      
                      <div className="text-gray-600 dark:text-gray-300">Gender:</div>
                      <div className="text-right dark:text-gray-200">{surveyData?.gender || 'Not specified'}</div>
                      
                      <div className="text-gray-600 dark:text-gray-300">Room with Different Gender:</div>
                      <div className="text-right dark:text-gray-200">
                        {surveyData?.roomWithDifferentGender ? 'Yes' : 'No'}
                      </div>
                      
                      <div className="text-gray-600 dark:text-gray-300">Internship Company:</div>
                      <div className="text-right dark:text-gray-200">{surveyData?.internshipCompany || 'Not specified'}</div>
                    </div>
                  </div>
                </div>
                
                {/* Location */}
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-indigo-600 dark:text-indigo-400 mr-2">
                      <FiMapPin className="inline" />
                    </span>
                    <h3 className="text-gray-900 dark:text-gray-100 font-medium">Location</h3>
                  </div>
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4">
                    <div className="grid grid-cols-[1fr_auto] gap-y-2">
                      <div className="text-gray-600 dark:text-gray-300">Region:</div>
                      <div className="text-right dark:text-gray-200">{surveyData?.housingRegion || 'Not specified'}</div>
                      
                      <div className="text-gray-600 dark:text-gray-300">Cities:</div>
                      <div className="text-right dark:text-gray-200">
                        {surveyData?.housingCities?.length 
                          ? surveyData.housingCities.join(', ') 
                          : 'Not specified'
                        }
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Housing Details */}
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-indigo-600 dark:text-indigo-400 mr-2">
                      <FiCalendar className="inline" />
                    </span>
                    <h3 className="text-gray-900 dark:text-gray-100 font-medium">Housing Details</h3>
                  </div>
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4">
                    <div className="grid grid-cols-[1fr_auto] gap-y-2">
                      <div className="text-gray-600 dark:text-gray-300">Housing Start:</div>
                      <div className="text-right dark:text-gray-200">
                        {surveyData?.internshipStartDate 
                          ? formatDate(new Date(surveyData.internshipStartDate)) 
                          : 'Not specified'
                        }
                      </div>
                      
                      <div className="text-gray-600 dark:text-gray-300">Housing End:</div>
                      <div className="text-right dark:text-gray-200">
                        {surveyData?.internshipEndDate 
                          ? formatDate(new Date(surveyData.internshipEndDate))
                          : 'Not specified'
                        }
                      </div>
                      
                      <div className="text-gray-600 dark:text-gray-300">Monthly Budget:</div>
                      <div className="text-right dark:text-gray-200">
                        ${surveyData?.minBudget || 0} - ${surveyData?.maxBudget || 0}
                      </div>
                      
                      <div className="text-gray-600 dark:text-gray-300">Desired Roommates:</div>
                      <div className="text-right dark:text-gray-200">{surveyData?.desiredRoommates || 'Not specified'}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Right Column - Preferences and Additional Notes */}
              <div className="space-y-6">
                {/* Preferences */}
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-indigo-600 dark:text-indigo-400 mr-2">
                      <FiList className="inline" />
                    </span>
                    <h3 className="text-gray-900 dark:text-gray-100 font-medium">Preferences</h3>
                  </div>
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4">
                    <div className="space-y-2">
                      {surveyData?.preferences.map(pref => {
                        let badge = "";
                        
                        switch(pref.strength) {
                          case "neutral":
                            badge = "neutral";
                            break;
                          case "prefer not":
                            badge = "prefer not";
                            break;
                          case "must have":
                            badge = "must have";
                            break;
                          default:
                            badge = pref.strength;
                        }
                        
                        return (
                          <div key={pref.item} className="flex justify-between items-center py-1">
                            <span className="dark:text-gray-200">{pref.item}</span>
                            <span className="text-xs bg-gray-100 dark:bg-gray-600 dark:text-gray-200 px-2 py-0.5 rounded">{badge}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                {/* Additional Notes */}
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-indigo-600 dark:text-indigo-400 mr-2">
                      <FiEdit className="inline" />
                    </span>
                    <h3 className="text-gray-900 dark:text-gray-100 font-medium">Additional Notes</h3>
                  </div>
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4">
                    <p className="text-gray-600 dark:text-gray-200 whitespace-pre-wrap">
                      {surveyData?.additionalNotes || 'No additional notes provided'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:shadow-gray-700/20 p-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Account Settings</h2>
          
          <div className="mb-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white dark:border-gray-600 shadow-lg">
                <Image
                  src={session?.user?.image || '/default-avatar.png'}
                  alt={userData?.name || session.user?.email?.split('@')[0] || 'Profile'}
                  layout="fill"
                  objectFit="cover"
                />
              </div>
              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-100">{(surveyData?.isSubmitted && surveyData.firstName) ? surveyData.firstName : (userData?.name || 'User')}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{session?.user?.email}</p>
              </div>
            </div>
            
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Account Management</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Deleting your account will permanently remove all your data, including your profile and survey responses.
              </p>
              
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-red-500 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-red-500 dark:border-red-400 border-t-transparent rounded-full"></span>
                    Deleting Account...
                  </>
                ) : (
                  'Delete Account'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 