"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { HOUSING_REGIONS, PREFERENCE_ITEMS, PREFERENCE_LABELS, PreferenceRating, SurveyFormData } from "@/constants/survey-constants";

interface SurveyFormProps {
  onSubmitSuccess?: () => void;
}

export default function SurveyForm({ onSubmitSuccess }: SurveyFormProps) {
  const { data: session } = useSession();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [customCity, setCustomCity] = useState("");
  const [showCustomCityInput, setShowCustomCityInput] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  
  const [formData, setFormData] = useState<SurveyFormData>({
    gender: "",
    roomWithDifferentGender: false,
    housingRegion: "",
    housingCities: [],
    internshipStartDate: "",
    internshipEndDate: "",
    internshipCompany: "",
    sameCompanyOnly: false,
    desiredRoommates: "1",
    monthlyBudget: 1500,
    preferences: {},
    additionalNotes: "",
    submitted: false,
  });
  
  // Form input handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // If housing region changed, update available cities
    if (name === "housingRegion") {
      setAvailableCities(HOUSING_REGIONS[value as keyof typeof HOUSING_REGIONS] || []);
      setFormData(prev => ({ ...prev, housingCities: [] })); // Reset selected cities
    }
    
    // Date validation when either internship date is changed
    if (name === "internshipStartDate" || name === "internshipEndDate") {
      const updatedFormData = { ...formData, [name]: value };
      
      if (updatedFormData.internshipStartDate && updatedFormData.internshipEndDate) {
        const startDate = new Date(updatedFormData.internshipStartDate);
        const endDate = new Date(updatedFormData.internshipEndDate);
        
        // Display warning if dates are in wrong order
        if (startDate > endDate) {
          // We're just warning, not preventing input, since the min/max attributes and validation will handle enforcement
          console.warn("Warning: Start date is after end date");
        }
      }
    }
  };
  
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };
  
  const handleMultiSelectChange = (field: "housingCities", value: string, checked: boolean) => {
    setFormData(prev => {
      if (checked) {
        // Add the value if it's not already in the array
        return {
          ...prev,
          [field]: [...prev[field], value]
        };
      } else {
        // Remove the value from the array
        return {
          ...prev,
          [field]: prev[field].filter(item => item !== value)
        };
      }
    });
  };

  // Handle adding a custom city
  const handleAddCustomCity = () => {
    if (!customCity.trim()) return;
    
    // Check if the city is already in the list
    if (formData.housingCities.includes(customCity)) {
      alert("This city is already in your list");
      return;
    }
    
    // Add the custom city to selected cities
    setFormData(prev => ({
      ...prev,
      housingCities: [...prev.housingCities, customCity]
    }));
    
    // Reset the input and hide it
    setCustomCity("");
    setShowCustomCityInput(false);
  };

  // Navigation functions
  const goToNextStep = () => {
    if (currentStep < totalSteps) {
      // Validate the current step before proceeding
      if (validateStep(currentStep)) {
        setCurrentStep(currentStep + 1);
        // Clear validation errors when moving to next step
        setValidationErrors({});
      }
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      // Clear validation errors when going back
      setValidationErrors({});
    }
  };

  // Step-specific validation
  const validateStep = (step: number): boolean => {
    const errors: { [key: string]: string } = {};
    
    switch (step) {
      case 1: // Basic Info
        if (!formData.gender) {
          errors.gender = "Please select your gender";
        }
        break;
      case 2: // Housing Preferences
        if (!formData.housingRegion) {
          errors.housingRegion = "Please select a housing region";
        }
        if (formData.housingCities.length === 0) {
          errors.housingCities = "Please select at least one city";
        }
        break;
      case 3: // Internship Details
        if (!formData.internshipStartDate) {
          errors.internshipStartDate = "Please select your internship start date";
        }
        if (!formData.internshipEndDate) {
          errors.internshipEndDate = "Please select your internship end date";
        }
        if (!formData.internshipCompany) {
          errors.internshipCompany = "Please enter your internship company";
        }
        if (formData.internshipStartDate && formData.internshipEndDate) {
          const startDate = new Date(formData.internshipStartDate);
          const endDate = new Date(formData.internshipEndDate);
          if (startDate > endDate) {
            errors.internshipEndDate = "End date cannot be before start date";
          }
        }
        break;
      case 4: // Roommate Preferences
        if (!formData.desiredRoommates) {
          errors.desiredRoommates = "Please select number of desired roommates";
        }
        if (!formData.monthlyBudget) {
          errors.monthlyBudget = "Please enter your monthly budget";
        }
        break;
      case 5: // Additional Preferences
        // No required fields in this step
        break;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Fetch existing data
  useEffect(() => {
    const fetchSurvey = async () => {
      if (!session) return;
      
      try {
        setLoading(true);
        const response = await fetch("/api/survey");
        const result = await response.json();
        
        if (response.ok && result.data) {
          const surveyData = result.data;
          
          // Set the housing region first to update available cities
          if (surveyData.housingRegion) {
            setFormData(prev => ({ ...prev, housingRegion: surveyData.housingRegion }));
            setAvailableCities(HOUSING_REGIONS[surveyData.housingRegion as keyof typeof HOUSING_REGIONS] || []);
          }
          
          setFormData({
            gender: surveyData.gender || "",
            roomWithDifferentGender: surveyData.roomWithDifferentGender || false,
            housingRegion: surveyData.housingRegion || "",
            housingCities: surveyData.housingCities || [],
            internshipStartDate: surveyData.internshipStartDate ? new Date(surveyData.internshipStartDate).toISOString().split("T")[0] : "",
            internshipEndDate: surveyData.internshipEndDate ? new Date(surveyData.internshipEndDate).toISOString().split("T")[0] : "",
            internshipCompany: surveyData.internshipCompany || "",
            sameCompanyOnly: surveyData.sameCompanyOnly || false,
            desiredRoommates: surveyData.desiredRoommates || "1",
            monthlyBudget: surveyData.monthlyBudget || 1500,
            preferences: surveyData.preferences || {},
            additionalNotes: surveyData.additionalNotes || "",
            submitted: surveyData.submitted || false,
          });
        }
      } catch (error) {
        console.error("Error fetching survey data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSurvey();
  }, [session]);

  // Update the handleSubmit function to handle partial submissions
  const handleSubmit = async (e: React.FormEvent, finalSubmit: boolean = false) => {
    e.preventDefault();
    
    // Validate current step before saving
    if (!validateStep(currentStep)) {
      return; // Don't save if validation fails
    }
    
    // Only validate date range if both dates are present
    if (formData.internshipStartDate && formData.internshipEndDate) {
      const startDate = new Date(formData.internshipStartDate);
      const endDate = new Date(formData.internshipEndDate);
      
      if (startDate > endDate) {
        setValidationErrors(prev => ({
          ...prev,
          internshipEndDate: "End date cannot be before start date"
        }));
        return;
      }
    }
    
    setSaving(true);
    
    try {
      // Create a copy of the formData
      const dataToSubmit = { ...formData, submitted: finalSubmit };
      
      // For non-final submissions, we need to tell the server to accept partial data
      const endpoint = finalSubmit ? "/api/survey" : "/api/survey?partial=true";
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSubmit),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        if (finalSubmit) {
          setFormData(prev => ({ ...prev, submitted: true }));
          
          // Call the onSubmitSuccess callback if provided
          if (onSubmitSuccess) {
            onSubmitSuccess();
          }
        }
      } 
    } finally {
      setSaving(false);
    }
  };

  // Handle preference rating changes
  const handlePreferenceChange = (item: string, rating: PreferenceRating) => {
    setFormData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [item]: rating
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-md mb-4"></div>
          <div className="h-64 w-full max-w-2xl bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (formData.submitted) {
    return (
      <div className="max-w-3xl mx-auto p-8 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30 rounded-xl shadow-md">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Survey Completed!</h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Thank you for completing your internship housing survey. We'll use this information to help match you with potential roommates.
          </p>
        </div>
      </div>
    );
  }

  // Progress bar
  const ProgressBar = () => {
    return (
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Step {currentStep} of {totalSteps}</span>
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{Math.round((currentStep / totalSteps) * 100)}% Complete</span>
        </div>
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-300 ease-in-out"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          ></div>
        </div>
      </div>
    );
  };

  // Step content based on current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Tell us about yourself</h3>
            
            <div className="space-y-6">
              {/* Gender selection */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block" htmlFor="gender">
                  What is your gender? *
                </label>
                <select
                  id="gender"
                  name="gender"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-3 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={formData.gender}
                  onChange={handleInputChange}
                >
                  <option value="" disabled>Select your gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-Binary">Non-Binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
                {validationErrors.gender && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.gender}</p>
                )}
              </div>
              
              {/* Rooming preference */}
              <div className="p-4 bg-[var(--checkbox-bg)] rounded-lg border border-[var(--checkbox-border)]">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="roomWithDifferentGender"
                    name="roomWithDifferentGender"
                    checked={formData.roomWithDifferentGender}
                    onChange={handleCheckboxChange}
                    className="mr-3 h-5 w-5 rounded-md border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <label htmlFor="roomWithDifferentGender" className="text-gray-800 dark:text-gray-200 font-medium">
                    I am willing to room with someone of a different gender
                  </label>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Where would you like to live?</h3>
            
            <div className="space-y-6">
              {/* Housing region */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block" htmlFor="housingRegion">
                  Select your preferred region *
                </label>
                <select
                  id="housingRegion"
                  name="housingRegion"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-3 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={formData.housingRegion}
                  onChange={handleInputChange}
                >
                  <option value="" disabled>Select a region</option>
                  {Object.keys(HOUSING_REGIONS).map(region => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
                {validationErrors.housingRegion && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.housingRegion}</p>
                )}
              </div>
              
              {/* Cities selection */}
              {formData.housingRegion && (
                <div className="p-5 bg-[var(--checkbox-bg)] rounded-lg border border-[var(--checkbox-border)]">
                  {formData.housingRegion === "Other" ? (
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block" htmlFor="otherLocation">
                        Please specify your location:
                      </label>
                      <input
                        type="text"
                        id="otherLocation"
                        name="otherLocation"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-3 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Enter your specific location"
                        value={formData.housingCities[0] || ""}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          housingCities: [e.target.value]
                        }))}
                      />
                    </div>
                  ) : availableCities.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select cities you're interested in:</p>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {availableCities.map(city => (
                          <div key={city} className="relative">
                            <input
                              type="checkbox"
                              id={`city-${city}`}
                              checked={formData.housingCities.includes(city)}
                              onChange={(e) => handleMultiSelectChange("housingCities", city, e.target.checked)}
                              className="peer absolute opacity-0 h-0 w-0"
                            />
                            <label 
                              htmlFor={`city-${city}`} 
                              className="flex p-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors peer-checked:border-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/30"
                            >
                              <span className="text-gray-800 dark:text-gray-200">{city}</span>
                            </label>
                          </div>
                        ))}
                      </div>
                      
                      {/* Custom city section */}
                      {showCustomCityInput ? (
                        <div className="mt-4">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block" htmlFor="customCity">
                            Add a custom city:
                          </label>
                          <div className="flex">
                            <input
                              type="text"
                              id="customCity"
                              className="flex-1 rounded-l-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-3 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              placeholder="Enter city name"
                              value={customCity}
                              onChange={(e) => setCustomCity(e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={handleAddCustomCity}
                              className="rounded-r-lg bg-blue-500 hover:bg-blue-600 px-5 text-white transition-colors"
                            >
                              Add
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCustomCityInput(false);
                              setCustomCity("");
                            }}
                            className="mt-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowCustomCityInput(true)}
                          className="mt-4 flex items-center text-blue-500 hover:text-blue-700 font-medium"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                          Add another city not listed
                        </button>
                      )}
                      
                      {/* Display selected custom cities */}
                      {formData.housingCities.filter(city => !availableCities.includes(city)).length > 0 && (
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Your custom cities:</p>
                          <div className="flex flex-wrap gap-2">
                            {formData.housingCities.filter(city => !availableCities.includes(city)).map(city => (
                              <div key={city} className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900 px-3 py-1.5 text-sm text-blue-800 dark:text-blue-200">
                                {city}
                                <button
                                  type="button"
                                  onClick={() => handleMultiSelectChange("housingCities", city, false)}
                                  className="ml-2 rounded-full bg-blue-200 dark:bg-blue-700 text-blue-600 dark:text-blue-300 h-5 w-5 flex items-center justify-center hover:bg-blue-300 dark:hover:bg-blue-600"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Internship Details</h3>
            
            <div className="space-y-6">
              {/* Company */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block" htmlFor="internshipCompany">
                  Which company are you interning for? *
                </label>
                <input
                  type="text"
                  id="internshipCompany"
                  name="internshipCompany"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-3 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={formData.internshipCompany}
                  onChange={handleInputChange}
                  placeholder="Enter company name"
                />
                {validationErrors.internshipCompany && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.internshipCompany}</p>
                )}
              </div>
              
              {/* Same company preference */}
              <div className="p-4 bg-[var(--checkbox-bg)] rounded-lg border border-[var(--checkbox-border)]">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="sameCompanyOnly"
                    name="sameCompanyOnly"
                    checked={formData.sameCompanyOnly}
                    onChange={handleCheckboxChange}
                    className="mr-3 h-5 w-5 rounded-md border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <label htmlFor="sameCompanyOnly" className="text-gray-800 dark:text-gray-200 font-medium">
                    I only want to room with interns from my same company
                  </label>
                </div>
              </div>

              {/* Dates */}
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block" htmlFor="internshipStartDate">
                    Internship Start Date *
                  </label>
                  <input
                    type="date"
                    id="internshipStartDate"
                    name="internshipStartDate"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-3 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={formData.internshipStartDate}
                    onChange={handleInputChange}
                    max={formData.internshipEndDate || undefined}
                  />
                  {validationErrors.internshipStartDate && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.internshipStartDate}</p>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block" htmlFor="internshipEndDate">
                    Internship End Date *
                  </label>
                  <input
                    type="date"
                    id="internshipEndDate"
                    name="internshipEndDate"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-3 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={formData.internshipEndDate}
                    onChange={handleInputChange}
                    min={formData.internshipStartDate || undefined}
                  />
                  {validationErrors.internshipEndDate && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.internshipEndDate}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Housing Preferences</h3>
            
            <div className="space-y-6">
              {/* Roommates */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block" htmlFor="desiredRoommates">
                  How many roommates are you looking for? *
                </label>
                <div className="flex flex-wrap gap-3">
                  {["1", "2", "3", "4+"].map((num) => (
                    <div key={num} className="flex-1 min-w-[100px]">
                      <input 
                        type="radio" 
                        name="desiredRoommates" 
                        id={`roommates-${num}`}
                        value={num}
                        checked={formData.desiredRoommates === num}
                        onChange={handleInputChange}
                        className="peer sr-only"
                      />
                      <label 
                        htmlFor={`roommates-${num}`} 
                        className="flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700 peer-checked:border-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/30 text-center"
                      >
                        <span className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-1">{num}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {num === "1" ? "Roommate" : "Roommates"}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
                {validationErrors.desiredRoommates && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.desiredRoommates}</p>
                )}
              </div>
              
              {/* Budget slider */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block" htmlFor="monthlyBudget">
                  What is YOUR individual monthly budget? (${formData.monthlyBudget}/month) *
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  This is how much YOU want to pay, not the total for your housing group.
                </p>
                <input
                  type="range"
                  id="monthlyBudget"
                  name="monthlyBudget"
                  min="500"
                  max="5000"
                  step="100"
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  value={formData.monthlyBudget}
                  onChange={handleInputChange}
                />
                <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>&lt; $500</span>
                  <span>$2,750</span>
                  <span>&gt; $5,000</span>
                </div>
                {validationErrors.monthlyBudget && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.monthlyBudget}</p>
                )}
              </div>
              
              {/* Preferences section */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">What are your preferences on these topics?</p>
                <p className="mb-4 text-sm italic text-gray-500 dark:text-gray-400">
                  Select your comfort level for each item. You can add more details on the next page.
                </p>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left px-2 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 w-1/3">Topic</th>
                        {Object.entries(PREFERENCE_LABELS).map(([key, label]) => (
                          <th key={key} className="px-2 py-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PREFERENCE_ITEMS.map((item) => (
                        <tr key={item} className="border-t border-gray-200 dark:border-gray-700">
                          <td className="px-2 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">{item}</td>
                          {(["must_have", "prefer", "neutral", "prefer_not", "deal_breaker"] as PreferenceRating[]).map((rating) => (
                            <td key={rating} className="px-2 py-3 text-center">
                              <div className="flex justify-center">
                                <input
                                  type="radio"
                                  id={`${item}-${rating}`}
                                  name={`preference-${item}`}
                                  checked={formData.preferences[item] === rating}
                                  onChange={() => handlePreferenceChange(item, rating)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-600"
                                />
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 5:
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Additional Information</h3>
            
            <div className="space-y-6">
              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block" htmlFor="additionalNotes">
                  Anything else you'd like potential roommates to know about you?
                </label>
                <textarea
                  id="additionalNotes"
                  name="additionalNotes"
                  rows={6}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-3 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={formData.additionalNotes}
                  onChange={handleInputChange}
                  placeholder="Share your additional preferences about lifestyle, hobbies, sleep schedule, etc..."
                />
              </div>
              
              {/* Survey summary */}
              <div className="p-4 bg-[var(--checkbox-bg)] rounded-lg border border-[var(--checkbox-border)]">
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Survey Summary</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li><span className="font-medium">Gender:</span> {formData.gender}</li>
                  <li><span className="font-medium">Region:</span> {formData.housingRegion}</li>
                  <li><span className="font-medium">Cities:</span> {formData.housingCities.join(", ")}</li>
                  <li><span className="font-medium">Company:</span> {formData.internshipCompany}</li>
                  <li><span className="font-medium">Same Company Only:</span> {formData.sameCompanyOnly ? "Yes" : "No"}</li>
                  <li><span className="font-medium">Roommates:</span> {formData.desiredRoommates}</li>
                  <li><span className="font-medium">Budget:</span> ${formData.monthlyBudget}/month</li>
                  <li>
                    <span className="font-medium">Key Preferences:</span>{" "}
                    {Object.entries(formData.preferences)
                      .filter(([_, rating]) => rating === "must_have" || rating === "deal_breaker")
                      .map(([item, rating]) => `${item} (${PREFERENCE_LABELS[rating]})`)
                      .join(", ") || "None"}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-gradient-to-br from-[var(--survey-gradient-from)] to-[var(--survey-gradient-to)] p-6 md:p-8 rounded-xl shadow-md">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Find Your Perfect Roommate</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">Tell us about your preferences to match with compatible roommates for your internship.</p>
        
        <ProgressBar />
        
        <form onSubmit={(e) => handleSubmit(e, true)}>
          {renderStepContent()}
          
          <div className="mt-8 flex justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={goToPreviousStep}
                className="flex items-center px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Back
              </button>
            ) : (
              <div></div>
            )}
            
            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={() => {
                  // Validate current step before proceeding
                  if (validateStep(currentStep)) {
                    // Auto-save when proceeding to next step
                    handleSubmit({ preventDefault: () => {} } as React.FormEvent, false);
                    goToNextStep();
                  }
                }}
                className="flex items-center px-5 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              >
                Continue
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            ) : (
              <div className="space-x-4">
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, false)}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    "Submit Survey"
                  )}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}