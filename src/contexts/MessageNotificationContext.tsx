'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

interface UnreadConversation {
  conversationId: string;
  unreadCount: number;
}

interface MessageNotificationContextType {
  unreadCount: number;
  unreadByConversation: UnreadConversation[];
  refreshUnreadCount: () => Promise<void>;
  decrementUnreadCount: (conversationId: string) => void;
  hasUnreadMessages: (conversationId: string) => boolean;
  getUnreadCount: (conversationId: string) => number;
}

const MessageNotificationContext = createContext<MessageNotificationContextType | undefined>(undefined);

export function MessageNotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadByConversation, setUnreadByConversation] = useState<UnreadConversation[]>([]);
  const { data: session } = useSession();
  const pathname = usePathname();
  const isFetchingRef = useRef(false);
  
  const fetchUnreadCount = useCallback(async () => {
    if (!session?.user?.email || isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      
      // Use API route instead of direct Firebase service call
      const response = await fetch('/api/messages/unread');
      if (!response.ok) {
        throw new Error('Failed to fetch unread messages');
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch unread messages');
      }
      
      const unreadData = result.data;
      
      setUnreadCount(unreadData.totalUnread);
      
      // Convert the byConversation object to array format
      const conversationArray = Object.entries(unreadData.byConversation).map(([conversationId, unreadCount]) => ({
        conversationId,
        unreadCount: unreadCount as number
      }));
      
      setUnreadByConversation(conversationArray);
    } catch (error) {
      console.error('Error fetching unread messages count:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [session?.user?.email]);
  
  const refreshUnreadCount = async () => {
    await fetchUnreadCount();
  };
  
  const decrementUnreadCount = (conversationId: string) => {
    // Update unread count state
    setUnreadByConversation(prev => {
      const updatedConversations = prev.map(conv => {
        if (conv.conversationId === conversationId) {
          return {
            ...conv,
            unreadCount: Math.max(0, conv.unreadCount - 1)
          };
        }
        return conv;
      });
      
      // Recalculate total
      const newTotal = updatedConversations.reduce((total, conv) => total + conv.unreadCount, 0);
      setUnreadCount(newTotal);
      
      return updatedConversations;
    });
  };
  
  const hasUnreadMessages = (conversationId: string) => {
    return unreadByConversation.some(conv => 
      conv.conversationId === conversationId && conv.unreadCount > 0
    );
  };
  
  const getUnreadCount = (conversationId: string) => {
    const conversation = unreadByConversation.find(conv => conv.conversationId === conversationId);
    return conversation?.unreadCount || 0;
  };
  
  useEffect(() => {
    if (!session?.user?.email) return;
    
    // Initial fetch
    fetchUnreadCount();
    
    // Set up polling every 5 seconds
    const interval = setInterval(fetchUnreadCount, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, [session?.user?.email, fetchUnreadCount]);
  
  return (
    <MessageNotificationContext.Provider 
      value={{ 
        unreadCount,
        unreadByConversation,
        refreshUnreadCount,
        decrementUnreadCount,
        hasUnreadMessages,
        getUnreadCount
      }}
    >
      {children}
    </MessageNotificationContext.Provider>
  );
}

export function useMessageNotifications() {
  const context = useContext(MessageNotificationContext);
  if (context === undefined) {
    throw new Error('useMessageNotifications must be used within a MessageNotificationProvider');
  }
  return context;
} 