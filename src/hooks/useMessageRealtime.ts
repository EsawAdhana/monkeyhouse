'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useFirebaseRealtime } from './useFirebaseRealtime';
import { db, collection, query, where, orderBy } from '@/lib/firebase';
import { useNotifications } from '@/contexts/NotificationContext';
import { useUnreadCounts } from './useUnreadCounts';

export function useMessageRealtime(conversationId?: string) {
  const { data: session } = useSession();
  const { setUnreadCount } = useNotifications();
  const { calculateUnreadCount } = useUnreadCounts();

  // Set up real-time listener for messages in a specific conversation
  const messagesQuery = conversationId 
    ? query(
        collection(db, 'messages'),
        where('conversationId', '==', conversationId),
        orderBy('createdAt', 'asc')
      )
    : null;

  // Listen to messages in real-time
  const { data: messages, loading, error } = useFirebaseRealtime({
    enabled: !!conversationId && !!session?.user?.email,
    subscriptionType: 'query',
    target: messagesQuery!,
    onData: (messagesData: any[]) => {
      if (messagesData && conversationId) {
        // Calculate unread count for this conversation
        const unreadCount = calculateUnreadCount(messagesData);
        setUnreadCount(conversationId, unreadCount);
      }
    }
  });

  return {
    messages: messages || [],
    loading,
    error
  };
}

// Hook to listen to ALL messages for unread count updates
export function useGlobalMessageRealtime() {
  const { data: session } = useSession();
  const { setUnreadCount } = useNotifications();
  const { calculateUnreadCount } = useUnreadCounts();
  const [conversationIds, setConversationIds] = useState<string[]>([]);

  // Set up real-time listener for all messages the user is involved in
  useEffect(() => {
    if (!session?.user?.email || conversationIds.length === 0) return;

    const unsubscribers: (() => void)[] = [];

    // Listen to messages for each conversation
    conversationIds.forEach(conversationId => {
      const messagesQuery = query(
        collection(db, 'messages'),
        where('conversationId', '==', conversationId),
        orderBy('createdAt', 'asc')
      );

      // This will set up individual listeners for each conversation
      const { data: messages } = useFirebaseRealtime({
        enabled: true,
        subscriptionType: 'query',
        target: messagesQuery,
        onData: (messagesData: any[]) => {
          if (messagesData) {
            const unreadCount = calculateUnreadCount(messagesData);
            setUnreadCount(conversationId, unreadCount);
          }
        }
      });
    });

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [session?.user?.email, conversationIds, setUnreadCount, calculateUnreadCount]);

  return {
    setConversationIds
  };
} 