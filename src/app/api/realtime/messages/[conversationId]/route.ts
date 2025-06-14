import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { adminDb } from '@/lib/firebase-admin';

// Helper function to get user data from Firebase
async function getUserData(userEmail: string) {
  try {
    // Get survey data first (priority for firstName)
    const surveyDoc = await adminDb.collection('surveys').doc(userEmail).get();
    let firstName = '';
    
    if (surveyDoc.exists) {
      const surveyData = surveyDoc.data();
      if (surveyData?.firstName && 
          typeof surveyData.firstName === 'string' && 
          surveyData.firstName.trim() !== '') {
        firstName = surveyData.firstName.trim();
      }
    }
    
    // Get user profile data for image
    const userDoc = await adminDb.collection('users').doc(userEmail).get();
    let userImage = '';
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      userImage = userData?.image || userData?.userProfile?.image || '';
    }
    
    return {
      _id: userEmail,
      name: firstName || 'User',  // Only survey firstName or 'User'
      image: userImage,
      email: userEmail
    };
  } catch (error) {
    console.error('Error fetching user data:', error);
    return {
      _id: userEmail,
      name: 'User', 
      image: '',
      email: userEmail
    };
  }
}

// Helper function to populate sender data in messages
async function populateMessageSenders(messages: any[]) {
  const userCache = new Map();
  
  // First, collect all unique sender IDs
  const senderIds = Array.from(new Set(messages.map(msg => {
    if (typeof msg.senderId === 'string') {
      return msg.senderId;
    } else if (msg.senderId?._id) {
      return msg.senderId._id;
    }
    return null;
  }).filter(Boolean)));
  
  // Fetch user data for all senders
  for (const senderId of senderIds) {
    if (!userCache.has(senderId)) {
      const userData = await getUserData(senderId);
      userCache.set(senderId, userData);
    }
  }
  
  // Populate messages with user data
  return messages.map(msg => {
    let senderId;
    if (typeof msg.senderId === 'string') {
      senderId = msg.senderId;
    } else if (msg.senderId?._id) {
      senderId = msg.senderId._id;
    }
    
    const senderData = userCache.get(senderId) || {
      _id: senderId,
      name: 'User',
      image: '',
      email: senderId
    };
    
    // Also populate readBy array
    const populatedReadBy = (msg.readBy || []).map((reader: any) => {
      if (typeof reader === 'string') {
        return userCache.get(reader) || {
          _id: reader,
          name: 'User',
          image: '',
          email: reader
        };
      } else if (reader?._id) {
        return userCache.get(reader._id) || reader;
      }
      return reader;
    });
    
    return {
      ...msg,
      senderId: senderData,
      readBy: populatedReadBy
    };
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { conversationId } = await params;
    
    // Verify user has access to this conversation
    const conversationDoc = await adminDb.collection('conversations').doc(conversationId).get();
    
    if (!conversationDoc.exists) {
      return new Response('Conversation not found', { status: 404 });
    }

    const conversationData = conversationDoc.data();
    const participants = conversationData?.participants || [];
    
    if (!participants.includes(session.user.email)) {
      return new Response('Access denied', { status: 403 });
    }

    // Set up Server-Sent Events
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      start(controller) {
        // Set up Firebase Admin listener
        const unsubscribe = adminDb
          .collection('messages')
          .where('conversationId', '==', conversationId)
          .orderBy('createdAt', 'asc')
          .onSnapshot(
            async (snapshot) => {
              const messages = snapshot.docs.map(doc => ({
                _id: doc.id,
                ...doc.data()
              }));

              // Populate sender data for all messages
              const populatedMessages = await populateMessageSenders(messages);

              const data = `data: ${JSON.stringify({ 
                type: 'messages', 
                data: populatedMessages 
              })}\n\n`;
              
              controller.enqueue(encoder.encode(data));
            },
            (error) => {
              console.error('Real-time messages error:', error);
              const errorData = `data: ${JSON.stringify({ 
                type: 'error', 
                error: error.message 
              })}\n\n`;
              controller.enqueue(encoder.encode(errorData));
            }
          );

        // Clean up when client disconnects
        req.signal.addEventListener('abort', () => {
          unsubscribe();
          controller.close();
        });

        // Send initial heartbeat
        const heartbeat = `data: ${JSON.stringify({ 
          type: 'connected', 
          conversationId 
        })}\n\n`;
        controller.enqueue(encoder.encode(heartbeat));
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });
  } catch (error) {
    console.error('Error setting up real-time messages:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 