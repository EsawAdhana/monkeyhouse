'use client';

import { io, Socket } from 'socket.io-client';

// Define types for our socket events
export interface ServerToClientEvents {
  'new-message': (message: any) => void;
  'user-typing': (data: { user: string, conversationId: string, isTyping: boolean }) => void;
}

export interface ClientToServerEvents {
  'join-conversation': (conversationId: string) => void;
  'leave-conversation': (conversationId: string) => void;
  'send-message': (message: any) => void;
  'typing': (data: { user: string, conversationId: string, isTyping: boolean }) => void;
}

// Socket.io client singleton
let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export const initializeSocket = (): Socket<ServerToClientEvents, ClientToServerEvents> => {
  if (!socket) {
    // Create socket connection
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || '', {
      path: '/api/socket',
      addTrailingSlash: false,
    });

    // Log connection events
    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
  }
  
  return socket;
};

export const getSocket = (): Socket<ServerToClientEvents, ClientToServerEvents> | null => {
  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}; 