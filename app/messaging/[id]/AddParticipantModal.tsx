"use client";

import { useState } from "react";

interface AddParticipantModalProps {
  onClose: () => void;
  onAddParticipants: (participants: string[]) => void;
  existingParticipants: string[];
}

export default function AddParticipantModal({
  onClose,
  onAddParticipants,
  existingParticipants
}: AddParticipantModalProps) {
  const [participantEmail, setParticipantEmail] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState("");

  const handleAddParticipant = () => {
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(participantEmail)) {
      setError("Please enter a valid email address");
      return;
    }
    
    // Check if participant is already added
    if (participants.includes(participantEmail)) {
      setError("This participant is already added");
      return;
    }
    
    // Check if participant is already in the conversation
    if (existingParticipants.includes(participantEmail)) {
      setError("This person is already in the conversation");
      return;
    }
    
    setParticipants(prev => [...prev, participantEmail]);
    setParticipantEmail("");
    setError("");
  };

  const handleRemoveParticipant = (email: string) => {
    setParticipants(prev => prev.filter(p => p !== email));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (participants.length === 0) {
      setError("At least one participant is required");
      return;
    }
    
    onAddParticipants(participants);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Add People to This Conversation
          </h2>
          
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-md text-sm">
                {error}
              </div>
            )}
            
            {/* Add Participant */}
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 mb-2" htmlFor="participant">
                Add Participants by Email
              </label>
              <div className="flex">
                <input
                  type="email"
                  id="participant"
                  className="flex-1 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="name@example.com"
                  value={participantEmail}
                  onChange={(e) => setParticipantEmail(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-r-md bg-blue-500 px-4 text-white hover:bg-blue-600"
                  onClick={handleAddParticipant}
                >
                  Add
                </button>
              </div>
            </div>
            
            {/* Participant List */}
            {participants.length > 0 && (
              <div className="mb-6">
                <h3 className="text-gray-700 dark:text-gray-300 mb-2">Participants to add:</h3>
                <ul className="bg-gray-50 dark:bg-gray-700 rounded-md p-2 space-y-1">
                  {participants.map(email => (
                    <li key={email} className="flex justify-between items-center">
                      <span className="text-gray-800 dark:text-gray-200 text-sm">{email}</span>
                      <button
                        type="button"
                        className="text-red-500 hover:text-red-700 text-sm"
                        onClick={() => handleRemoveParticipant(email)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Buttons */}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-accent hover:bg-accent-hover px-4 py-2 text-white disabled:opacity-50"
                disabled={participants.length === 0}
              >
                Add to Conversation
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 