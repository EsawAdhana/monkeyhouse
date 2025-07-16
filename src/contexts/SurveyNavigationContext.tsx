'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSurveyStatus } from '@/contexts/SurveyStatusContext';

interface SurveyNavigationContextType {
  showWarningOnNavigation: boolean;
  setShowWarningOnNavigation: React.Dispatch<React.SetStateAction<boolean>>;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
}

const SurveyNavigationContext = createContext<SurveyNavigationContextType | undefined>(undefined);

export function SurveyNavigationProvider({ children }: { children: React.ReactNode }) {
  const [showWarningOnNavigation, setShowWarningOnNavigation] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isSubmitted, loading } = useSurveyStatus();
  
  // Only enable warning when in survey path and there are unsaved changes
  useEffect(() => {
    if (pathname?.includes('/survey')) {
      setShowWarningOnNavigation(hasUnsavedChanges);
    } else {
      setShowWarningOnNavigation(false);
    }
  }, [pathname, hasUnsavedChanges]);
  
  // Set up a global click interceptor for navigation
  useEffect(() => {
    if (!showWarningOnNavigation) return;
    
    const handleClick = (e: MouseEvent) => {
      if (!e.target || !(e.target instanceof HTMLElement)) return;
      
      // Find if the click is on a navigation element (anchor or button)
      const findNavigationElement = (element: HTMLElement | null): HTMLAnchorElement | HTMLButtonElement | null => {
        if (!element) return null;
        if (element.tagName === 'A') return element as HTMLAnchorElement;
        if (element.tagName === 'BUTTON') return element as HTMLButtonElement;
        return element.parentElement ? findNavigationElement(element.parentElement) : null;
      };
      
      const navigationElement = findNavigationElement(e.target as HTMLElement);
      if (!navigationElement) return;
      
      // Skip internal survey navigation (buttons inside forms)
      if (pathname?.includes('/survey') && navigationElement.closest('form')) {
        return;
      }
      
      // Handle anchor tags
      if (navigationElement.tagName === 'A') {
        const link = navigationElement as HTMLAnchorElement;
        
        // Skip handling for: 
        // - Links without href
        // - Hash links
        // - Links opening in new tabs
        // - Links to current page
        if (!link.href || 
            link.href.includes('#') || 
            link.target === '_blank' ||
            link.href.includes(pathname || '')) {
          return;
        }
        
        // Show warning for navigation to different pages
        const targetPath = link.href.replace(window.location.origin, '');
        if (showWarningOnNavigation) {
          const confirmationMessage = "You have unsaved changes. Are you sure you want to leave? Your changes will be lost.";
          if (!window.confirm(confirmationMessage)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
          }
        }
        
        // For internal links, use Next.js router
        if (link.href.startsWith(window.location.origin)) {
          e.preventDefault();
          router.push(targetPath);
        }
      } 
      // Handle button-based navigation
      else if (navigationElement.tagName === 'BUTTON') {
        // Skip disabled buttons
        if (navigationElement.hasAttribute('disabled') || 
            navigationElement.classList.contains('disabled')) {
          return;
        }
        
        // Check if this is a navigation button (you might want to add more specific checks)
        const buttonText = navigationElement.textContent?.toLowerCase() || '';
        const isNavigationButton = buttonText.includes('next') || 
                                  buttonText.includes('previous') || 
                                  buttonText.includes('submit') ||
                                  buttonText.includes('save');
        
        if (isNavigationButton) {
          if (showWarningOnNavigation) {
            const confirmationMessage = "You have unsaved changes. Are you sure you want to leave? Your changes will be lost.";
            if (!window.confirm(confirmationMessage)) {
              e.preventDefault();
              e.stopImmediatePropagation();
              return;
            }
          }
        }
      }
    };
    
    document.addEventListener('click', handleClick);
    
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [showWarningOnNavigation, pathname, router]);
  
  return (
    <SurveyNavigationContext.Provider value={{ 
      showWarningOnNavigation, 
      setShowWarningOnNavigation, 
      hasUnsavedChanges, 
      setHasUnsavedChanges 
    }}>
      {children}
    </SurveyNavigationContext.Provider>
  );
}

export function useSurveyNavigation() {
  const context = useContext(SurveyNavigationContext);
  if (context === undefined) {
    throw new Error('useSurveyNavigation must be used within a SurveyNavigationProvider');
  }
  return context;
} 