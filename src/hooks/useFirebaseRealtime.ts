import { useEffect, useState, useRef, useCallback } from 'react';
import { onSnapshot, Query, DocumentData, DocumentReference } from 'firebase/firestore';
import { useServerRealtime } from './useServerRealtime';

type SubscriptionType = 'query' | 'document';

interface UseFirebaseRealtimeOptions<T> {
  enabled?: boolean;
  subscriptionType: SubscriptionType;
  target: Query<DocumentData> | DocumentReference<DocumentData>;
  onData?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useFirebaseRealtime<T>({
  enabled = true,
  subscriptionType,
  target,
  onData,
  onError
}: UseFirebaseRealtimeOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Store callbacks in refs to avoid dependency issues
  const onDataRef = useRef(onData);
  const onErrorRef = useRef(onError);
  
  // Update refs when callbacks change
  useEffect(() => {
    onDataRef.current = onData;
    onErrorRef.current = onError;
  }, [onData, onError]);

  // Determine endpoint based on target
  const endpoint = useCallback(() => {
    // This is a simplified approach - in a real implementation you'd need to 
    // parse the Firebase query to determine the appropriate endpoint
    
    // For now, we'll use a basic heuristic based on the target
    const targetString = target?.toString() || '';
    
    if (targetString.includes('conversations')) {
      return '/api/realtime/conversations';
    } else if (targetString.includes('messages')) {
      // Extract conversation ID from the query
      // This is a simplification - you might need more robust query parsing
      const conversationIdMatch = targetString.match(/conversationId.*==.*([a-zA-Z0-9-_]+)/);
      const conversationId = conversationIdMatch?.[1];
      if (conversationId) {
        return `/api/realtime/messages/${conversationId}`;
      }
    }
    
    return null;
  }, [target]);

  const endpointUrl = endpoint();

  // Use server-side realtime if we have an endpoint, otherwise disable
  const { 
    data: serverData, 
    loading: serverLoading, 
    error: serverError 
  } = useServerRealtime<T>({
    endpoint: endpointUrl || '',
    enabled: enabled && !!endpointUrl,
    onData: (serverData) => {
      setData(serverData);
      onDataRef.current?.(serverData);
    },
    onError: (serverError) => {
      setError(serverError);
      onErrorRef.current?.(serverError);
    }
  });

  // Update local state based on server realtime
  useEffect(() => {
    setData(serverData);
    setLoading(serverLoading);
    setError(serverError);
  }, [serverData, serverLoading, serverError]);

  // If no endpoint is available, fall back to disabled state
  useEffect(() => {
    if (!endpointUrl && enabled) {
      console.warn('No server-side realtime endpoint available for this query, real-time updates disabled');
      setLoading(false);
      setData(null);
      setError(null);
    }
  }, [endpointUrl, enabled]);

  const refresh = useCallback(() => {
    // For server-side realtime, refresh is handled by reconnection
    console.log('Refresh requested for server-side realtime connection');
  }, []);

  return {
    data,
    loading,
    error,
    refresh,
  };
} 