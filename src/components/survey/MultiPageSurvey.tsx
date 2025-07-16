'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useSurveyNavigation } from '@/contexts/SurveyNavigationContext';
import { useSurveyStatus } from '@/contexts/SurveyStatusContext';
import { useSurveyForm } from '@/hooks/useSurveyForm';
import { SurveyFormData } from '@/constants/survey-constants';

// Page components
import BasicInfoPage from './pages/BasicInfoPage';
import LocationPage from './pages/LocationPage';
import TimingBudgetPage from './pages/TimingBudgetPage';
import PreferencesPage from './pages/PreferencesPage';

interface MultiPageSurveyProps {
  onSubmitSuccess?: (formData: SurveyFormData) => void;
  isEditing?: boolean;
  isTestMode?: boolean;
}

export default function MultiPageSurvey({ onSubmitSuccess, isEditing = false, isTestMode = false }: MultiPageSurveyProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { setShowWarningOnNavigation, setHasUnsavedChanges } = useSurveyNavigation();
  const { refreshStatus } = useSurveyStatus();
  
  const {
    formData,
    setFormData,
    loading,
    saving,
    setSaving,
    hasDateError,
    setHasDateError,
    showCompletionModal, 
    setShowCompletionModal,
    saveSurvey
  } = useSurveyForm({ isEditing, isTestMode });
  
  // Enable navigation warnings if editing or if there are unsaved changes
  useEffect(() => {
    if (isEditing) {
      setShowWarningOnNavigation(true);
    }
    
    return () => {
      setShowWarningOnNavigation(false);
      setHasUnsavedChanges(false);
    };
  }, [isEditing, setShowWarningOnNavigation, setHasUnsavedChanges]);
  
  const canProceed = () => {
    // Validation logic for each page
    switch (formData.currentPage) {
      case 1: // Basic info page
        return formData.firstName.trim() !== '' && formData.gender !== '';
      case 2: // Location page
        return formData.housingRegion !== '' && formData.housingCities.length > 0;
      case 3: // Timing & Budget page
        // Check both dates are filled
        const hasValidDates = formData.internshipStartDate && formData.internshipEndDate && !hasDateError;
        return hasValidDates && Number(formData.minBudget) > 0 && Number(formData.maxBudget) >= Number(formData.minBudget);
      default:
        return true;
    }
  };
  
  const handleNext = async () => {
    // Save progress before moving to next page
    await saveSurvey(false);
    // Move to next page
    setFormData((prev: SurveyFormData) => ({ ...prev, currentPage: prev.currentPage + 1 }));
  };
  
  const handleBack = () => {
    // Move to previous page
    setFormData((prev: SurveyFormData) => ({ ...prev, currentPage: prev.currentPage - 1 }));
  };
  
  const handleSubmit = async () => {
    try {
      await saveSurvey(true);
      
      // Refresh survey status after successful submission and wait for it to complete
      await refreshStatus();
      
      // Show completion modal
      setShowCompletionModal(true);
      
      // Notify parent component if needed
      if (onSubmitSuccess) {
        onSubmitSuccess(formData);
      }
    } catch (error) {
      console.error('Error submitting survey:', error);
    }
  };
  
  const handleGoToDashboard = async () => {
    // Ensure the survey status is refreshed before navigation
    await refreshStatus();
    router.push('/dashboard');
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Step {formData.currentPage} of 4
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {Math.round((formData.currentPage / 4) * 100)}% Complete
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(formData.currentPage / 4) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Page content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        {formData.currentPage === 1 && (
          <BasicInfoPage 
            formData={formData} 
            setFormData={setFormData}
            hasDateError={hasDateError}
            setHasDateError={setHasDateError}
          />
        )}
        
        {formData.currentPage === 2 && (
          <LocationPage 
            formData={formData} 
            setFormData={setFormData}
          />
        )}
        
        {formData.currentPage === 3 && (
          <TimingBudgetPage 
            formData={formData} 
            setFormData={setFormData}
            hasDateError={hasDateError}
            setHasDateError={setHasDateError}
          />
        )}
        
        {formData.currentPage === 4 && (
          <PreferencesPage 
            formData={formData} 
            setFormData={setFormData}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-6">
        <button
          type="button"
          onClick={handleBack}
          disabled={formData.currentPage === 1}
          className={`px-6 py-2 rounded-md transition-colors ${
            formData.currentPage === 1
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
              : 'bg-gray-500 text-white hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700'
          }`}
        >
          Back
        </button>
        
        <div className="flex gap-3">
          {formData.currentPage < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed() || saving}
              className={`px-6 py-2 rounded-md transition-colors ${
                !canProceed() || saving
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                  : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700'
              }`}
            >
              {saving ? 'Saving...' : 'Next'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canProceed() || saving}
              className={`px-6 py-2 rounded-md transition-colors ${
                !canProceed() || saving
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                  : 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700'
              }`}
            >
              {saving ? 'Submitting...' : 'Submit Survey'}
            </button>
          )}
        </div>
      </div>

      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 overflow-auto bg-gray-800 bg-opacity-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-center mb-4 text-gray-900 dark:text-gray-100">Survey Completed!</h2>
            <p className="text-center text-gray-700 dark:text-gray-300 mb-6">
              Thank you for completing your roommate survey. You can now browse potential roommates and find your perfect match!
            </p>
            <div className="flex justify-center">
              <button
                onClick={handleGoToDashboard}
                className="px-6 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                type="button"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 