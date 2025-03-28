"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import SurveyForm from "./survey-form";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { useEffect, useState } from "react";
import { useTheme } from "@/app/providers";

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
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Ensure we're client-side before setting mounted
  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-800 dark:text-gray-200">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col p-8 bg-gray-100 dark:bg-gray-900">
      <ThemeToggle />
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="mb-8 text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        
        <div className="mb-8 rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Welcome, {session?.user?.name}!
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Please complete the internship survey below to help us prepare for your arrival.
          </p>
          <div className="flex space-x-4">
            <button 
              onClick={() => router.push('/messaging')}
              className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg transition-colors"
            >
              Message Other Interns
            </button>
          </div>
        </div>
        
        <SurveyForm />
        
        <div className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Account Settings
          </h3>
          
          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? "Deleting..." : "Delete My Account"}
          </button>
          
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Deleting your account will permanently remove all your data from our system.
          </p>
        </div>
      </div>
    </div>
  );
}