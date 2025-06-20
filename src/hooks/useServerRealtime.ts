'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface UseServerRealtimeOptions<T> {
  endpoint: string;
  enabled?: boolean;
  onData?: (data: T) => void;
  onError?: (error: Error) => void;
  onConnected?: () => void;
}

export function useServerRealtime<T>({
  endpoint,
  enabled = true,
  onData,
  onError,
  onConnected
}: UseServerRealtimeOptions<T>) {
  const { data: session } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const maxReconnectAttempts = 5;

  // Store callbacks in refs to avoid dependency issues
  const onDataRef = useRef(onData);
  const onErrorRef = useRef(onError);
  const onConnectedRef = useRef(onConnected);

  // Update refs when callbacks change
  useEffect(() => {
    onDataRef.current = onData;
    onErrorRef.current = onError;
    onConnectedRef.current = onConnected;
  }, [onData, onError, onConnected]);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !session?.user?.email) {
      setLoading(false);
      return;
    }

    cleanup();
    setLoading(true);
    setError(null);

    try {
      const eventSource = new EventSource(endpoint);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        // Connected to endpoint
        setConnected(true);
        setLoading(false);
        reconnectAttempts.current = 0;
        onConnectedRef.current?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          
          switch (parsed.type) {
            case 'connected':
              // Initial connection confirmation
              break;
            case 'conversations':
            case 'messages':
              setData(parsed.data as T);
              onDataRef.current?.(parsed.data as T);
              break;
            case 'error':
              const error = new Error(parsed.error || 'Unknown server error');
              setError(error);
              onErrorRef.current?.(error);
              break;
            default:
              console.warn('Unknown message type:', parsed.type);
          }
        } catch (parseError) {
          console.error('Error parsing SSE message:', parseError);
          const error = new Error('Failed to parse server message');
          setError(error);
          onErrorRef.current?.(error);
        }
      };

      eventSource.onerror = (event) => {
        console.error('EventSource error:', event);
        console.error('EventSource readyState:', eventSource.readyState);
        console.error('EventSource URL:', endpoint);
        setConnected(false);
        setLoading(false);

        const error = new Error(`Connection to real-time server failed: ${endpoint}`);
        setError(error);
        onErrorRef.current?.(error);

        // Don't attempt to reconnect for certain errors (like 404, 403, etc.)
        if (eventSource.readyState === EventSource.CLOSED && 
            reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // 1s, 2s, 4s, 8s, 16s
          // Attempting to reconnect
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          console.error('Max reconnection attempts reached or connection permanently failed');
        }
      };

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Error setting up EventSource:', error);
      setError(error);
      setLoading(false);
      onErrorRef.current?.(error);
    }
  }, [enabled, session?.user?.email, endpoint, cleanup]);

  const disconnect = useCallback(() => {
    cleanup();
    setData(null);
    setLoading(false);
    setError(null);
  }, [cleanup]);

  // Connect when dependencies change
  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    data,
    loading,
    error,
    connected,
    reconnect: connect,
    disconnect
  };
} 