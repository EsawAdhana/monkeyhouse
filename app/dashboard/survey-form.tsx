"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { HOUSING_REGIONS, NON_NEGOTIABLES, SurveyFormData } from "@/constants/survey-constants";

interface SurveyFormProps {
  onSubmitSuccess?: () => void;
}

export default function SurveyForm({ onSubmitSuccess }: SurveyFormProps) {
  const { data: session } = useSession();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [customCity, setCustomCity] = useState("");
  const [showCustomCityInput, setShowCustomCityInput] = useState(false);
  const [formData, setFormData] = useState<SurveyFormData>({
    gender: "",
    roomWithDifferentGender: false,
    housingRegion: "",
    housingCities: [],
    internshipStartDate: "",
    internshipEndDate: "",
    desiredRoommates: "1",
    monthlyBudget: 1500,
    nonNegotiables: [],
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
  };
  
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };
  
  const handleMultiSelectChange = (field: "housingCities" | "nonNegotiables", value: string, checked: boolean) => {
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

  // Fetch existing data
  useEffect(() => {
    const fetchSurvey = async () => {
      if (!session) return;
      
      try {
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
            desiredRoommates: surveyData.desiredRoommates || "1",
            monthlyBudget: surveyData.monthlyBudget || 1500,
            nonNegotiables: surveyData.nonNegotiables || [],
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

  // Submit handler
  const handleSubmit = async (e: React.FormEvent, finalSubmit: boolean = false) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const response = await fetch("/api/survey", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          submitted: finalSubmit,
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        if (finalSubmit) {
          setFormData(prev => ({ ...prev, submitted: true }));
          alert("Survey submitted successfully!");
          
          // Call the onSubmitSuccess callback if provided
          if (onSubmitSuccess) {
            onSubmitSuccess();
          }
        } else {
          alert("Survey saved successfully!");
        }
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Error saving survey:", error);
      alert("Failed to save survey");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-4 text-center text-gray-800 dark:text-gray-200">Loading survey...</div>;
  }

  if (formData.submitted) {
    return (
      <div className="rounded-lg p-6 text-center bg-success shadow-lg">
        <h2 className="mb-2 text-xl font-semibold">Survey Completed</h2>
        <p>Thank you for completing your internship survey!</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg">
      <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Internship Housing Survey</h2>
      
      <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-6">
        {/* Gender and Rooming Preference */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Gender */}
          <div>
            <label className="mb-2 block font-medium text-gray-900 dark:text-gray-100" htmlFor="gender">
              What is your gender? *
            </label>
            <select
              id="gender"
              name="gender"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={formData.gender}
              onChange={handleInputChange}
              required
            >
              <option value="" disabled>Select your gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-Binary">Non-Binary</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
          
          {/* Room with different gender */}
          <div className="flex items-center h-full pt-8">
            <input
              type="checkbox"
              id="roomWithDifferentGender"
              name="roomWithDifferentGender"
              checked={formData.roomWithDifferentGender}
              onChange={handleCheckboxChange}
              className="mr-2 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <label htmlFor="roomWithDifferentGender" className="text-gray-900 dark:text-gray-100">
              I am willing to room with someone of a different gender
            </label>
          </div>
        </div>
        
        {/* Housing Location */}
        <div>
          <label className="mb-2 block font-medium text-gray-900 dark:text-gray-100" htmlFor="housingRegion">
            Where are you looking to dorm? *
          </label>
          <select
            id="housingRegion"
            name="housingRegion"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 mb-4"
            value={formData.housingRegion}
            onChange={handleInputChange}
            required
          >
            <option value="" disabled>Select a region</option>
            {Object.keys(HOUSING_REGIONS).map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
          
          {formData.housingRegion && (
            <div>
              {formData.housingRegion === "Other" ? (
                <div>
                  <label className="mb-2 block font-medium text-gray-900 dark:text-gray-100" htmlFor="otherLocation">
                    Please specify your location:
                  </label>
                  <input
                    type="text"
                    id="otherLocation"
                    name="otherLocation"
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                  <p className="mb-2 font-medium text-gray-900 dark:text-gray-100">Select specific cities you're interested in:</p>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {availableCities.map(city => (
                      <div key={city} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`city-${city}`}
                          checked={formData.housingCities.includes(city)}
                          onChange={(e) => handleMultiSelectChange("housingCities", city, e.target.checked)}
                          className="mr-2 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                        />
                        <label htmlFor={`city-${city}`} className="text-gray-900 dark:text-gray-100">{city}</label>
                      </div>
                    ))}
                  </div>
                  
                  {/* Custom city section */}
                  {showCustomCityInput ? (
                    <div className="mt-4">
                      <label className="mb-2 block font-medium text-gray-900 dark:text-gray-100" htmlFor="customCity">
                        Add a custom city:
                      </label>
                      <div className="flex mt-1">
                        <input
                          type="text"
                          id="customCity"
                          className="flex-1 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          placeholder="Enter city name"
                          value={customCity}
                          onChange={(e) => setCustomCity(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomCity}
                          className="rounded-r-md bg-blue-500 hover:bg-blue-600 px-4 text-white"
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
                      className="mt-3 flex items-center text-blue-500 hover:text-blue-700"
                    >
                      <span className="mr-1">+</span> Add another city not listed
                    </button>
                  )}
                  
                  {/* Display selected custom cities */}
                  {formData.housingCities.filter(city => !availableCities.includes(city)).length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Your custom cities:</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {formData.housingCities.filter(city => !availableCities.includes(city)).map(city => (
                          <div key={city} className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900 px-3 py-1 text-sm text-blue-800 dark:text-blue-200">
                            {city}
                            <button
                              type="button"
                              onClick={() => handleMultiSelectChange("housingCities", city, false)}
                              className="ml-2 text-blue-500 hover:text-blue-700 focus:outline-none"
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
        
        {/* Internship Dates */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Start Date */}
          <div>
            <label className="mb-2 block font-medium text-gray-900 dark:text-gray-100" htmlFor="internshipStartDate">
              Internship Start Date *
          </label>
          <input
            type="date"
            id="internshipStartDate"
            name="internshipStartDate"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={formData.internshipStartDate}
            onChange={handleInputChange}
            required
          />
        </div>
        
          {/* End Date */}
          <div>
            <label className="mb-2 block font-medium text-gray-900 dark:text-gray-100" htmlFor="internshipEndDate">
              Internship End Date *
          </label>
            <input
              type="date"
              id="internshipEndDate"
              name="internshipEndDate"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={formData.internshipEndDate}
            onChange={handleInputChange}
            required
            />
          </div>
        </div>
        
        {/* Roommates and Budget */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Number of Roommates */}
          <div>
            <label className="mb-2 block font-medium text-gray-900 dark:text-gray-100" htmlFor="desiredRoommates">
              How many roommates are you looking for? *
          </label>
          <select
              id="desiredRoommates"
              name="desiredRoommates"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={formData.desiredRoommates}
            onChange={handleInputChange}
            required
          >
              <option value="1">1 roommate</option>
              <option value="2">2 roommates</option>
              <option value="3">3 roommates</option>
              <option value="4+">4+ roommates</option>
          </select>
        </div>
        
          {/* Monthly Budget */}
          <div>
            <label className="mb-2 block font-medium text-gray-900 dark:text-gray-100" htmlFor="monthlyBudget">
              What is your monthly budget? ($ per month) *
          </label>
            <input
              type="number"
              id="monthlyBudget"
              name="monthlyBudget"
              min="0"
              step="100"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={formData.monthlyBudget}
            onChange={handleInputChange}
            required
            />
          </div>
        </div>
        
        {/* Non-negotiables */}
        <div>
          <p className="mb-2 block font-medium text-gray-900 dark:text-gray-100">Select your non-negotiables:</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {NON_NEGOTIABLES.map(item => (
              <div key={item} className="flex items-center">
                <input
                  type="checkbox"
                  id={`non-negotiable-${item}`}
                  checked={formData.nonNegotiables.includes(item)}
                  onChange={(e) => handleMultiSelectChange("nonNegotiables", item, e.target.checked)}
                  className="mr-2 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <label htmlFor={`non-negotiable-${item}`} className="text-gray-900 dark:text-gray-100">{item}</label>
              </div>
            ))}
          </div>
        </div>
        
        {/* Additional Notes */}
        <div>
          <label className="mb-2 block font-medium text-gray-900 dark:text-gray-100" htmlFor="additionalNotes">
            Additional Notes or Preferences
          </label>
          <textarea
            id="additionalNotes"
            name="additionalNotes"
            rows={4}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={formData.additionalNotes}
            onChange={handleInputChange}
            placeholder="Any other preferences or information you'd like to share..."
          />
        </div>
        
        {/* Submit Buttons */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={(e) => handleSubmit(e, false)}
            disabled={saving}
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-accent hover:bg-accent-hover px-4 py-2 text-white transition-colors disabled:opacity-50"
          >
            {saving ? "Submitting..." : "Submit Survey"}
          </button>
        </div>
      </form>
    </div>
  );
}