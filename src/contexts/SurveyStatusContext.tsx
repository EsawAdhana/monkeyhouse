'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface SurveyStatusContextType {
  isSubmitted: boolean | null;
  loading: boolean;
  refreshStatus: () => Promise<void>;
}

const SurveyStatusContext = createContext<SurveyStatusContextType | undefined>(undefined);

export function SurveyStatusProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [isSubmitted, setIsSubmitted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSurveyStatus = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/survey');
      const result = await response.json();
      
      if (response.ok && result.data) {
        setIsSubmitted(result.data.isSubmitted || false);
      } else {
        setIsSubmitted(false);
      }
    } catch (error) {
      console.error('Error fetching survey status:', error);
      setIsSubmitted(false);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    await fetchSurveyStatus();
  }, [fetchSurveyStatus]);

  useEffect(() => {
    fetchSurveyStatus();
  }, [fetchSurveyStatus]);

  return (
    <SurveyStatusContext.Provider value={{ isSubmitted, loading, refreshStatus }}>
      {children}
    </SurveyStatusContext.Provider>
  );
}

export function useSurveyStatus() {
  const context = useContext(SurveyStatusContext);
  if (context === undefined) {
    throw new Error('useSurveyStatus must be used within a SurveyStatusProvider');
  }
  return context;
} 