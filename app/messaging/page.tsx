"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import NewConversationModal from "./NewConversationModal";

interface Conversation {
  _id: string;
  name: string;
  participants: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function MessagingPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/signin");
    },
  });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch all conversations for current user
  useEffect(() => {
    const fetchConversations = async () => {
      if (!session) return;
      
      try {
        const response = await fetch("/api/conversations");
        const result = await response.json();
        
        if (response.ok) {
          setConversations(result.data || []);
        } else {
          setError(result.error || "Failed to fetch conversations");
        }
      } catch (error) {
        console.error("Error fetching conversations:", error);
        setError("Failed to fetch conversations");
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchConversations();
    }
  }, [session]);

  const handleNewConversation = (newConversation: Conversation) => {
    setConversations(prev => [newConversation, ...prev]);
    setIsModalOpen(false);
  };

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
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Messages</h1>
          <button
            className="rounded-md bg-accent hover:bg-accent-hover px-4 py-2 text-white transition-colors"
            onClick={() => setIsModalOpen(true)}
          >
            New Conversation
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-lg bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p className="mb-4">You don't have any conversations yet.</p>
              <button
                className="text-accent hover:text-accent-hover underline"
                onClick={() => setIsModalOpen(true)}
              >
                Start a new conversation
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {conversations.map((conversation) => (
                <li key={conversation._id}>
                  <Link
                    href={`/messaging/${conversation._id}`}
                    className="block hover:bg-gray-50 dark:hover:bg-gray-700/50 p-4"
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {conversation.name}
                      </h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(conversation.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {conversation.participants.length} participants
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isModalOpen && (
        <NewConversationModal
          onClose={() => setIsModalOpen(false)}
          onCreateSuccess={handleNewConversation}
        />
      )}
    </div>
  );
} 