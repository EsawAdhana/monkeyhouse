'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { useFirebaseRealtime } from '@/hooks/useFirebaseRealtime';
import { db, collection, query, where } from '@/lib/firebase';

interface UnreadCounts {
  [conversationId: string]: number;
}

interface NotificationContextType {
  unreadCounts: UnreadCounts;
  totalUnreadCount: number;
  setUnreadCount: (conversationId: string, count: number) => void;
  markConversationAsRead: (conversationId: string) => void;
  hasUnreadMessages: (conversationId: string) => boolean;
  getUnreadCount: (conversationId: string) => number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const { calculateUnreadCount } = useUnreadCounts();

  // Calculate total unread count across all conversations
  const totalUnreadCount = Object.values(unreadCounts).reduce((total, count) => total + count, 0);

  // Set up real-time listeners for conversations
  const conversationsQuery = session?.user?.email 
    ? query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', session.user.email)
      )
    : null;

  // Listen to conversations in real-time
  const { data: conversations } = useFirebaseRealtime({
    enabled: !!session?.user?.email,
    subscriptionType: 'query',
    target: conversationsQuery!,
    onData: (conversationsData: any[]) => {
      if (conversationsData && conversationsData.length > 0) {
        // When conversations change, recalculate unread counts
        updateUnreadCountsFromConversations(conversationsData);
      }
    }
  });

  // Function to update unread counts when conversation data changes
  const updateUnreadCountsFromConversations = useCallback(async (conversationsData: any[]) => {
    if (!session?.user?.email || !conversationsData) return;

    const newUnreadCounts: UnreadCounts = {};
    
    // For each conversation, fetch messages and calculate unread count
    await Promise.all(
      conversationsData.map(async (conversation: any) => {
        try {
          const messagesResponse = await fetch(`/api/messages?conversationId=${conversation._id}`);
          if (messagesResponse.ok) {
            const messagesResult = await messagesResponse.json();
            if (messagesResult.success && messagesResult.data) {
              const unreadCount = calculateUnreadCount(messagesResult.data);
              newUnreadCounts[conversation._id] = unreadCount;
            }
          }
        } catch (error) {
          console.error(`Error fetching messages for conversation ${conversation._id}:`, error);
        }
      })
    );
    
    setUnreadCounts(newUnreadCounts);
  }, [session?.user?.email, calculateUnreadCount]);

  // Set unread count for a specific conversation
  const setUnreadCount = useCallback((conversationId: string, count: number) => {
    setUnreadCounts(prev => ({
      ...prev,
      [conversationId]: Math.max(0, count)
    }));
  }, []);

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
    setUnreadCount,
    markConversationAsRead,
    hasUnreadMessages,
    getUnreadCount,
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