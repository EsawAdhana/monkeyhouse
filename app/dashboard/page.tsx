"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { useEffect, useState } from "react";
import { useTheme } from "@/app/providers";
import Link from "next/link";

export default function Dashboard() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/signin");
    },
  });
  
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasSurvey, setHasSurvey] = useState(false);
  
  // Ensure we're client-side before setting mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if user has completed a survey
  useEffect(() => {
    const checkSurveyStatus = async () => {
      if (status === "loading" || !session) return;
      
      try {
        const response = await fetch("/api/user/survey-status");
        const data = await response.json();
        
        if (response.ok) {
          if (!data.isSubmitted) {
            // Redirect to welcome page if survey not completed
            router.push("/welcome");
          } else {
            setHasSurvey(true);
          }
        }
      } catch (error) {
        console.error("Error checking survey status:", error);
      } finally {
        setLoading(false);
      }
    };
    
    checkSurveyStatus();
  }, [session, status, router]);

  if (!mounted || status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-800 dark:text-gray-200">Loading...</p>
      </div>
    );
  }

  // User should always have a submitted survey to see this page
  // This is a fallback in case the redirect fails
  if (!hasSurvey) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-800 dark:text-gray-200 mb-4">Please complete your housing survey first.</p>
        <button 
          onClick={() => router.push("/welcome")}
          className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg transition-colors"
        >
          Go to Survey
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col p-8 bg-gray-100 dark:bg-gray-900">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <Link 
            href="/dashboard/settings" 
            className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </header>
      
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Welcome, {session?.user?.name}!
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Your housing preferences have been saved. We'll match you with compatible roommates.
          </p>
          <div className="flex space-x-4">
            <button 
              onClick={() => alert("Messaging disabled in test mode")}
              className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg transition-colors"
            >
              Message Other Interns
            </button>
          </div>
        </div>
        
        {/* Main dashboard content */}
        <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Potential Matches
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            We're currently looking for potential roommate matches based on your preferences.
            You'll be notified when we find suitable matches for you.
          </p>
        </div>
        
        <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Housing Options
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Housing options will appear here once we have matched you with potential roommates.
          </p>
        </div>
      </div>
    </div>
  );
}