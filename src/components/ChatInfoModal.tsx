import { useState, useEffect } from 'react';
import { FiX, FiUsers, FiTrash2, FiLogOut } from 'react-icons/fi';
import Image from 'next/image';

interface Participant {
  _id: string;
  name: string;
  image: string;
  isDeleted?: boolean;
  email?: string;
}

interface ChatInfoProps {
  conversation: {
    _id: string;
    participants: Participant[];
    otherParticipants: Participant[];
    isGroup: boolean;
    name: string;
  } | null;
  currentUserId?: string;
  onClose: () => void;
  onViewProfile: (participant: Participant) => void;
}

// Helper function to check if a participant is a deleted user
const isDeletedUser = (participant: Participant): boolean => {
  return participant?.isDeleted === true || participant?._id?.startsWith('deleted_');
};

export default function ChatInfoModal({
  conversation,
  currentUserId,
  onClose,
  onViewProfile
}: ChatInfoProps) {
  const [enrichedParticipants, setEnrichedParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!conversation) return;

      const enriched = await Promise.all(
        conversation.participants.map(async (participant) => {
          // If we already have complete data, return it
          if (participant.name && participant.image) {
            return participant;
          }

          try {
            // Use API route instead of direct Firebase service call
            const response = await fetch(`/api/user?email=${encodeURIComponent(participant._id)}`);
            if (response.ok) {
              const result = await response.json();
              if (result.userProfile) {
                return {
                  ...participant,
                  name: result.userProfile.name || 'User',
                  image: result.userProfile.image || '',
                  email: result.userProfile.email
                };
              }
            }
          } catch (error) {
            console.error('Error fetching user data:', error);
          }

          return participant;
        })
      );

      setEnrichedParticipants(enriched);
    };

    fetchUserData();
  }, [conversation]);

  if (!conversation) {
    return null;
  }

  // Helper function to get user display name
  const getName = (participant: Participant): string => {
    // Check if this is a deleted user
    if (isDeletedUser(participant)) {
      return "Deleted User";
    }
    
    // Use name from participant profile if available and not empty/default
    if (participant.name && participant.name !== 'User' && participant.name.trim() !== '') {
      return participant.name;
    }
    
    // If we have an email, use the part before @ as a fallback
    if (participant.email) {
      const emailName = participant.email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    
    // Last resort fallback
    return 'User';
  };

  // Use enriched participants if available, otherwise fall back to conversation participants
  const displayParticipants = enrichedParticipants.length > 0 ? enrichedParticipants : conversation.participants;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Members List
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Members List */}
        <div className="p-4">
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {displayParticipants.map((participant) => (
              <div
                key={participant._id}
                className={`flex items-center p-3 rounded-lg ${
                  participant._id === currentUserId 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800' 
                    : isDeletedUser(participant)
                      ? 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'
                }`}
                onClick={() => {
                  if (!isDeletedUser(participant) && participant._id !== currentUserId) {
                    onViewProfile(participant);
                  }
                }}
              >
                <div className="relative w-10 h-10 mr-3">
                  <Image
                    src={isDeletedUser(participant) 
                      ? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E'
                      : participant.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E'}
                    alt={getName(participant)}
                    fill
                    sizes="(max-width: 768px) 40px, 40px"
                    className="rounded-full object-cover"
                  />
                  {participant._id === currentUserId && (
                    <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1">
                      You
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {getName(participant)}
                    {participant._id === currentUserId ? ' (You)' : ''}
                  </div>
                  {isDeletedUser(participant) && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      This user has deleted their account
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 