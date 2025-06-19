'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { useServerRealtime } from '@/hooks/useServerRealtime';

interface UnreadCounts {
  [conversationId: string]: number;
}

interface NotificationContextType {
  unreadCounts: UnreadCounts;
  totalUnreadCount: number;
  activeConversationId: string | null;
  conversations: any[];
  conversationsLoading: boolean;
  setUnreadCount: (conversationId: string, count: number) => void;
  markConversationAsRead: (conversationId: string) => void;
  hasUnreadMessages: (conversationId: string) => boolean;
  getUnreadCount: (conversationId: string) => number;
  setActiveConversation: (conversationId: string | null) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const { calculateUnreadCount } = useUnreadCounts();

  // Calculate total unread count across all conversations
  const totalUnreadCount = Object.values(unreadCounts).reduce((total, count) => total + count, 0);

  // Listen to conversations in real-time using server-side endpoint
  const { data: conversations, loading: conversationsLoading } = useServerRealtime<any[]>({
    endpoint: '/api/realtime/conversations',
    enabled: !!session?.user?.email,
    onData: (conversationsData: any[]) => {
      if (conversationsData && conversationsData.length > 0) {
        // When conversations change, recalculate unread counts
        updateUnreadCountsFromConversations(conversationsData);
      }
    },
    onError: (error) => {
      console.error('Real-time conversations error:', error);
    }
  });

  // Function to update unread counts when conversation data changes
  const updateUnreadCountsFromConversations = useCallback(async (conversationsData: any[]) => {
    if (!session?.user?.email || !conversationsData) return;

    const userEmail = session.user.email;
    const newUnreadCounts: UnreadCounts = {};
    
    // Filter out conversations hidden by the current user
    const visibleConversations = conversationsData.filter((conversation: any) => {
      const hiddenBy = conversation.hiddenBy || [];
      return !hiddenBy.includes(userEmail);
    });
    
    // For each visible conversation, fetch messages and calculate unread count
    await Promise.all(
      visibleConversations.map(async (conversation: any) => {
        try {
          const messagesResponse = await fetch(`/api/messages?conversationId=${conversation._id}`);
          if (messagesResponse.ok) {
            const messagesResult = await messagesResponse.json();
            if (messagesResult.success && messagesResult.data) {
              const unreadCount = calculateUnreadCount(messagesResult.data);
              // If this is the active conversation, don't show unread count
              newUnreadCounts[conversation._id] = activeConversationId === conversation._id ? 0 : unreadCount;
            }
          }
        } catch (error) {
          console.error(`Error fetching messages for conversation ${conversation._id}:`, error);
        }
      })
    );
    
    setUnreadCounts(newUnreadCounts);
  }, [session?.user?.email, calculateUnreadCount, activeConversationId]);

  // Set unread count for a specific conversation
  const setUnreadCount = useCallback((conversationId: string, count: number) => {
    // Check if this conversation is hidden by the current user
    const conversation = conversations?.find((conv: any) => conv._id === conversationId);
    if (conversation) {
      const hiddenBy = conversation.hiddenBy || [];
      const userEmail = session?.user?.email;
      if (userEmail && hiddenBy.includes(userEmail)) {
        // Don't set unread count for hidden conversations
        return;
      }
    }
    
    // If this is the active conversation, always set count to 0
    const finalCount = activeConversationId === conversationId ? 0 : Math.max(0, count);
    
    setUnreadCounts(prev => ({
      ...prev,
      [conversationId]: finalCount
    }));
  }, [activeConversationId, conversations, session?.user?.email]);

  // Mark conversation as read (set count to 0)
  const markConversationAsRead = useCallback(async (conversationId: string) => {
    setUnreadCounts(prev => ({
      ...prev,
      [conversationId]: 0
    }));

    // Call API to mark messages as read in the backend
    if (session?.user?.email) {
      try {
        await fetch(`/api/conversations/${conversationId}/mark-read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Error marking conversation as read:', error);
      }
    }
  }, [session?.user?.email]);

  // Set active conversation
  const setActiveConversation = useCallback((conversationId: string | null) => {
    setActiveConversationId(conversationId);
    
    // When entering a conversation, immediately mark it as read
    if (conversationId) {
      setUnreadCounts(prev => ({
        ...prev,
        [conversationId]: 0
      }));
    }
  }, []);

  // Check if conversation has unread messages
  const hasUnreadMessages = useCallback((conversationId: string) => {
    return (unreadCounts[conversationId] || 0) > 0;
  }, [unreadCounts]);

  // Get unread count for specific conversation
  const getUnreadCount = useCallback((conversationId: string) => {
    return unreadCounts[conversationId] || 0;
  }, [unreadCounts]);

  const value: NotificationContextType = {
    unreadCounts,
    totalUnreadCount,
    activeConversationId,
    conversations: conversations || [],
    conversationsLoading,
    setUnreadCount,
    markConversationAsRead,
    hasUnreadMessages,
    getUnreadCount,
    setActiveConversation,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
} 