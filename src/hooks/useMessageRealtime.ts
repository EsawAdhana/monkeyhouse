'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useServerRealtime } from './useServerRealtime';
import { useNotifications } from '@/contexts/NotificationContext';
import { useUnreadCounts } from './useUnreadCounts';

export function useMessageRealtime(conversationId?: string) {
  const { data: session } = useSession();
  const { setUnreadCount } = useNotifications();
  const { calculateUnreadCount } = useUnreadCounts();

  // Use server-side real-time for messages in a specific conversation
  const { data: messages, loading, error } = useServerRealtime<any[]>({
    endpoint: conversationId ? `/api/realtime/messages/${conversationId}` : '',
    enabled: !!conversationId && !!session?.user?.email,
    onData: (messagesData: any[]) => {
      if (messagesData && conversationId) {
        // Calculate unread count for this conversation
        const unreadCount = calculateUnreadCount(messagesData);
        setUnreadCount(conversationId, unreadCount);
      }
    },
    onError: (err) => {
      console.error('Real-time message error:', err);
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

  // Note: This approach would require multiple SSE connections
  // For better performance, consider creating a single endpoint that handles all conversations
  useEffect(() => {
    if (!session?.user?.email || conversationIds.length === 0) return;

    console.log('Setting up global message real-time listeners for conversations:', conversationIds);

    // In a production implementation, you might want to create a single endpoint
    // that handles multiple conversations to avoid too many SSE connections
    // For now, we'll disable this hook and rely on the NotificationContext
    
  }, [session?.user?.email, conversationIds, setUnreadCount, calculateUnreadCount]);

  return {
    setConversationIds
  };
} 