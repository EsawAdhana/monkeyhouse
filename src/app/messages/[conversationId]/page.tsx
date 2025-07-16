'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiFlag, FiX, FiUsers, FiMapPin, FiCalendar, FiList, FiStar, FiInfo, FiUser } from 'react-icons/fi';
import UserProfileModal from '@/components/UserProfileModal';
import ReportUserModal from '@/components/ReportUserModal';
import ChatInfoModal from '@/components/ChatInfoModal';
import LayeredAvatars from '@/components/LayeredAvatars';
import { formatDistance } from 'date-fns';
import ReportModal from '@/components/ReportModal';
import { use } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useMessageRealtime } from '@/hooks/useMessageRealtime';

// Temporary interfaces to replace Firebase types
interface FirebaseMessage {
  _id?: string;
  content: string;
  senderId: any;
  readBy?: any[];
  createdAt?: any;
}

const getConversation = async (id: string) => {
  const response = await fetch(`/api/conversations/${id}`);
  if (response.status === 403) {
    // User is not authorized to access this conversation
    throw new Error('UNAUTHORIZED_ACCESS');
  }
  if (!response.ok) throw new Error('Failed to fetch conversation');
  const result = await response.json();
  return result.success ? result.data : null;
};

const getMessagesByConversation = async (id: string) => {
  const response = await fetch(`/api/messages?conversationId=${id}`);
  if (!response.ok) throw new Error('Failed to fetch messages');
  const result = await response.json();
  return result.success ? result.data : [];
};

const createMessage = async (messageData: any) => {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messageData)
  });
  if (!response.ok) throw new Error('Failed to create message');
  const result = await response.json();
  return result.success ? result.data : null;
};

const enrichParticipantsWithUserData = async (participants: any[]) => {
  if (!participants || participants.length === 0) return [];
  
  return Promise.all(participants.map(async (participant: any) => {
    const participantId = typeof participant === 'string' ? participant : participant._id || participant.email;
    
    if (!participantId) {
      return {
        _id: '',
        name: 'Unknown User',
        image: ''
      };
    }
    
    // Check if this is a deleted user - if so, don't fetch profile data
    if (participantId.startsWith('deleted_')) {
      return {
        _id: participantId,
        name: 'Deleted User',
        image: ''
      };
    }
    
    try {
      // Fetch user profile data
      const response = await fetch(`/api/user?email=${encodeURIComponent(participantId)}`);
      
      if (response.ok) {
        const result = await response.json();
        
        // Get name from survey firstName or userProfile name
        let name = 'User';
        if (result.surveyData?.firstName && typeof result.surveyData.firstName === 'string' && result.surveyData.firstName.trim()) {
          name = result.surveyData.firstName.trim();
        } else if (result.userProfile?.name && result.userProfile.name !== 'User' && result.userProfile.name.trim()) {
          name = result.userProfile.name.trim();
        }
        
        // Get image from userProfile
        const image = result.userProfile?.image || '';
        
        return {
          _id: participantId,
          name,
          image
        };
      }
    } catch (error) {
      console.error('Error enriching participant data:', error);
    }
    
    // Fallback for failed requests
    return {
      _id: participantId,
      name: 'User',
      image: ''
    };
  }));
};

interface Participant {
  _id: string;
  name: string;
  image: string;
}

interface Message {
  _id: string;
  content: string;
  senderId: {
    _id: string;
    name: string;
    image: string;
    profile?: any;
  };
  readBy: {
    _id: string;
    name: string;
    image: string;
  }[];
  createdAt: string;
}

interface Conversation {
  _id: string;
  participants: Participant[];
  otherParticipants: Participant[];
  isGroup: boolean;
  name: string;
  hiddenBy?: string[];
}

// Simple UserAvatar component
const UserAvatar = ({ size = 32, letter = null }: { size?: number, letter?: string | null }) => {
  return (
    <div 
      className="flex items-center justify-center bg-purple-500 text-white rounded-full border border-gray-200 dark:border-gray-600"
      style={{ width: size, height: size }}
    >
      {letter ? (
        <span className="text-sm font-semibold">{letter}</span>
      ) : (
        <FiUser size={size * 0.6} />
      )}
    </div>
  );
};

