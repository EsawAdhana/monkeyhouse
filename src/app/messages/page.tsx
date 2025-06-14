'use client';

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FiUsers } from 'react-icons/fi';
import { useNotifications } from '@/contexts/NotificationContext';
import { ConversationBadge } from '@/components/NotificationBadge';

interface Participant {
  _id: string;
  name: string;
  image: string;
}

interface Conversation {
  _id: string;
  participants: Participant[];
  otherParticipants: Participant[];
  lastMessage?: {
    content: string;
    createdAt: string;
  };
  isGroup: boolean;
  name: string;
  updatedAt: string;
}

// Helper function to compare two conversations for equality
function areConversationsEqual(prev: Conversation, next: Conversation): boolean {
  // ID must be same
  if (prev._id !== next._id) return false;
  
  // Check if lastMessage has changed
  if (prev.lastMessage?.content !== next.lastMessage?.content) return false;
  if (prev.lastMessage?.createdAt !== next.lastMessage?.createdAt) return false;
  
  // Check if updatedAt has changed
  if (prev.updatedAt !== next.updatedAt) return false;
  
  // Assume they're the same if we got here
  return true;
}

// Add a helper function to check if a participant is a deleted user
const isDeletedUser = (participant: any): boolean => {
  return participant?.isDeleted === true || participant?._id?.startsWith('deleted_');
};

