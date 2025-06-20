'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import MultiPageSurvey from '@/components/survey/MultiPageSurvey';

interface User {
  email: string;
  name: string;
}

interface TestResult {
  user1: string;
  user2: string;
  score: number;
  details: {
    [key: string]: number;
  };
  explanation?: string;
}

interface DebugInfo {
  surveyCount: number;
  dbStatus?: {
    connected: boolean;
    dbName: string | null;
  };
  collections?: string[];
}

// Allowed admin emails for testing access
const ALLOWED_TESTING_EMAILS = ['adhanaesaw@gmail.com'];

export default function TestingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [testUsers, setTestUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingUsers, setAddingUsers] = useState(false);
  const [deletingUsers, setDeletingUsers] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [resultsFilter, setResultsFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loadingDebug, setLoadingDebug] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    connected?: boolean;
    dbName?: string;
    collectionCount?: number;
    message?: string;
  } | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  
  // New states for enhanced testing functionality
  const [numUsersToAdd, setNumUsersToAdd] = useState<number>(10);
  const [centralUser, setCentralUser] = useState<string | null>(null);
  const [minCompatibilityScore, setMinCompatibilityScore] = useState<number>(50);
  const [compatibilityResults, setCompatibilityResults] = useState<any[]>([]);
  const [loadingCompatibility, setLoadingCompatibility] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] = useState<any>(null);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  
  // New states for custom user creation
  const [showCustomUserForm, setShowCustomUserForm] = useState(false);
  const [addingCustomUser, setAddingCustomUser] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [customUserData, setCustomUserData] = useState({
    name: '',
    email: '',
    gender: 'Male',
    roomWithDifferentGender: false,
    housingRegion: 'Bay Area',
    housingCities: ['San Francisco'],
    internshipCompany: '',
    internshipStartDate: '',
    internshipEndDate: '',
    desiredRoommates: '2',
    minBudget: 1500,
    maxBudget: 2500,
    additionalNotes: '',
    preferences: [
      { item: "Okay with pets", strength: "neutral" },
      { item: "Okay with alcohol", strength: "neutral" },
      { item: "Okay with parties", strength: "neutral" },
      { item: "Okay with visitors", strength: "neutral" },
      { item: "Okay with visitors staying overnight", strength: "neutral" },
      { item: "LGBTQ+/Ally", strength: "neutral" },
    ],
    numCopies: 1
  });
  
  const [notesError, setNotesError] = useState<string>('');
  
  useEffect(() => {
    // Only redirect if not authenticated (don't check for survey completion)
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }
    
    // Check if user has access to testing functionality
    if (status === 'authenticated') {
      if (!session?.user?.email || !ALLOWED_TESTING_EMAILS.includes(session.user.email)) {
        router.push('/dashboard');
        return;
      }
    }
    
    // Fetch test users if authenticated and authorized
    if (status === 'authenticated') {
      fetchDebugInfo()
        .then(() => {
          // After debug info is loaded, fetch test users
          return fetchTestUsers();
        })
        .catch(error => {
          console.error('Error in initial load:', error);
          setError(`Initial loading failed: ${error instanceof Error ? error.message : String(error)}`);
          setLoading(false);
        });
    }
  }, [status, router]);
  
  const fetchTestUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const response = await fetch('/api/testing/fetch-test-users');
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch test users: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.users) {
        setTestUsers(data.users);
      } else {
        setError(`Error: ${data.error || 'Unknown error fetching test users'}`);
      }
    } catch (error) {
      console.error('Error fetching test users:', error);
      setError(`Error fetching test users: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchDebugInfo = async () => {
    try {
      setLoadingDebug(true);
      setError(null);
      setSuccess(null);
      
      // Set timeout for this particular request - reduced to 10 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout
      
      const response = await fetch('/api/testing/debug', {
        signal: controller.signal
      }).catch(error => {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out after 10 seconds. The database may be unavailable.');
        }
        throw error;
      });
      
      // Clear the timeout since the request completed
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let errorText = 'Unknown error';
        try {
          // Try to get the response text, but don't break if it fails
          errorText = await response.text();
        } catch (e) {
          console.error('Failed to get error text:', e);
        }
        throw new Error(`Failed to fetch debug info: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      let data;
      try {
        data = await response.json();
      } catch (error) {
        console.error('Failed to parse response as JSON:', error);
        throw new Error(`Invalid response format: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      setDebugInfo(data);
      setSuccess('Database status check completed successfully');
      
      // After successfully fetching debug info, we can set loading to false
      setLoading(false);
      
      return data; // Return the data for any callers that need it
    } catch (error) {
      console.error('Error fetching debug info:', error);
      setError(`Error fetching debug info: ${error instanceof Error ? error.message : String(error)}`);
      // Make sure to set loading to false here too, so we don't get stuck
      setLoading(false);
      throw error; // Rethrow to allow caller to handle
    } finally {
      setLoadingDebug(false);
    }
  };
  
  const addTestUsers = async () => {
    try {
      setAddingUsers(true);
      setError(null);
      setSuccess(null);
      const response = await fetch('/api/testing/add-test-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ numUsers: numUsersToAdd }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add test users: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Success! Show verification counts
        setError(null);
        // Show success message with counts
        setSuccess(`Successfully added ${data.count || numUsersToAdd} test users.`);
        // Directly fetch debug info which now includes test users
        fetchDebugInfo();
        // Fetch test users for the UI
        fetchTestUsers();
        // Clear any previous results
        setTestResults([]);
        setSelectedUsers([]);
        setCompatibilityResults([]);
        setCentralUser(null);
      } else {
        setError(`Error adding test users: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding test users:', error);
      setError(`Error adding test users: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setAddingUsers(false);
    }
  };
  
  const deleteTestUsers = async () => {
    if (!confirm('Are you sure you want to delete all test users? This action cannot be undone.')) {
      return;
    }
    
    try {
      setDeletingUsers(true);
      setError(null);
      setSuccess(null);
      const response = await fetch('/api/testing/delete-test-users', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete test users: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Clear test users from UI
        setTestUsers([]);
        setTestResults([]);
        setSelectedUsers([]);
        
        // Show success message with deletion counts
        setSuccess(`Successfully deleted ${data.deletedCounts?.surveys || 0} test surveys.`);
        
        // Update debug info to show current counts
        fetchDebugInfo();
      } else {
        setError(`Error deleting test users: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting test users:', error);
      setError(`Error deleting test users: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setDeletingUsers(false);
    }
  };
  
  const toggleUserSelection = (email: string) => {
    setSelectedUsers(prev => 
      prev.includes(email) 
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };
  
  const selectRandomUsers = (count: number) => {
    if (testUsers.length <= count) {
      setSelectedUsers(testUsers.map(u => u.email));
      return;
    }
    
    const shuffled = [...testUsers].sort(() => 0.5 - Math.random());
    setSelectedUsers(shuffled.slice(0, count).map(u => u.email));
  };
  
  const calculateTestScores = async () => {
    try {
      setCalculating(true);
      setError(null);
      const results: TestResult[] = [];
      
      const usersToTest = selectedUsers.length > 0 
        ? testUsers.filter(user => selectedUsers.includes(user.email)) 
        : testUsers;
      
      // Calculate scores for each pair
      const totalPairs = (usersToTest.length * (usersToTest.length - 1)) / 2;
      let processedPairs = 0;
      
      for (let i = 0; i < usersToTest.length; i++) {
        for (let j = i + 1; j < usersToTest.length; j++) {
          const user1 = usersToTest[i];
          const user2 = usersToTest[j];
          
          const response = await fetch(`/api/testing/calculate-score?email1=${encodeURIComponent(user1.email)}&email2=${encodeURIComponent(user2.email)}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.score !== null) {
              results.push({
                user1: user1.name,
                user2: user2.name,
                score: data.score,
                details: data.details,
                explanation: data.explanation
              });
            }
          }
          
          processedPairs++;
          // Update every 10 pairs or on last pair
          if (processedPairs % 10 === 0 || processedPairs === totalPairs) {
            setTestResults([...results]);
          }
        }
      }
      
      setTestResults(results);
    } catch (error) {
      console.error('Error calculating scores:', error);
      setError(`Error calculating scores: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setCalculating(false);
    }
  };
  
  // Filter users based on search term
  const filteredUsers = testUsers.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Filter results based on selection
  const filteredResults = testResults.filter(result => {
    if (resultsFilter === 'all') return true;
    const scoreVal = result.score;
    
    switch (resultsFilter) {
      case 'high': return scoreVal >= 80;
      case 'medium': return scoreVal >= 60 && scoreVal < 80;
      case 'low': return scoreVal < 60;
      default: return true;
    }
  });
  
  // Sort results by score (highest first)
  const sortedResults = [...filteredResults].sort((a, b) => b.score - a.score);
  
  const checkConnection = async () => {
    try {
      setCheckingConnection(true);
      setError(null);
      setSuccess(null);
      
      // Set timeout for quick connection check
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout
      
      // Simple, quick connection check
      const response = await fetch('/api/testing/check-connection', {
        signal: controller.signal
      }).catch(error => {
        if (error.name === 'AbortError') {
          throw new Error('Connection check timed out after 8 seconds. The database may be unavailable.');
        }
        throw error;
      });
      
      // Clear the timeout since the request completed
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let errorText = 'Unknown error';
        try {
          errorText = await response.text();
        } catch (e) {
          console.error('Failed to get error text:', e);
        }
        throw new Error(`Connection check failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setConnectionStatus({
          connected: data.connection.connected,
          dbName: data.connection.dbName,
          collectionCount: data.connection.collectionCount,
          message: `Connected to ${data.connection.dbName} with ${data.connection.collectionCount} collections`
        });
        
        setSuccess('Database connection successful');
        
        // If connection is successful but we're still in loading state, 
        // we might have other issues, so let users see the main UI
        if (loading) {
          setLoading(false);
        }
      } else {
        throw new Error(data.error || 'Unknown connection error');
      }
    } catch (error) {
      setConnectionStatus({
        connected: false,
        message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`
      });
      setError(`Connection check failed: ${error instanceof Error ? error.message : String(error)}`);
      // Make sure to set loading to false here too, so we don't get stuck
      if (loading) {
        setLoading(false);
      }
    } finally {
      setCheckingConnection(false);
    }
  };
  
  // Add function to calculate compatibility for a central user
  const calculateCentralUserCompatibility = async () => {
    if (!centralUser) {
      setError('Please select a central user first');
      return;
    }
    
    try {
      setLoadingCompatibility(true);
      setError(null);
      setSuccess(null);
      
      const response = await fetch(`/api/testing/user-compatibility?user=${encodeURIComponent(centralUser)}&minScore=${minCompatibilityScore}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to calculate compatibility: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      setCompatibilityResults(data.compatibleUsers || []);
      setSuccess(`Found ${data.compatibleUsers.length} compatible users out of ${data.totalUsersChecked} total users`);
    } catch (error) {
      setError(`Error calculating compatibility: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingCompatibility(false);
    }
  };
  
  // Modify the viewUserDetails function to also fetch central user data when needed
  const viewUserDetails = async (userEmail: string) => {
    try {
      setLoadingUserDetails(true);
      setError(null);
      
      // If we have a central user and it's not the same as the user being viewed,
      // we should load both users' details for comparison
      if (centralUser && centralUser !== userEmail) {
        // Get both users in parallel
        const [userResponse, centralUserResponse] = await Promise.all([
          fetch(`/api/testing/get-test-user?userEmail=${encodeURIComponent(userEmail)}`),
          fetch(`/api/testing/get-test-user?userEmail=${encodeURIComponent(centralUser)}`)
        ]);
        
        if (!userResponse.ok) {
          const errorText = await userResponse.text();
          throw new Error(`Failed to get user details: ${userResponse.status} ${userResponse.statusText} - ${errorText}`);
        }
        
        if (!centralUserResponse.ok) {
          const errorText = await centralUserResponse.text();
          throw new Error(`Failed to get central user details: ${centralUserResponse.status} ${centralUserResponse.statusText} - ${errorText}`);
        }
        
        const userData = await userResponse.json();
        const centralUserData = await centralUserResponse.json();
        
        setSelectedUserDetails({
          user: userData.user,
          centralUser: centralUserData.user,
          // Also find compatibility score if we have compatibility results
          compatibilityScore: compatibilityResults.find(r => r.user.email === userEmail)
        });
      } else {
        // Just get the single user (either there's no central user or we're viewing the central user)
        const response = await fetch(`/api/testing/get-test-user?userEmail=${encodeURIComponent(userEmail)}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get user details: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const data = await response.json();
        
        setSelectedUserDetails({
          user: data.user
        });
      }
    } catch (error) {
      setError(`Error getting user details: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingUserDetails(false);
    }
  };
  
  // Function to set a user as the central user
  const setCentralUserHandler = (userEmail: string) => {
    setCentralUser(userEmail);
    setCompatibilityResults([]);
    setSuccess(`Set ${userEmail} as central user. Calculate compatibility to see matches.`);
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      
      // Create a new date using UTC components to prevent timezone offset issues
      const utcDate = new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate()
        )
      );
      
      return utcDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        timeZone: 'UTC' // Force UTC timezone for display
      });
    } catch (e) {
      return dateString || 'N/A';
    }
  };
  
  // Format preferences for display
  const formatPreferences = (preferences: any[]) => {
    if (!Array.isArray(preferences) || preferences.length === 0) {
      return 'No preferences set';
    }
    
    return preferences.map(pref => 
      `${pref.item}: ${pref.strength}`
    ).join(', ');
  };
  
  // Add a new function for handling custom user form changes
  const handleCustomUserInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setCustomUserData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'housingCities') {
      // Handle multi-select for cities
      const options = (e.target as HTMLSelectElement).options;
      const selectedCities: string[] = [];
      for (let i = 0; i < options.length; i++) {
        if (options[i].selected) {
          selectedCities.push(options[i].value);
        }
      }
      setCustomUserData(prev => ({ ...prev, [name]: selectedCities }));
    } else if (name.startsWith('preference_')) {
      // Handle preference strength changes
      const [_, preferenceIndex] = name.split('_');
      const index = parseInt(preferenceIndex, 10);
      
      const updatedPreferences = [...customUserData.preferences];
      updatedPreferences[index] = {
        ...updatedPreferences[index],
        strength: value
      };
      
      setCustomUserData(prev => ({
        ...prev,
        preferences: updatedPreferences
      }));
    } else if (name === 'numCopies') {
      const numValue = parseInt(value);
      if (!isNaN(numValue) && numValue > 0 && numValue <= 100) {
        setCustomUserData(prev => ({ ...prev, [name]: numValue }));
      }
    } else {
      setCustomUserData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  // Handle survey submission
  const handleSurveySubmit = (surveyData: any) => {
    // Extract the form data from the survey component
    // and merge it with our custom user data
    setAddingCustomUser(true);
    setError(null);
    setSuccess(null);
    
    if (!customUserData.name || !customUserData.email) {
      setError('Name and email are required for custom test users');
      setAddingCustomUser(false);
      return;
    }
    
    try {
      // Prepare the data for submission - merge the survey data with our custom user data
      const mergedData = {
        ...surveyData,
        name: customUserData.name,
        email: customUserData.email,
        numCopies: customUserData.numCopies
      };
      
      // Submit the data
      fetch('/api/testing/add-custom-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mergedData),
      })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            throw new Error(`Failed to add custom test user: ${response.status} ${response.statusText} - ${text}`);
          });
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          setSuccess(data.message || 'Custom test user added successfully');
          
          // Reset the form
          setCustomUserData({
            name: '',
            email: '',
            gender: 'Male',
            roomWithDifferentGender: false,
            housingRegion: 'Bay Area',
            housingCities: ['San Francisco'],
            internshipCompany: '',
            internshipStartDate: '',
            internshipEndDate: '',
            desiredRoommates: '2',
            minBudget: 1500,
            maxBudget: 2500,
            additionalNotes: '',
            preferences: [
              { item: "Okay with pets", strength: "neutral" },
              { item: "Okay with alcohol", strength: "neutral" },
              { item: "Okay with parties", strength: "neutral" },
              { item: "Okay with visitors", strength: "neutral" },
              { item: "Okay with visitors staying overnight", strength: "neutral" },
              { item: "LGBTQ+/Ally", strength: "neutral" },
            ],
            numCopies: 1
          });
          
          // Refresh the test users list
          fetchDebugInfo();
          fetchTestUsers();
          setShowCustomUserForm(false);
          setShowSurveyModal(false);
        } else {
          setError(`Error adding custom test user: ${data.error || 'Unknown error'}`);
        }
      })
      .catch(error => {
        console.error('Error adding custom test user:', error);
        setError(`Error adding custom test user: ${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => {
        setAddingCustomUser(false);
      });
    } catch (error) {
      console.error('Error processing survey data:', error);
      setError(`Error processing survey data: ${error instanceof Error ? error.message : String(error)}`);
      setAddingCustomUser(false);
    }
  };
  
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Recommendation Engine Testing</h1>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 mb-4">Loading... {connectionStatus?.message && `(${connectionStatus.message})`}</p>
            
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={checkConnection}
                disabled={checkingConnection}
                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 disabled:bg-yellow-300"
              >
                {checkingConnection ? 'Checking Connection...' : 'Quick Connection Check'}
              </button>
              
              <button
                onClick={() => {
                  setLoading(false);
                  setError(null);
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Skip Loading &amp; Show UI
              </button>
            </div>
            
            {error && (
              <>
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                  <p className="font-medium">Error:</p>
                  <p className="text-sm">{error}</p>
                </div>
                <div className="flex flex-wrap gap-3 mb-4">
                  <button 
                    onClick={() => {
                      setLoading(true);
                      setError(null);
                      fetchDebugInfo().catch(err => {
                        setError(`Retry failed: ${err instanceof Error ? err.message : String(err)}`);
                        setLoading(false);
                      });
                    }}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Retry Loading
                  </button>
                  
                  <button
                    onClick={() => {
                      setLoading(false); // Stop loading mode to show the main UI
                      setError(null);
                    }}
                    className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                  >
                    Skip Loading
                  </button>
                  
                  <button
                    onClick={() => addTestUsers()}
                    disabled={addingUsers}
                    className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:bg-purple-300"
                  >
                    {addingUsers ? 'Adding Test Users...' : 'Add Test Users'}
                  </button>
                  
                  <button
                    onClick={() => {
                      setLoading(false); // Stop loading mode
                      fetchDebugInfo()
                        .then(() => fetchTestUsers())
                        .catch(err => console.error('Error fetching data:', err));
                    }}
                    disabled={loadingDebug}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-green-300"
                  >
                    {loadingDebug ? 'Checking...' : 'Check Database Status'}
                  </button>
                </div>
              </>
            )}
            
            {connectionStatus && (
              <div className={`mt-4 p-3 rounded border ${connectionStatus.connected ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <h3 className="font-medium mb-2">Database Connection Status:</h3>
                <div className="text-sm">
                  <p>Connected: <span className="font-mono">{connectionStatus.connected ? 'Yes' : 'No'}</span></p>
                  {connectionStatus.dbName && <p>Database: <span className="font-mono">{connectionStatus.dbName}</span></p>}
                  {connectionStatus.collectionCount !== undefined && <p>Collections: <span className="font-mono">{connectionStatus.collectionCount}</span></p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Testing Dashboard</h1>
      
      {/* Display errors and success messages */}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}
      
      {/* User Management Section */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Test User Management</h2>
        
        {/* Test user generation controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="numUsers" className="text-sm font-medium text-gray-700">
              Number of random test users to add:
            </label>
            <input
              type="number"
              id="numUsers"
              min="1"
              max="100"
              value={numUsersToAdd}
              onChange={(e) => setNumUsersToAdd(parseInt(e.target.value) || 10)}
              className="border border-gray-300 rounded p-2 w-full"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={addTestUsers}
              disabled={addingUsers}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded disabled:bg-blue-400"
            >
              {addingUsers ? 'Adding...' : 'Add Random Test Users'}
            </button>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => setShowSurveyModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
            >
              Add Custom Test User
            </button>
          </div>
          
          <div className="flex items-end ml-auto">
            <button
              onClick={deleteTestUsers}
              disabled={deletingUsers}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded disabled:bg-red-400"
            >
              {deletingUsers ? 'Deleting...' : 'Delete All Test Users'}
            </button>
          </div>
        </div>
        
        {/* Survey Modal */}
        {showSurveyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-screen overflow-y-auto">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="text-xl font-semibold">Create Test User</h3>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium mb-1">
                      Name*
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={customUserData.name}
                      onChange={handleCustomUserInputChange}
                      className="border border-gray-300 rounded p-2"
                      required
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium mb-1">
                      Email*
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={customUserData.email}
                      onChange={handleCustomUserInputChange}
                      className="border border-gray-300 rounded p-2"
                      required
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium mb-1">
                      Copies
                    </label>
                    <input
                      type="number"
                      name="numCopies"
                      min="1"
                      max="100"
                      value={customUserData.numCopies}
                      onChange={handleCustomUserInputChange}
                      className="border border-gray-300 rounded p-2 w-20"
                    />
                  </div>
                  <button 
                    onClick={() => setShowSurveyModal(false)}
                    className="text-gray-500 hover:text-gray-700 ml-4"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-4">
                <MultiPageSurvey 
                  onSubmitSuccess={(formData) => {
                    handleSurveySubmit(formData);
                  }}
                  isEditing={false}
                  isTestMode={true}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Custom user form - only show when not using survey modal */}
        {showCustomUserForm && !showSurveyModal && (
          <div className="bg-gray-100 p-4 rounded-lg mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">Add Custom Test User</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Basic info fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name*
                </label>
                <input
                  type="text"
                  name="name"
                  value={customUserData.name}
                  onChange={handleCustomUserInputChange}
                  className="border border-gray-300 rounded p-2 w-full"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email*
                </label>
                <input
                  type="email"
                  name="email"
                  value={customUserData.email}
                  onChange={handleCustomUserInputChange}
                  className="border border-gray-300 rounded p-2 w-full"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Internship Company
                </label>
                <input
                  type="text"
                  name="internshipCompany"
                  value={customUserData.internshipCompany}
                  onChange={handleCustomUserInputChange}
                  className="border border-gray-300 rounded p-2 w-full"
                  placeholder="Enter company name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  name="gender"
                  value={customUserData.gender}
                  onChange={handleCustomUserInputChange}
                  className="border border-gray-300 rounded p-2 w-full"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="roomWithDifferentGender"
                  name="roomWithDifferentGender"
                  checked={customUserData.roomWithDifferentGender}
                  onChange={handleCustomUserInputChange}
                  className="h-4 w-4 mr-2"
                />
                <label htmlFor="roomWithDifferentGender" className="text-sm font-medium text-gray-700">
                  Willing to room with different gender
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Housing Region
                </label>
                <select
                  name="housingRegion"
                  value={customUserData.housingRegion}
                  onChange={handleCustomUserInputChange}
                  className="border border-gray-300 rounded p-2 w-full"
                >
                  <option value="Bay Area">Bay Area</option>
                  <option value="Seattle Area">Seattle Area</option>
                  <option value="New York Area">New York Area</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Desired Roommates
                </label>
                <select
                  name="desiredRoommates"
                  value={customUserData.desiredRoommates}
                  onChange={handleCustomUserInputChange}
                  className="border border-gray-300 rounded p-2 w-full"
                >
                  <option value="1">1 roommate</option>
                  <option value="2">2 roommates</option>
                  <option value="3">3 roommates</option>
                  <option value="4+">4+ roommates</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Internship Start Date
                </label>
                <input
                  type="date"
                  name="internshipStartDate"
                  value={customUserData.internshipStartDate}
                  onChange={handleCustomUserInputChange}
                  className="border border-gray-300 rounded p-2 w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Internship End Date
                </label>
                <input
                  type="date"
                  name="internshipEndDate"
                  value={customUserData.internshipEndDate}
                  onChange={handleCustomUserInputChange}
                  className="border border-gray-300 rounded p-2 w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Rent ($)
                </label>
                <input
                  type="number"
                  name="minBudget"
                  value={customUserData.minBudget}
                  onChange={handleCustomUserInputChange}
                  min="500"
                  step="100"
                  className="border border-gray-300 rounded p-2 w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Rent ($)
                </label>
                <input
                  type="number"
                  name="maxBudget"
                  value={customUserData.maxBudget}
                  onChange={handleCustomUserInputChange}
                  min={customUserData.minBudget}
                  step="100"
                  className="border border-gray-300 rounded p-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Copies
                </label>
                <input
                  type="number"
                  name="numCopies"
                  min="1"
                  max="100"
                  value={customUserData.numCopies}
                  onChange={handleCustomUserInputChange}
                  className="border border-gray-300 rounded p-2 w-full"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Create multiple identical users with numbered suffixes
                </p>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                name="additionalNotes"
                value={customUserData.additionalNotes}
                onChange={handleCustomUserInputChange}
                className={`border ${
                  notesError ? 'border-red-500' : 'border-gray-300'
                } rounded p-2 w-full h-24`}
                placeholder="Enter any additional information that might affect compatibility..."
              />
              {notesError && (
                <p className="mt-1 text-sm text-red-500">{notesError}</p>
              )}
            </div>
            
            {/* Preferences Section */}
            <div className="mb-4">
              <h4 className="text-md font-medium text-gray-800 mb-2">Preferences</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customUserData.preferences.map((preference, index) => (
                  <div key={index} className="flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {preference.item}
                    </label>
                    <select
                      name={`preference_${index}`}
                      value={preference.strength}
                      onChange={handleCustomUserInputChange}
                      className="border border-gray-300 rounded p-2"
                    >
                      <option value="deal breaker">Deal Breaker</option>
                      <option value="prefer not">Prefer Not</option>
                      <option value="neutral">Neutral</option>
                      <option value="prefer">Prefer</option>
                      <option value="must have">Must Have</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => {
                  handleSurveySubmit(customUserData);
                }}
                disabled={addingCustomUser || !customUserData.name || !customUserData.email}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded disabled:bg-green-400"
              >
                {addingCustomUser ? 'Adding...' : 'Add Custom User'}
              </button>
            </div>
          </div>
        )}
        
        {/* Test Users List */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Test Users</h2>
          
          {loading ? (
            <p>Loading test users...</p>
          ) : (
            <>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search users..."
                  className="border p-2 rounded w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {testUsers.length === 0 ? (
                <p>No test users found. Add some test users to get started.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 border">Email</th>
                        <th className="px-4 py-2 border">Name</th>
                        <th className="px-4 py-2 border">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testUsers
                        .filter(user => 
                          searchTerm === '' || 
                          user.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          user.name.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .slice(0, showAllUsers ? undefined : 10)
                        .map(user => (
                          <tr key={user.email} className={centralUser === user.email ? "bg-blue-100" : ""}>
                            <td className="px-4 py-2 border">{user.email}</td>
                            <td className="px-4 py-2 border">{user.name}</td>
                            <td className="px-4 py-2 border">
                              <button
                                className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
                                onClick={() => setCentralUserHandler(user.email)}
                              >
                                Set as Central
                              </button>
                              <button
                                className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                                onClick={() => viewUserDetails(user.email)}
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  
                  {testUsers.length > 10 && !showAllUsers && (
                    <button
                      className="mt-2 px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                      onClick={() => setShowAllUsers(true)}
                    >
                      Show All ({testUsers.length})
                    </button>
                  )}
                  
                  {showAllUsers && (
                    <button
                      className="mt-2 px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                      onClick={() => setShowAllUsers(false)}
                    >
                      Show Less
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Compatibility Testing Section */}
        {centralUser && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Compatibility Testing</h2>
            
            <div className="mb-4">
              <p><strong>Central User:</strong> {centralUser}</p>
              <div className="flex items-center mt-2">
                <label className="mr-2">Minimum Compatibility Score:</label>
                <input 
                  type="number" 
                  value={minCompatibilityScore} 
                  onChange={(e) => setMinCompatibilityScore(Math.max(0, Math.min(100, parseInt(e.target.value) || 50)))} 
                  className="border p-2 rounded mr-2"
                  min="0"
                  max="100"
                />
                <span>%</span>
              </div>
              
              <button
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={calculateCentralUserCompatibility}
                disabled={loadingCompatibility}
              >
                {loadingCompatibility ? 'Calculating...' : 'Calculate Compatibility'}
              </button>
            </div>
            
            {/* Compatibility Results */}
            {compatibilityResults.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Compatible Users ({compatibilityResults.length})</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 border">User</th>
                        <th className="px-4 py-2 border">Compatibility Score</th>
                        <th className="px-4 py-2 border">Location Score</th>
                        <th className="px-4 py-2 border">Budget Score</th>
                        <th className="px-4 py-2 border">Timing Score</th>
                        <th className="px-4 py-2 border">Preferences Score</th>
                        <th className="px-4 py-2 border">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compatibilityResults.map((result, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 border">{result.user.email}</td>
                          <td className="px-4 py-2 border">{result.score.toFixed(1)}%</td>
                          <td className="px-4 py-2 border">{result.details.locationScore.toFixed(1)}%</td>
                          <td className="px-4 py-2 border">{result.details.budgetScore.toFixed(1)}%</td>
                          <td className="px-4 py-2 border">{result.details.timingScore.toFixed(1)}%</td>
                          <td className="px-4 py-2 border">{result.details.preferencesScore.toFixed(1)}%</td>
                          <td className="px-4 py-2 border">
                            <button
                              className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                              onClick={() => viewUserDetails(result.user.email)}
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* User Details Modal - Keep clean white styling */}
      {selectedUserDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
          <div className="bg-white p-6 rounded-lg max-w-5xl w-full max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {selectedUserDetails.centralUser ? 'User Comparison' : `User Details: ${selectedUserDetails.user.name || selectedUserDetails.user.email}`}
              </h2>
              <button 
                className="text-2xl text-gray-600"
                onClick={() => setSelectedUserDetails(null)}
              >
                ×
              </button>
            </div>
            
            {selectedUserDetails.centralUser ? (
              // Side-by-side comparison view
              <>
                {selectedUserDetails.compatibilityScore && (
                  <div className="bg-blue-50 p-4 mb-4 rounded-lg">
                    <h3 className="font-semibold text-lg mb-2">Compatibility Score: {selectedUserDetails.compatibilityScore.score.toFixed(1)}%</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                      <div className="bg-white p-2 rounded">
                        <div className="font-medium">Location</div>
                        <div className="text-lg">{selectedUserDetails.compatibilityScore.details.locationScore.toFixed(1)}%</div>
                      </div>
                      <div className="bg-white p-2 rounded">
                        <div className="font-medium">Budget</div>
                        <div className="text-lg">{selectedUserDetails.compatibilityScore.details.budgetScore.toFixed(1)}%</div>
                      </div>
                      <div className="bg-white p-2 rounded">
                        <div className="font-medium">Timing</div>
                        <div className="text-lg">{selectedUserDetails.compatibilityScore.details.timingScore.toFixed(1)}%</div>
                      </div>
                      <div className="bg-white p-2 rounded">
                        <div className="font-medium">Preferences</div>
                        <div className="text-lg">{selectedUserDetails.compatibilityScore.details.preferencesScore.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Central User Column */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-lg mb-3 text-blue-800">Central User: {selectedUserDetails.centralUser.name || selectedUserDetails.centralUser.email}</h3>
                    
                    <div className="grid gap-4">
                      <div>
                        <h4 className="font-semibold">Basic Information</h4>
                        <p><strong>Email:</strong> {selectedUserDetails.centralUser.email}</p>
                        <p><strong>Name:</strong> {selectedUserDetails.centralUser.name}</p>
                        <p><strong>Gender:</strong> {selectedUserDetails.centralUser.surveyData.gender || 'N/A'}</p>
                        <p><strong>Room with Different Gender:</strong> {selectedUserDetails.centralUser.surveyData.roomWithDifferentGender ? 'Yes' : 'No'}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold">Housing Details</h4>
                        <p><strong>Region:</strong> {selectedUserDetails.centralUser.surveyData.housingRegion || 'N/A'}</p>
                        <p><strong>Cities:</strong> {selectedUserDetails.centralUser.surveyData.housingCities?.join(', ') || 'N/A'}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold">Housing Details</h4>
                        <p><strong>Housing Start:</strong> {formatDate(selectedUserDetails.centralUser.surveyData.internshipStartDate)}</p>
                        <p><strong>Housing End:</strong> {formatDate(selectedUserDetails.centralUser.surveyData.internshipEndDate)}</p>
                        <p><strong>Desired Roommates:</strong> {selectedUserDetails.centralUser.surveyData.desiredRoommates || 'N/A'}</p>
                        <p><strong>Monthly Rent:</strong> ${selectedUserDetails.centralUser.surveyData.minBudget?.toLocaleString() || 'N/A'} - ${selectedUserDetails.centralUser.surveyData.maxBudget?.toLocaleString() || 'N/A'}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold">Preferences</h4>
                        <div className="mt-1">
                          {selectedUserDetails.centralUser.surveyData.preferences?.map((pref: any, index: number) => (
                            <div key={index} className="mb-1">
                              <strong>{pref.item}:</strong> {pref.strength}
                            </div>
                          )) || 'No preferences set'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Compared User Column */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-lg mb-3">Compared User: {selectedUserDetails.user.name || selectedUserDetails.user.email}</h3>
                    
                    <div className="grid gap-4">
                      <div>
                        <h4 className="font-semibold">Basic Information</h4>
                        <p><strong>Email:</strong> {selectedUserDetails.user.email}</p>
                        <p><strong>Name:</strong> {selectedUserDetails.user.name}</p>
                        <p><strong>Gender:</strong> {selectedUserDetails.user.surveyData.gender || 'N/A'}</p>
                        <p><strong>Room with Different Gender:</strong> {selectedUserDetails.user.surveyData.roomWithDifferentGender ? 'Yes' : 'No'}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold">Housing Details</h4>
                        <p><strong>Region:</strong> {selectedUserDetails.user.surveyData.housingRegion || 'N/A'}</p>
                        <p><strong>Cities:</strong> {selectedUserDetails.user.surveyData.housingCities?.join(', ') || 'N/A'}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold">Housing Details</h4>
                        <p><strong>Housing Start:</strong> {formatDate(selectedUserDetails.user.surveyData.internshipStartDate)}</p>
                        <p><strong>Housing End:</strong> {formatDate(selectedUserDetails.user.surveyData.internshipEndDate)}</p>
                        <p><strong>Desired Roommates:</strong> {selectedUserDetails.user.surveyData.desiredRoommates || 'N/A'}</p>
                        <p><strong>Monthly Rent:</strong> ${selectedUserDetails.user.surveyData.minBudget?.toLocaleString() || 'N/A'} - ${selectedUserDetails.user.surveyData.maxBudget?.toLocaleString() || 'N/A'}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold">Preferences</h4>
                        <div className="mt-1">
                          {selectedUserDetails.user.surveyData.preferences?.map((pref: any, index: number) => (
                            <div key={index} className="mb-1">
                              <strong>{pref.item}:</strong> {pref.strength}
                            </div>
                          )) || 'No preferences set'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Enhance the additional notes section */}
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h3 className="font-semibold text-lg mb-3 text-yellow-800">Additional Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-yellow-700">Central User Notes</h4>
                      <p className="mt-2 p-3 bg-white rounded border border-yellow-100">
                        {selectedUserDetails.centralUser.surveyData.additionalNotes || 'No additional notes provided'}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-yellow-700">Compared User Notes</h4>
                      <p className="mt-2 p-3 bg-white rounded border border-yellow-100">
                        {selectedUserDetails.user.surveyData.additionalNotes || 'No additional notes provided'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-white rounded border border-yellow-100">
                    <h4 className="font-semibold text-yellow-700 mb-2">How Additional Notes Affect Compatibility</h4>
                    <p className="text-sm text-gray-700">
                      After finding compatible matches based on structured criteria (location, budget, gender, timing, preferences),
                      the system analyzes the additional notes to adjust the compatibility score by up to ±10%.
                    </p>
                    <p className="text-sm text-gray-700 mt-2">
                      <strong>Important:</strong> If the adjustment would lower a user's compatibility below the minimum threshold 
                      (currently {minCompatibilityScore}%), that user will not appear in your matches.
                    </p>
                    {selectedUserDetails.compatibilityScore?.details?.additionalInfoScore !== undefined && (
                      <div className="mt-3 p-2 rounded bg-yellow-50">
                        <p className="text-sm flex items-center">
                          <span className="font-medium">Note analysis impact:</span>
                          <span className="ml-2">
                            {((selectedUserDetails.compatibilityScore.details.additionalInfoScore - 50) / 5).toFixed(1)}% adjustment
                            {selectedUserDetails.compatibilityScore.details.additionalInfoScore > 50 ? 
                              " (positive)" : selectedUserDetails.compatibilityScore.details.additionalInfoScore < 50 ? 
                              " (negative)" : " (neutral)"}
                          </span>
                        </p>
                        {selectedUserDetails.compatibilityScore.explanation && (
                          <div className="mt-2 p-2 bg-white rounded border border-yellow-100">
                            <h5 className="font-medium text-yellow-800 text-sm">LLM Analysis:</h5>
                            <p className="text-sm text-gray-700 mt-1">
                              {selectedUserDetails.compatibilityScore.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t flex justify-between">
                  <button
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    onClick={() => {
                      setCentralUserHandler(selectedUserDetails.user.email);
                      setSelectedUserDetails(null);
                    }}
                  >
                    Set as Central User
                  </button>
                  <button
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    onClick={() => setSelectedUserDetails(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              // Single user view - update additional notes section
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">Basic Information</h3>
                    <p><strong>Email:</strong> {selectedUserDetails.user.email}</p>
                    <p><strong>Name:</strong> {selectedUserDetails.user.name}</p>
                    <p><strong>Gender:</strong> {selectedUserDetails.user.surveyData.gender || 'N/A'}</p>
                    <p><strong>Room with Different Gender:</strong> {selectedUserDetails.user.surveyData.roomWithDifferentGender ? 'Yes' : 'No'}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg">Housing Details</h3>
                    <p><strong>Region:</strong> {selectedUserDetails.user.surveyData.housingRegion || 'N/A'}</p>
                    <p><strong>Cities:</strong> {selectedUserDetails.user.surveyData.housingCities?.join(', ') || 'N/A'}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg">Housing Details</h3>
                    <p><strong>Housing Start:</strong> {formatDate(selectedUserDetails.user.surveyData.internshipStartDate)}</p>
                    <p><strong>Housing End:</strong> {formatDate(selectedUserDetails.user.surveyData.internshipEndDate)}</p>
                    <p><strong>Desired Roommates:</strong> {selectedUserDetails.user.surveyData.desiredRoommates || 'N/A'}</p>
                    <p><strong>Monthly Rent:</strong> ${selectedUserDetails.user.surveyData.minBudget?.toLocaleString() || 'N/A'} - ${selectedUserDetails.user.surveyData.maxBudget?.toLocaleString() || 'N/A'}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg">Preferences</h3>
                    <div className="mt-2">
                      {selectedUserDetails.user.surveyData.preferences?.map((pref: any, index: number) => (
                        <div key={index} className="mb-1">
                          <strong>{pref.item}:</strong> {pref.strength}
                        </div>
                      )) || 'No preferences set'}
                    </div>
                  </div>
                  
                  <div className="md:col-span-2 mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h3 className="font-semibold text-lg text-yellow-800">Additional Notes</h3>
                    <p className="mt-2 p-3 bg-white rounded border border-yellow-100">
                      {selectedUserDetails.user.surveyData.additionalNotes || 'No additional notes provided'}
                    </p>
                    <div className="mt-4 p-3 bg-white rounded border border-yellow-100">
                      <h4 className="font-semibold text-yellow-700 mb-2">How Additional Notes Affect Compatibility</h4>
                      <p className="text-sm text-gray-700">
                        After finding compatible matches based on structured criteria (location, budget, gender, timing, preferences),
                        the system analyzes the additional notes to adjust the compatibility score by up to ±10%.
                      </p>
                      <p className="text-sm text-gray-700 mt-2">
                        <strong>Important:</strong> If the adjustment would lower a user's compatibility below the minimum threshold,
                        that user will not appear in your matches.
                      </p>
                    </div>
                  </div>
                </div>
                
                {centralUser && centralUser !== selectedUserDetails.user.email && (
                  <div className="mt-4 pt-4 border-t">
                    <button
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      onClick={() => {
                        setCentralUserHandler(selectedUserDetails.user.email);
                        setSelectedUserDetails(null);
                      }}
                    >
                      Set as Central User
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      
      {/* ... existing testing tools ... */}
    </div>
  );
} 