export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedUser, setSelectedUser] = useState<{email: string, name: string, image: string} | null>(null);
  const [loadingUserProfile, setLoadingUserProfile] = useState(false);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<Set<string>>(new Set());
  const [participantsFullyLoaded, setParticipantsFullyLoaded] = useState<boolean>(false);
  const [isConversationHidden, setIsConversationHidden] = useState<boolean>(false);

  // Notification hook
  const { markConversationAsRead, setActiveConversation } = useNotifications();

  // Real-time messages using the new server-side system
  const { messages: realtimeMessages, loading: messagesLoading, error: messagesError } = useMessageRealtime(conversationId);

  // Transform real-time messages to expected format
  const messages = realtimeMessages?.map((msg: any, index: number) => ({
    _id: msg._id || `msg-${index}-${Date.now()}`,
    content: msg.content,
    senderId: typeof msg.senderId === 'string' 
      ? { 
          _id: msg.senderId,
          name: '',
          image: ''
        }
      : {
          _id: msg.senderId._id || '',
          name: msg.senderId.name || '',
          image: msg.senderId.image || ''
        },
    readBy: Array.isArray(msg.readBy) 
      ? msg.readBy.map((reader: any) => ({
          _id: typeof reader === 'string' ? reader : reader._id || '',
          name: typeof reader === 'string' ? '' : reader.name || '',
          image: typeof reader === 'string' ? '' : reader.image || ''
        }))
      : [],
    createdAt: (() => {
      if (!msg.createdAt) return new Date().toISOString();
      // Handle Firebase Timestamp
      if (msg.createdAt && typeof msg.createdAt === 'object' && msg.createdAt.toDate) {
        return msg.createdAt.toDate().toISOString();
      }
      // Handle Date objects
      if (msg.createdAt instanceof Date) {
        return msg.createdAt.toISOString();
      }
      // Handle strings
      if (typeof msg.createdAt === 'string') {
        return msg.createdAt;
      }
      // Fallback
      return new Date().toISOString();
    })()
  })) || [];

  // Mark conversation as read and set as active when user opens it
  useEffect(() => {
    if (conversationId && session?.user?.email) {
      setActiveConversation(conversationId);
      markConversationAsRead(conversationId);
    }
    
    // Clean up when leaving the conversation
    return () => {
      setActiveConversation(null);
    };
  }, [conversationId, session?.user?.email, markConversationAsRead, setActiveConversation]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    // Use setTimeout to ensure DOM has updated before scrolling
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Fetch conversation details
  const fetchConversation = async () => {
    try {
      // Get conversation from Firebase
      const result = await getConversation(conversationId);
      
      if (result) {
        // Security check: Verify the current user is a participant in this conversation
        const currentUserEmail = session?.user?.email;
        if (currentUserEmail) {
          const isParticipant = result.participants?.some((p: any) => {
            const participantId = typeof p === 'string' ? p : p._id || p.email;
            return participantId === currentUserEmail;
          });
          
          if (!isParticipant) {
            // User is not a participant in this conversation, redirect to messages
            router.push('/messages');
            return;
          }
        }
        // Transform Firebase data to match expected format
        const conversationData: Conversation = {
          _id: result._id as string,
          participants: Array.isArray(result.participants) 
            ? result.participants.map((p: any, index: number) => ({
                _id: typeof p === 'string' ? p : p._id || p.email || `participant-${index}`,
                name: typeof p === 'string' ? '' : p.name || '',
                image: typeof p === 'string' ? '' : p.image || ''
              }))
            : [],
          otherParticipants: Array.isArray(result.participants) 
            ? result.participants
                .filter((p: any) => {
                  const pId = typeof p === 'string' ? p : p._id || p.email;
                  return pId !== session?.user?.email;
                })
                .map((p: any, index: number) => ({
                  _id: typeof p === 'string' ? p : p._id || p.email || `other-participant-${index}`,
                  name: typeof p === 'string' ? '' : p.name || '',
                  image: typeof p === 'string' ? '' : p.image || ''
                }))
            : [],
          isGroup: result.isGroup || false,
          name: result.name || '',
          hiddenBy: result.hiddenBy || []
        };
        
        setConversation(conversationData);
        
        // Check if this conversation is hidden by the current user
        const userEmail = session?.user?.email;
        if (userEmail && result.hiddenBy && result.hiddenBy.includes(userEmail)) {
          setIsConversationHidden(true);
        } else {
          setIsConversationHidden(false);
        }
        
        // Now enrich the participants data to avoid the flash of default content
        if (Array.isArray(result.participants)) {
          const enrichedParticipants = await enrichParticipantsWithUserData(result.participants);
          const enrichedOtherParticipants = enrichedParticipants.filter((p: Participant) => p._id !== session?.user?.email);
          
          setConversation(prev => {
            if (!prev) return null;
            return {
              ...prev,
              participants: enrichedParticipants.map((p: Participant, index: number) => ({
                _id: p._id || `enriched-participant-${index}`,
                name: p.name || '',
                image: p.image || ''
              })),
              otherParticipants: enrichedOtherParticipants.map((p: Participant, index: number) => ({
                _id: p._id || `enriched-other-participant-${index}`,
                name: p.name || '',
                image: p.image || ''
              }))
            };
          });
          setParticipantsFullyLoaded(true);
        }
      } else {
        console.error('Conversation not found');
        router.push('/messages');
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
      if (error instanceof Error && error.message === 'UNAUTHORIZED_ACCESS') {
        // User tried to access a conversation they're not part of
        router.push('/messages');
      }
    }
  };

  // Function to fetch profile data for a specific message sender
  const fetchProfileForMessage = async (messageId: string, senderId: string) => {
    // Skip deleted users
    if (senderId.startsWith('deleted_')) {
      setPendingMessages(prev => {
        const updated = new Set(prev);
        updated.delete(messageId);
        return updated;
      });
      return;
    }
    
    try {
      // First, try to get the user email from the ID
      const userResponse = await fetch(`/api/users/getEmail?userId=${encodeURIComponent(senderId)}`);
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        
        if (userData.success && userData.email) {
          // Now use the email to fetch the user profile
          const profileResponse = await fetch(`/api/user?email=${encodeURIComponent(userData.email)}`);
          
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            
            // Update the message with the profile data
            setMessages(prev => prev.map((message: Message) => {
              if (message._id === messageId) {
                // Create enhanced sender data
                const enhancedSender = {
                  ...message.senderId,
                  name: getName({ 
                    _id: senderId, 
                    profile: profileData 
                  }, profileData) || message.senderId.name,
                  image: getProfileImage({ 
                    _id: senderId, 
                    profile: profileData 
                  }) || message.senderId.image,
                  profile: profileData
                };
                
                return {
                  ...message,
                  senderId: enhancedSender
                };
              }
              return message;
            }));
            
            // Remove from pending messages
            setPendingMessages(prev => {
              const updated = new Set(prev);
              updated.delete(messageId);
              return updated;
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching profile for message:', error);
      // Remove from pending even on error to avoid infinite retries
      setPendingMessages(prev => {
        const updated = new Set(prev);
        updated.delete(messageId);
        return updated;
      });
    }
  };

  // Helper function to get user name from session or first name from survey
  const getUserName = async () => {
    if (!session?.user?.email) return '';
    
    try {
      // Use API call instead of direct Firebase access
      const response = await fetch(`/api/user?email=${encodeURIComponent(session.user.email)}`);
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.surveyData?.firstName && typeof result.surveyData.firstName === 'string' && result.surveyData.firstName.trim()) {
          return result.surveyData.firstName.trim();
        }
      }
      
      // Fallback to session name
      return session.user.name || '';
    } catch (error) {
      console.error('Error getting user name:', error);
      return session.user.name || '';
    }
  };

  // Send a new message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !session?.user?.email) return;
    
    setIsSending(true);
    
    try {
      // Get the proper user name
      const userName = await getUserName();
      
      // Get current user's image, ensuring we have the correct one
      const userImage = session.user.image || '';
      
      // Create the sender data with complete profile information
      const senderData = {
        _id: session.user.email,
        name: userName,
        image: userImage,
        profile: {
          firstName: userName,
          userProfile: {
            image: userImage
          },
          surveyData: {
            firstName: userName,
            image: userImage
          }
        }
      };

      // Create the message object
      const messageContent = newMessage;
      const messageId = `temp-${Date.now()}`;
      const now = new Date().toISOString();
      
      // Immediately add the message to local state first to prevent UI flicker
      const localMessage = {
        _id: messageId,
        content: messageContent,
        senderId: senderData,
        readBy: [{ _id: session.user.email, name: userName, image: userImage }],
        createdAt: now
      };
      
      setNewMessage(''); // Clear input immediately
      
      // Scroll to bottom immediately for better UX
      scrollToBottom();
      
      // Create a new message in Firebase with complete data
      const messageData = {
        content: messageContent,
        conversationId: conversationId,
        senderId: session.user.email, // Send just the email, server will handle the rest
        readBy: [session.user.email] // Mark as read by sender
      };
      
      // Send to Firebase - the real-time listener will automatically update the UI
      await createMessage(messageData);
      
    } catch (error) {
      console.error('Error sending message:', error);
      // Optionally notify the user about the error
    } finally {
      setIsSending(false);
    }
  };

  // Helper function to check if a participant is a deleted user
  const isDeletedUser = (participant: any): boolean => {
    return participant?.isDeleted === true || participant?._id?.startsWith('deleted_');
  };

  // Modify handleProfileClick to handle deleted users
  const handleProfileClick = async (participant: Participant) => {
    // Skip if clicking on own profile or a deleted user
    if (participant._id === session?.user?.id || 
        participant._id === session?.user?.email || 
        isDeletedUser(participant)) {
      return;
    }
    
    // Set the selected user
    setSelectedUser({
      email: participant._id,
      name: participant.name,
      image: participant.image
    });
    
    setLoadingUserProfile(true);
    
    try {
      // First, try to get the user email from the ID
      const userResponse = await fetch(`/api/users/getEmail?userId=${encodeURIComponent(participant._id)}`);
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.success && userData.email) {
          // Now use the email to fetch the user profile
          const profileResponse = await fetch(`/api/user?email=${encodeURIComponent(userData.email)}`);
          
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            setUserProfile(profileData);
          } else {
            console.error('Failed to fetch user profile');
            setUserProfile(null);
          }
        } else {
          console.error('Failed to get user email');
          setUserProfile(null);
        }
      } else {
        console.error('Failed to fetch user email');
        setUserProfile(null);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile(null);
    } finally {
      setLoadingUserProfile(false);
    }
  };

  const handleReportSuccess = () => {
    setShowReportModal(false);
  };

  useEffect(() => {
    if (!session) {
      router.push('/');
      return;
    }
    
    // Immediately show loading state
    setIsLoading(true);
    
    // Fetch conversation data with priority
    const loadData = async () => {
      await fetchConversation();
      setIsLoading(false); // Set loading to false after conversation is loaded
    };
    
    loadData();
  }, [session, conversationId, router]);

  // Effect to auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Update loading state based on messages loading
  useEffect(() => {
    if (!messagesLoading && conversation) {
      setIsLoading(false);
    }
  }, [messagesLoading, conversation]);

  // Effect to close the participants menu when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const menu = document.getElementById('participants-menu');
      const groupIcon = document.querySelector('.group-icon');
      
      if (menu && !menu.classList.contains('hidden')) {
        // Check if the click is outside the menu and group icon
        if (!menu.contains(event.target as Node) && !groupIcon?.contains(event.target as Node)) {
          menu.classList.add('hidden');
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add a helper notification
  useEffect(() => {
    if (conversation && !localStorage.getItem('profile_click_tip_shown')) {
      const tipTimeout = setTimeout(() => {
        const tipElement = document.getElementById('profile-click-tip');
        if (tipElement) {
          tipElement.classList.remove('opacity-0');
          tipElement.classList.add('opacity-100');
          
          setTimeout(() => {
            tipElement.classList.remove('opacity-100');
            tipElement.classList.add('opacity-0');
            
            // Mark as shown in localStorage so we don't show it again
            localStorage.setItem('profile_click_tip_shown', 'true');
          }, 5000);
        }
      }, 2000);
      
      return () => clearTimeout(tipTimeout);
    }
  }, [conversation]);

  // In the messages section, update the handleProfileClick to fetch profile data for all users:
  useEffect(() => {
    // Fetch profiles for all unique sender IDs to ensure names display correctly
    const fetchAllProfiles = async () => {
      if (!messages || messages.length === 0) return;
      
      // Get unique sender IDs
      const uniqueSenderIds = Array.from(new Set(messages.map(message => message.senderId._id)));
      
      // For each sender, fetch their profile if not current user and not deleted
      for (const senderId of uniqueSenderIds) {
        if (senderId === session?.user?.id || senderId === session?.user?.email) {
          continue;
        }
        
        // Skip deleted users
        if (senderId.startsWith('deleted_')) {
          continue;
        }
        
        try {
          // First, try to get the user email from the ID
          const userResponse = await fetch(`/api/users/getEmail?userId=${encodeURIComponent(senderId)}`);
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            
            if (userData.success && userData.email) {
              // Now use the email to fetch the user profile
              const profileResponse = await fetch(`/api/user?email=${encodeURIComponent(userData.email)}`);
              
              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                
                // Store profile with the message senders
                setMessages(prev => prev.map(message => {
                  if (message.senderId._id === senderId) {
                    return {
                      ...message,
                      senderId: {
                        ...message.senderId,
                        profile: profileData
                      }
                    };
                  }
                  return message;
                }));
              } else {
                // Profile fetch failed
              }
            } else {
              // Email fetch success but no email found
            }
          } else {
            // Email fetch failed
          }
        } catch (error) {
          // Error fetching profile for sender
        }
      }
    };
    
    if (messages.length > 0) {
      fetchAllProfiles();
    }
  }, [messages.length, session?.user?.id, session?.user?.email]);

  // Update the helper function to get profile image from the correct paths
  const getProfileImage = (user: any): string | null => {
    if (!user) return null;
    
    // Special case for deleted users
    if (isDeletedUser(user)) {
      // Return a generic "deleted user" image
      return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E';
    }
    
    // Check all possible image paths in order of preference
    if (user.image && user.image !== "") return user.image;
    
    // Check nested profile paths
    if (user.profile) {
      // Check userProfile paths
      if (user.profile.userProfile) {
        if (user.profile.userProfile.image) return user.profile.userProfile.image;
        if (user.profile.userProfile.imageUrl) return user.profile.userProfile.imageUrl;
        if (user.profile.userProfile.profileImageUrl) return user.profile.userProfile.profileImageUrl;
      }
      
      // Check surveyData paths
      if (user.profile.surveyData) {
        if (user.profile.surveyData.imageUrl) return user.profile.surveyData.imageUrl;
        if (user.profile.surveyData.profileImageUrl) return user.profile.surveyData.profileImageUrl;
        if (user.profile.surveyData.image) return user.profile.surveyData.image;
      }
      
      // Check direct profile paths
      if (user.profile.imageUrl) return user.profile.imageUrl;
      if (user.profile.image) return user.profile.image;
    }
    
    // No image found
    return null;
  };

  // Also update the getName function to check the correct profile paths
  const getName = (user: {_id?: string, name?: string, email?: string, profile?: any, isDeleted?: boolean} | null, fullProfile?: any): string => {
    if (!user) return 'Unknown User';
    
    // If this is a deleted user, return "Deleted User"
    if (isDeletedUser(user)) {
      return "Deleted User";
    }
    
    // Check if this is the current user - if so, just return "You"
    if (user._id === session?.user?.id || user._id === session?.user?.email) {
      return "You";
    }
    
    // Check in the profile.surveyData path first (based on console output)
    if (user.profile?.surveyData?.firstName && typeof user.profile.surveyData.firstName === 'string' && user.profile.surveyData.firstName.trim() !== '') {
      return user.profile.surveyData.firstName;
    }
    
    // Then check in profile.userProfile path
    if (user.profile?.userProfile?.firstName && typeof user.profile.userProfile.firstName === 'string' && user.profile.userProfile.firstName.trim() !== '') {
      return user.profile.userProfile.firstName;
    }
    
    // Combine profile objects to check all possible places for firstName
    const combinedProfile = { 
      ...user.profile,
      ...fullProfile
    };
    
    // Look for firstName in all possible locations (highest priority first)
    
    // Direct firstName property in any profile
    if (combinedProfile?.firstName && typeof combinedProfile.firstName === 'string' && combinedProfile.firstName.trim() !== '') {
      return combinedProfile.firstName;
    }
    
    // Survey firstName
    if (combinedProfile?.survey?.firstName && typeof combinedProfile.survey.firstName === 'string' && combinedProfile.survey.firstName.trim() !== '') {
      return combinedProfile.survey.firstName;
    }
    
    // Check user's own profile data
    if (user.profile?.firstName && typeof user.profile.firstName === 'string' && user.profile.firstName.trim() !== '') {
      return user.profile.firstName;
    }
    
    if (user.profile?.survey?.firstName && typeof user.profile.survey.firstName === 'string' && user.profile.survey.firstName.trim() !== '') {
      return user.profile.survey.firstName;
    }
    
    // Next try to get firstName from user profile api
    if (user.name && user.name !== 'User' && user.name.trim() !== '') {
      // If name contains space, try to get first name
      if (user.name.includes(' ')) {
        return user.name.split(' ')[0];
      }
      return user.name;
    }
    
    // Return 'User' instead of extracting from email
    return 'User';
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      
      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === yesterday.toDateString()) {
          return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
          return date.toLocaleDateString([], { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit'
          });
        }
      }
    } catch (e) {
      return dateString;
    }
  };

  // Add back CSS for smooth transitions
  useEffect(() => {
    // Add CSS for smooth message animations
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .message-animate {
        animation: slideUp 0.2s ease-out forwards;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Add a conditional rendering based on loading state
  if (isLoading && !participantsFullyLoaded) {
    return (
      <div className="flex flex-col bg-gray-50 dark:bg-gray-900" style={{ height: 'calc(100vh - 4rem)' }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-center">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-col bg-gray-50 dark:bg-gray-900" style={{ height: 'calc(100vh - 4rem)' }}>
        {/* Header - Always visible */}
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 flex justify-between items-center">
          <>
            <div className="animate-pulse h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="animate-pulse h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          </>
        </div>
        
        {/* Messages Window - Contained scrollable area */}
        <div className="flex-1 p-4 min-h-0">
          <div className="h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="animate-pulse flex flex-col">
                    <div className={`${i % 2 === 0 ? 'mr-auto' : 'ml-auto'} max-w-[70%]`}>
                      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg mb-1"></div>
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded self-end mt-1"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Message Input - Always visible at bottom */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <form className="flex space-x-2">
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200 dark:border-gray-600"
              disabled
            />
            <button
              type="submit"
              className="bg-blue-500 text-white rounded-lg px-4 py-2 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              disabled
            >
              Send
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-gray-50 dark:bg-gray-900" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Header - Always visible */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 flex justify-between items-center">
        {!conversation ? (
          <>
            <div className="animate-pulse h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="animate-pulse h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          </>
        ) : (
          <>
            <div className="flex items-center space-x-3">
              <Link 
                href="/messages"
                className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  {/* Show group icon only for actual group chats (3+ people) */}
                  {conversation.isGroup && conversation.participants.length > 2 ? (
                    <div 
                      className="cursor-pointer group-icon"
                      onClick={() => {
                        // Show a list of participants that can be clicked
                        const menu = document.getElementById('participants-menu');
                        if (menu) {
                          menu.classList.toggle('hidden');
                        }
                      }}
                    >
                      <LayeredAvatars 
                        participants={conversation.participants}
                        size={40}
                        maxDisplay={3}
                      />
                      {/* Participants dropdown menu */}
                      <div id="participants-menu" className="absolute top-12 left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700 hidden">
                        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Group Participants</h3>
                        </div>
                        <div className="py-1 max-h-64 overflow-y-auto">
                          {conversation.participants.map((participant) => (
                            <div
                              key={participant._id}
                              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
                              onClick={() => {
                                // Close the menu
                                const menu = document.getElementById('participants-menu');
                                if (menu) {
                                  menu.classList.add('hidden');
                                }
                                // Only handle click for other participants
                                if (participant._id !== session?.user?.id) {
                                  handleProfileClick(participant);
                                }
                              }}
                            >
                              <div className="relative w-8 h-8 mr-2 group">
                                <Image
                                  src={participant.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E'}
                                  alt={participant.name}
                                  fill
                                  sizes="(max-width: 768px) 32px, 32px"
                                  className="rounded-full object-cover hover:ring-2 hover:ring-blue-500 transition-all"
                                />
                                {participant._id === session?.user?.id || participant._id === session?.user?.email ? (
                                  <span className="absolute bottom-0 right-0 bg-green-500 rounded-full w-3 h-3 border-2 border-white dark:border-gray-800"></span>
                                ) : (
                                  <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full w-3 h-3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-white dark:border-gray-800">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <span className="text-sm text-gray-800 dark:text-gray-200">
                                  {getName(participant, userProfile)}
                                  {participant._id === session?.user?.id || participant._id === session?.user?.email ? ' (You)' : ''}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-10 h-10 group">
                      {/* Show loading or user profile picture */}
                      {!participantsFullyLoaded || !conversation.otherParticipants.length ? (
                        <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse" />
                      ) : conversation.otherParticipants[0]?.image ? (
                        <Image
                          src={conversation.otherParticipants[0].image}
                          alt={conversation.otherParticipants[0]?.name || 'User'}
                          fill
                          sizes="(max-width: 768px) 40px, 40px"
                          className="rounded-full object-cover cursor-pointer ring-offset-2 ring-transparent hover:ring-2 hover:ring-blue-500 transition-all"
                          onClick={() => handleProfileClick(conversation.otherParticipants[0])}
                          title="View profile"
                        />
                      ) : (
                        <UserAvatar 
                          size={40} 
                          letter={conversation.otherParticipants[0]?.name?.charAt(0)?.toUpperCase() || 'U'}
                        />
                      )}
                      {participantsFullyLoaded && conversation.otherParticipants.length > 0 && (
                        <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="font-semibold text-gray-900 dark:text-gray-100">
                    {/* For DMs (2 people total or non-group), show the other user's name */}
                    {!conversation.isGroup || conversation.participants.length === 2
                      ? (conversation.otherParticipants.length > 0 
                          ? (participantsFullyLoaded 
                              ? getName(conversation.otherParticipants[0], userProfile)
                              : 'Loading...')
                          : 'Loading...')
                      : conversation.name || 'Group Chat'}
                    {isConversationHidden && (
                      <span className="ml-2 text-sm text-gray-400 dark:text-gray-500 font-normal">
                        (HIDDEN)
                      </span>
                    )}
                  </h1>
                  {/* Only show participant count for actual group chats (3+ people) */}
                  {conversation.isGroup && conversation.participants.length > 2 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {conversation.participants.length} participants
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Menu button positioned at the far right corner */}
            <div className="relative">
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Conversation menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              
              {/* Dropdown menu */}
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
                  <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                    <button
                      onClick={() => setShowChatInfo(true)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      role="menuitem"
                    >
                      Members List
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Tip notification */}
      <div 
        id="profile-click-tip" 
        className="fixed top-16 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-md shadow-lg opacity-0 transition-opacity duration-300 z-20 flex items-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Tip: Click on profile pictures to view user details</span>
      </div>

      {/* Messages Window - Contained scrollable area */}
      <div className="flex-1 p-4 min-h-0">
        <div className="h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
            {!conversation ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="animate-pulse flex flex-col">
                    <div className={`${i % 2 === 0 ? 'mr-auto' : 'ml-auto'} max-w-[70%]`}>
                      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg mb-1"></div>
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded self-end mt-1"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-4 inline-block mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                    Start the conversation
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Send a message to begin chatting
                  </p>
                </div>
              </div>
            ) : (
              messages
                .filter((message) => {
                  const isCurrentUser = message.senderId._id === session?.user?.id || 
                                         message.senderId._id === session?.user?.email;
                  const isPending = pendingMessages.has(message._id);
                  
                  // Only include messages that aren't pending or are from the current user
                  return !isPending || isCurrentUser;
                })
                .map((message) => {
                  const isCurrentUser = message.senderId._id === session?.user?.id || 
                                         message.senderId._id === session?.user?.email;
                
                return (
                  <div
                    key={message._id}
                    className={`flex ${
                      isCurrentUser
                        ? 'justify-end items-start'
                        : 'justify-start items-start'
                    } mb-2 message-animate`}
                    style={{ marginBottom: '10px' }}
                  >
                    {!isCurrentUser && (
                      <div className="flex-shrink-0 mr-2 mt-0.5">
                        <div
                          className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center cursor-pointer"
                          onClick={() =>
                            handleProfileClick(message.senderId)
                          }
                        >
                          {getProfileImage(message.senderId) ? (
                            <Image
                              src={getProfileImage(message.senderId) as string}
                              alt="User Avatar"
                              width={32}
                              height={32}
                              className="rounded-full border border-gray-200 dark:border-gray-600"
                            />
                          ) : (
                            <UserAvatar 
                              size={32} 
                              letter={getName(message.senderId, message.senderId.profile)?.charAt(0)}
                            />
                          )}
                        </div>
                      </div>
                    )}
                    <div className={`flex flex-col ${isCurrentUser ? 'items-end mr-1' : 'items-start'} max-w-[70%]`}>
                      {!isCurrentUser && (
                        <span 
                          className="text-xs text-gray-600 dark:text-gray-300 mb-0.5 cursor-pointer"
                          onClick={() => handleProfileClick(message.senderId)}
                        >
                          {getName(message.senderId, message.senderId.profile)}
                        </span>
                      )}
                      <div
                        className={`rounded-lg py-1.5 px-2.5 text-sm break-words ${
                          isCurrentUser
                            ? 'bg-blue-500 text-white rounded-tr-none'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-none'
                        } w-auto inline-block`}
                        style={{
                          maxWidth: '100%',
                          width: 'auto',
                          display: 'inline-block'
                        }}
                      >
                        {message.content}
                      </div>
                      <div className={`text-xs text-gray-500 dark:text-gray-400 mt-0.5 ${isCurrentUser ? 'text-right' : 'text-left'}`} style={{width: 'auto', fontSize: '0.75rem'}}>
                        {formatDate(message.createdAt)}
                      </div>
                    </div>
                    {isCurrentUser && (
                      <div className="flex-shrink-0 ml-1 mt-0.5">
                        <div
                          className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center cursor-pointer"
                        >
                          {session?.user?.image ? (
                            <Image
                              src={session.user.image}
                              alt="Your Avatar"
                              width={32}
                              height={32}
                              className="rounded-full border border-gray-200 dark:border-gray-600"
                            />
                          ) : (
                            <UserAvatar 
                              size={32} 
                              letter={session?.user?.name?.charAt(0) || 'Y'} 
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Message Input - Always visible at bottom */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200 dark:border-gray-600"
            disabled={isSending}
          />
          <button
            type="submit"
            className="bg-blue-500 text-white rounded-lg px-4 py-2 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
              'Send'
            )}
          </button>
        </form>
      </div>

      {/* Chat Info Modal */}
      {showChatInfo && (
        <ChatInfoModal
          conversation={conversation}
          currentUserId={session?.user?.email || session?.user?.id}
          onClose={() => setShowChatInfo(false)}
          onViewProfile={(participant) => {
            setShowChatInfo(false);
            handleProfileClick(participant);
          }}
        />
      )}

      {/* Other modals */}
      {selectedUser && (
        <UserProfileModal
          userData={userProfile}
          userProfile={{
            name: selectedUser.name,
            email: selectedUser.email,
            image: selectedUser.image
          }}
          onClose={() => setSelectedUser(null)}
          onReport={() => {
            setSelectedUser(null);
            setShowReportModal(true);
          }}
          loading={loadingUserProfile}
        />
      )}

      {showReportModal && (
        <ReportUserModal
          targetUserId={selectedUser?.email}
          onClose={() => setShowReportModal(false)}
          onSuccess={handleReportSuccess}
        />
      )}
    </div>
  );
} 