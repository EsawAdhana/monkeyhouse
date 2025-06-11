'use client';

import { useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface Message {
  _id: string;
  readBy: any[];
  senderId: {
    _id: string;
  };
}

export function useUnreadCounts() {
  const { data: session } = useSession();

  // Calculate unread count for a conversation based on messages
  const calculateUnreadCount = useCallback((messages: Message[]) => {
    if (!session?.user?.email || !messages) return 0;

    const userEmail = session.user.email;
    
    return messages.filter(message => {
      // Don't count messages sent by the current user
      if (message.senderId._id === userEmail) {
        return false;
      }

      // Check if current user is in the readBy array
      const readBy = Array.isArray(message.readBy) ? message.readBy : [];
      const isRead = readBy.some((reader: any) => {
        if (typeof reader === 'string') {
          return reader === userEmail;
        }
        return reader._id === userEmail || reader.email === userEmail;
      });

      return !isRead; // Count as unread if user is not in readBy array
    }).length;
  }, [session?.user?.email]);

  // Calculate unread counts for multiple conversations
  const calculateUnreadCounts = useCallback((conversationsWithMessages: { 
    conversationId: string; 
    messages: Message[] 
  }[]) => {
    const unreadCounts: { [conversationId: string]: number } = {};
    
    conversationsWithMessages.forEach(({ conversationId, messages }) => {
      unreadCounts[conversationId] = calculateUnreadCount(messages);
    });

    return unreadCounts;
  }, [calculateUnreadCount]);

  return {
    calculateUnreadCount,
    calculateUnreadCounts,
  };
} 