export default function MessagesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [newChatEmail, setNewChatEmail] = useState('');
  const [searchResults, setSearchResults] = useState<{ email: string; name: string; }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Notification hooks - now also getting conversations from the same source
  const { getUnreadCount, conversations: realtimeConversations, conversationsLoading } = useNotifications();

  // Process conversations from NotificationContext to ensure synchronization
  useEffect(() => {
    if (realtimeConversations && realtimeConversations.length > 0) {
      // Transform the real-time conversation data
      const transformedConversations = realtimeConversations.map((conv: any) => ({
        _id: conv._id,
        participants: Array.isArray(conv.participants) 
          ? conv.participants.map((p: any) => ({
              _id: typeof p === 'string' ? p : p._id || p.email,
              name: typeof p === 'string' ? '' : p.name || '',
              image: typeof p === 'string' ? '' : p.image || ''
            }))
          : [],
        otherParticipants: Array.isArray(conv.otherParticipants) 
          ? conv.otherParticipants.map((p: any) => ({
              _id: typeof p === 'string' ? p : p._id || p.email,
              name: typeof p === 'string' ? '' : p.name || '',
              image: typeof p === 'string' ? '' : p.image || ''
            }))
          : [],
        lastMessage: conv.lastMessage 
          ? {
              content: conv.lastMessage.content || '',
              createdAt: (() => {
                const createdAt = conv.lastMessage.createdAt;
                if (!createdAt) return new Date().toISOString();
                // Handle Firebase Timestamp
                if (createdAt && typeof createdAt === 'object' && createdAt.toDate) {
                  return createdAt.toDate().toISOString();
                }
                // Handle already converted date strings
                if (typeof createdAt === 'string') {
                  return createdAt;
                }
                // Handle Date objects
                if (createdAt instanceof Date) {
                  return createdAt.toISOString();
                }
                // Fallback
                return new Date().toISOString();
              })()
            }
          : undefined,
        isGroup: conv.isGroup || false,
        name: conv.name || '',
        updatedAt: (() => {
          if (!conv.updatedAt) return new Date().toISOString();
          // Handle Firebase Timestamp
          if (conv.updatedAt && typeof conv.updatedAt === 'object' && conv.updatedAt.toDate) {
            return conv.updatedAt.toDate().toISOString();
          }
          // Handle already converted date strings
          if (typeof conv.updatedAt === 'string') {
            return conv.updatedAt;
          }
          // Handle Date objects
          if (conv.updatedAt instanceof Date) {
            return conv.updatedAt.toISOString();
          }
          // Fallback
          return new Date().toISOString();
        })()
      }));
      
      // Sort conversations by updatedAt (most recent first)
      transformedConversations.sort((a, b) => {
        const aTime = new Date(a.updatedAt).getTime();
        const bTime = new Date(b.updatedAt).getTime();
        return bTime - aTime; // Most recent first
      });
      
      setConversations(transformedConversations);
      setConversationsLoaded(true);
    } else if (!conversationsLoading) {
      setConversations([]);
      setConversationsLoaded(true);
    }
  }, [realtimeConversations, conversationsLoading]);

  // Helper function to get user display name from survey firstName or other sources
  const getName = async (userId: string): Promise<string> => {
    try {
      // Use API call instead of direct Firebase access
      const response = await fetch(`/api/user?email=${encodeURIComponent(userId)}`);
      
      if (response.ok) {
        const result = await response.json();
        
        // Check if user has survey data with firstName
        if (result.surveyData?.firstName && typeof result.surveyData.firstName === 'string' && result.surveyData.firstName.trim() !== '') {
          return result.surveyData.firstName;
        }
        
        // Check user profile name
        if (result.userProfile?.name && result.userProfile.name !== 'User' && result.userProfile.name.trim() !== '') {
          return result.userProfile.name;
        }
      }
      
      // Return 'User' instead of extracting from email
      return 'User';
    } catch (error) {
      console.error('Error getting user name:', error);
      
      // Return 'User' instead of extracting from email
      return 'User';
    }
  };

  // Cached participant names to avoid repeated lookups
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});

  // Memoize the getName function to prevent recreating it on each render
  const memoizedGetName = useCallback(async (userId: string): Promise<string> => {
    return getName(userId);
  }, []);

  // Update getConversationName to handle deleted users
  const getConversationName = useCallback(async (conversation: Conversation): Promise<string> => {
    if (conversation.isGroup) {
      return conversation.name;
    }
    
    // If this conversation has only one other participant, get their name
    if (conversation.otherParticipants.length > 0) {
      const otherParticipant = conversation.otherParticipants[0];
      
      // Check if the participant is a deleted user
      if (isDeletedUser(otherParticipant)) {
        return "Deleted User";
      }
      
      const userId = otherParticipant._id;
      
      // Check if we already have the name cached
      if (participantNames[userId]) {
        return participantNames[userId];
      }
      
      // Otherwise look it up
      const name = await memoizedGetName(userId);
      
      // Cache the result
      setParticipantNames(prev => ({
        ...prev,
        [userId]: name
      }));
      
      return name;
    }
    
    return 'Unknown User';
  }, [memoizedGetName, participantNames]);

  // Update getConversationImage to handle deleted users
  const getConversationImage = (conversation: Conversation) => {
    // Default fallback image for missing profile pictures
    const defaultProfileImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E';
    
    // Deleted user image
    const deletedUserImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E';
    
    // Helper function to check if an image URL is valid
    const isValidImageUrl = (url: string | undefined | null) => {
      return url && typeof url === 'string' && url.trim() !== '' && url !== 'undefined' && url !== 'null';
    };
    
    if (conversation.participants.length >= 3) {
      // For real group chats (3+ people), use a group icon or the first participant's image
      if (conversation.otherParticipants.length > 0) {
        const firstParticipant = conversation.otherParticipants[0];
        if (isDeletedUser(firstParticipant)) {
          return deletedUserImage;
        }
        if (isValidImageUrl(firstParticipant.image)) {
          return firstParticipant.image;
        }
      }
      return defaultProfileImage;
    } else {
      // For DMs (2 people total), try multiple ways to get the other participant's image
      
      // First try otherParticipants
      if (conversation.otherParticipants.length > 0) {
        const otherParticipant = conversation.otherParticipants[0];
        
        if (isDeletedUser(otherParticipant)) {
          return deletedUserImage;
        }
        if (isValidImageUrl(otherParticipant.image)) {
          return otherParticipant.image;
        }
      }
      
      // Fallback: try to find the other participant from all participants
      if (conversation.participants.length >= 2 && session?.user?.email) {
        const otherParticipant = conversation.participants.find(p => 
          p._id !== session.user.email && p._id !== session.user.id
        );
        
        if (otherParticipant) {
          if (isDeletedUser(otherParticipant)) {
            return deletedUserImage;
          }
          if (isValidImageUrl(otherParticipant.image)) {
            return otherParticipant.image;
          }
        }
      }
    }
    // Fallback for any other case
    return defaultProfileImage;
  };

  // Memoize the getConversationImage function
  const memoizedGetConversationImage = useCallback((conversation: Conversation) => {
    return getConversationImage(conversation);
  }, [session?.user?.email]);

  const deleteConversation = async (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault(); // Prevent navigation to conversation detail
    e.stopPropagation(); // Prevent event bubbling
    
    if (!window.confirm('Are you sure you want to delete this entire conversation? This action cannot be undone.')) {
      return;
    }
    
    setDeletingId(conversationId);
    
    try {
      // Use API endpoint to delete the conversation
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Remove will happen automatically via the real-time listener, but we can also do it manually
        setConversations(prev => prev.filter(conv => conv._id !== conversationId));
      } else {
        console.error('Error deleting conversation:', result.error || 'Unknown error');
        alert('Failed to delete conversation. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Failed to delete conversation. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // Modified component to handle displaying conversation names properly - wrapped in memo to prevent unnecessary re-renders
  const ConversationItem = memo(({ conversation }: { 
    conversation: Conversation;
  }) => {
    const conversationId = conversation._id;
    const displayName = useMemo(() => {
      if (conversation.isGroup) {
        return conversation.name;
      }
      return conversation.otherParticipants[0]?.name || 'Loading...';
    }, [conversation.isGroup, conversation.name, conversation.otherParticipants]);

    // Check if conversation has unread messages
    const unreadCount = getUnreadCount(conversationId);
    const hasUnreadMessages = unreadCount > 0;

    return (
      <div className="conversation-item relative bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 mb-3">
        <div
          className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150 rounded-lg"
          style={{ position: 'relative' }}
        >
          {/* Message content */}
          <div className="flex items-center space-x-4 flex-1">
            <div className="relative flex-shrink-0">
              <div className="relative w-14 h-14">
                {conversation.participants.length >= 3 ? (
                  <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <FiUsers className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                ) : (
                  <Image
                    src={memoizedGetConversationImage(conversation)}
                    alt={displayName || 'Loading...'}
                    fill
                    sizes="(max-width: 768px) 56px, 56px"
                    className="rounded-full object-cover border-2 border-gray-100 dark:border-gray-700"
                    onError={(e) => {
                      // Fallback to default image if the profile image fails to load
                      const defaultImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E';
                      (e.target as HTMLImageElement).src = defaultImage;
                    }}
                  />
                )}
                {/* Notification Badge */}
                <ConversationBadge 
                  conversationId={conversationId} 
                  unreadCount={unreadCount} 
                />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h2 className={`text-lg truncate text-gray-900 dark:text-gray-100 ${
                  hasUnreadMessages ? 'font-bold' : 'font-semibold'
                }`}>
                  {displayName || (conversation.isGroup ? conversation.name : 'Loading...')}
                </h2>
              </div>
              <div className="flex items-center justify-between">
                {conversation.participants.length >= 3 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {conversation.participants.length} participants
                  </p>
                )}
                {conversation.lastMessage && (
                  <p className={`text-sm flex-1 ml-2 ${
                    hasUnreadMessages 
                      ? 'text-gray-900 dark:text-gray-100 font-semibold' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    wordBreak: 'break-all',
                    maxWidth: '100%'
                  }}>
                    {conversation.lastMessage.content.length > 50 
                      ? `${conversation.lastMessage.content.substring(0, 50)}...`
                      : conversation.lastMessage.content
                    }
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Clickable overlay */}
          <Link
            href={`/messages/${conversationId}`}
            className="absolute inset-0 z-10 cursor-pointer"
            aria-label={`Open conversation with ${displayName || 'Loading...'}`}
            style={{ transition: 'none' }}
          />
        </div>
      </div>
    );
  });
  
  // For debugging purposes
  ConversationItem.displayName = 'ConversationItem';


  
  // Memoize the deleteConversation function to avoid recreating it
  const stableDeleteConversation = useCallback((e: React.MouseEvent, id: string) => {
    return deleteConversation(e, id);
  }, [deleteConversation]);

  // Add loading state component
  if (!conversationsLoaded && conversations.length === 0) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <div className="w-full md:w-1/3 lg:w-1/4 border-r border-gray-200 dark:border-gray-700 h-screen overflow-y-auto p-4">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center p-3 rounded-lg">
                <div className="w-12 h-12 bg-gray-300 dark:bg-gray-700 rounded-full mr-3"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden md:flex md:flex-1 flex-col items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="text-gray-500 dark:text-gray-400 text-center p-8">
            <div className="animate-pulse w-16 h-16 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-48 mx-auto mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-32 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Messages</h1>
        {/* Conversations List */}
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {conversations.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">No messages yet</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Start connecting with potential roommates!</p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <ConversationItem
                  key={conversation._id}
                  conversation={conversation}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
} 