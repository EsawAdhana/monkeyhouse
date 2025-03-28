import { NextApiRequest } from 'next';
import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { NextApiResponseWithSocket } from '@/types/socket';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export const config = {
  api: {
    bodyParser: false,
  },
};

const SocketHandler = async (req: NextApiRequest, res: NextApiResponseWithSocket) => {
  if (res.socket.server.io) {
    console.log('Socket server already running');
    res.end();
    return;
  }

  // Get user session for authentication
  const session = await getServerSession(req, res, authOptions);
  
  // Create a new Socket.io server
  const io = new SocketIOServer(res.socket.server as any as NetServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Store socket server instance on the server object
  res.socket.server.io = io;

  // Handle socket connections
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Attach user email to socket if authenticated
    if (session?.user?.email) {
      socket.data.user = session.user.email;
      console.log(`Authenticated user: ${session.user.email}`);
    } else {
      console.log('Unauthenticated socket connection');
    }

    // Handle joining a conversation
    socket.on('join-conversation', (conversationId) => {
      console.log(`User joined conversation: ${conversationId}`);
      socket.join(conversationId);
    });

    // Handle leaving a conversation
    socket.on('leave-conversation', (conversationId) => {
      console.log(`User left conversation: ${conversationId}`);
      socket.leave(conversationId);
    });

    // Handle sending a message
    socket.on('send-message', (message) => {
      // Broadcast to all users in the conversation except sender
      socket.to(message.conversationId).emit('new-message', message);
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      socket.to(data.conversationId).emit('user-typing', data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  console.log('Socket server initialized');
  res.end();
};

export default SocketHandler; 