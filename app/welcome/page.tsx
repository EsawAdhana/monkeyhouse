"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SurveyForm from "../dashboard/survey-form";
import { ThemeToggle } from "@/app/components/ThemeToggle";

export default function WelcomePage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/signin");
    },
  });
  
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [surveyStatus, setSurveyStatus] = useState({ 
    hasSurvey: false, 
    isSubmitted: false 
  });

  // Check if user has already completed the survey
  useEffect(() => {
    const checkSurveyStatus = async () => {
      if (status === "loading" || !session) return;
      
      try {
        const response = await fetch("/api/user/survey-status");
        const data = await response.json();
        
        if (response.ok) {
          setSurveyStatus(data);
          
          // If they've already submitted a survey, redirect to dashboard
          if (data.isSubmitted) {
            router.push("/dashboard");
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

  if (status === "loading" || loading) {
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
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
            Welcome to Monkey House!
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            We're excited to help you find your perfect internship housing match.
          </p>
        </div>
        
        <div className="mb-8 rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Let's Get Started, {session?.user?.name}!
          </h2>
          <p className="mb-6 text-gray-600 dark:text-gray-300">
            Please complete this brief survey to help us find you the best housing match for your internship. 
            This information will help us understand your preferences and match you with compatible roommates.
          </p>
          
          <div className="rounded-lg bg-accent bg-opacity-10 p-4 mb-6 pointer-events-none">
            <p className="text-accent-color font-medium">
              You can update your preferences anytime.
            </p>
            <p className="text-accent-color font-medium">
              After submission, you'll be directed to your dashboard.
            </p>
          </div>
          
          <SurveyForm onSubmitSuccess={() => router.push("/dashboard")} />
        </div>
      </div>
    </div>
  );
} 