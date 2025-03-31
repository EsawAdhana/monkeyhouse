"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Settings() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/signin");
    },
  });
  
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [surveyData, setSurveyData] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Ensure we're client-side before setting mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch survey data
  useEffect(() => {
    const fetchSurveyData = async () => {
      if (status === "loading" || !session) return;
      
      try {
        const response = await fetch("/api/survey");
        const result = await response.json();
        
        if (response.ok && result.data) {
          setSurveyData(result.data);
        } else {
          // No survey data, redirect to welcome page
          router.push("/welcome");
        }
      } catch (error) {
        console.error("Error fetching survey data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSurveyData();
  }, [session, status, router]);

  // Handle account deletion
  const handleDeleteAccount = async () => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This action cannot be undone and will remove all your data."
    );
    
    if (!confirmed) return;
    
    try {
      setIsDeleting(true);
      
      // Call the delete API
      const response = await fetch("/api/user/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Sign out and redirect to signin page
        alert("Your account has been deleted successfully.");
        await signOut({ redirect: false });
        router.push("/signin");
      } else {
        const errorMessage = result.error || "Failed to delete account";
        console.error("Account deletion error:", errorMessage);
        alert(`Error: ${errorMessage}`);
        setIsDeleting(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error deleting account:", error);
      alert(`An error occurred while trying to delete your account: ${errorMessage}`);
      setIsDeleting(false);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/signin");
  };

  if (!mounted || status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-800 dark:text-gray-200">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col p-8 bg-gray-100 dark:bg-gray-900">
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
        </div>
        <ThemeToggle />
      </header>
      
      <div className="mx-auto w-full max-w-3xl">
        {/* User Info */}
        <div className="mb-8 rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Account Information
          </h2>
          <div className="flex items-center space-x-4 mb-4">
            {session?.user?.image && (
              <img 
                src={session.user.image} 
                alt={session.user.name || "User"} 
                className="h-16 w-16 rounded-full object-cover"
              />
            )}
            <div>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{session?.user?.name}</p>
              <p className="text-gray-600 dark:text-gray-300">{session?.user?.email}</p>
            </div>
          </div>
        </div>
        
        {/* Survey Data */}
        <div className="mb-8 rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Housing Preferences
            </h2>
            <Link 
              href="/welcome"
              className="text-sm text-accent hover:text-accent-hover"
            >
              Edit Preferences
            </Link>
          </div>
          {surveyData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-[var(--checkbox-bg)] rounded-lg border border-[var(--checkbox-border)]">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Gender</h3>
                  <p className="text-gray-900 dark:text-white">{surveyData.gender}</p>
                </div>
                
                <div className="p-3 bg-[var(--checkbox-bg)] rounded-lg border border-[var(--checkbox-border)]">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Housing Region</h3>
                  <p className="text-gray-900 dark:text-white">{surveyData.housingRegion}</p>
                </div>
                
                <div className="p-3 bg-[var(--checkbox-bg)] rounded-lg border border-[var(--checkbox-border)]">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Internship Company</h3>
                  <p className="text-gray-900 dark:text-white">{surveyData.internshipCompany || "Not specified"}</p>
                </div>
                
                <div className="p-3 bg-[var(--checkbox-bg)] rounded-lg border border-[var(--checkbox-border)]">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Monthly Budget</h3>
                  <p className="text-gray-900 dark:text-white">${surveyData.monthlyBudget}/month</p>
                </div>
                
                <div className="p-3 bg-[var(--checkbox-bg)] rounded-lg border border-[var(--checkbox-border)]">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Internship Timeline</h3>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(surveyData.internshipStartDate).toLocaleDateString()} to {new Date(surveyData.internshipEndDate).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="p-3 bg-[var(--checkbox-bg)] rounded-lg border border-[var(--checkbox-border)]">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Desired Roommates</h3>
                  <p className="text-gray-900 dark:text-white">{surveyData.desiredRoommates}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Account Actions */}
        <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Account Actions
          </h2>
          <div className="space-y-4">
            <button
              onClick={handleSignOut}
              className="w-full py-2 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors text-center"
            >
              Sign Out
            </button>
            
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center"
            >
              {isDeleting ? "Deleting..." : "Delete My Account"}
            </button>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Deleting your account will permanently remove all your data from our system.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 