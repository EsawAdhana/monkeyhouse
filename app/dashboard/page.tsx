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
  const [isDeleting, setIsDeleting] = useState(false);
  
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

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch("/api/user/delete", {
        method: "DELETE",
      });

      if (response.ok) {
        await signOut({ redirect: true, callbackUrl: "/signin" });
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete account");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

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
        
        <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Housing Options
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Housing options will appear here once we have matched you with potential roommates.
          </p>
        </div>

        {/* Delete Account Section */}
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-6 shadow-lg border border-red-100 dark:border-red-800">
          <h2 className="mb-4 text-xl font-semibold text-red-900 dark:text-red-200">
            Danger Zone
          </h2>
          <p className="text-red-700 dark:text-red-300 mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Deleting Account...
              </span>
            ) : (
              "Delete Account"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}