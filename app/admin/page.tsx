"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { SurveyFormData } from "@/constants/survey-constants";

interface SurveyResponse extends SurveyFormData {
  _id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    name: string;
    email: string;
  };
}

export default function AdminPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/signin");
    },
  });

  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchResponses = async () => {
      try {
        const response = await fetch("/api/admin/survey-responses");
        const result = await response.json();
        
        if (response.ok) {
          setResponses(result.data || []);
        } else {
          setError(result.error || "Failed to fetch survey responses");
        }
      } catch (error) {
        console.error("Error fetching responses:", error);
        setError("Failed to fetch survey responses");
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchResponses();
    }
  }, [session]);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-800 dark:text-gray-200">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-100 dark:bg-gray-900">
        <div className="w-full max-w-4xl rounded-lg bg-red-50 dark:bg-red-900/20 p-6 text-center">
          <h2 className="text-xl font-semibold text-red-700 dark:text-red-400">Error</h2>
          <p className="text-red-600 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col p-8 bg-gray-100 dark:bg-gray-900">
      <ThemeToggle />
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="mb-8 text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
        
        <div className="mb-8 rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Survey Responses</h2>
          
          {responses.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No survey responses submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <th className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">Name</th>
                    <th className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">Email</th>
                    <th className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">Gender</th>
                    <th className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">Region</th>
                    <th className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">Dates</th>
                    <th className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">Roommates</th>
                    <th className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">Budget</th>
                    <th className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((response) => (
                    <tr key={response._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">{response.user?.name || "Unknown"}</td>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">{response.user?.email || response.userId}</td>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">
                        {response.gender}
                        {response.roomWithDifferentGender && <span className="ml-1 text-xs">(Open)</span>}
                      </td>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">
                        {response.housingRegion}
                        {response.housingRegion === "Other" && response.housingCities.length > 0 ? (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Custom: {response.housingCities.join(", ")}
                          </div>
                        ) : response.housingCities.length > 0 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {response.housingCities.join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">
                        {new Date(response.internshipStartDate).toLocaleDateString()} - 
                        {new Date(response.internshipEndDate).toLocaleDateString()}
                      </td>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">{response.desiredRoommates}</td>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">${response.monthlyBudget}</td>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2">
                        {response.submitted ? (
                          <span className="rounded-full bg-green-100 dark:bg-green-900/20 px-2 py-1 text-xs text-green-800 dark:text-green-400">Complete</span>
                        ) : (
                          <span className="rounded-full bg-yellow-100 dark:bg-yellow-900/20 px-2 py-1 text-xs text-yellow-800 dark:text-yellow-400">Draft</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}