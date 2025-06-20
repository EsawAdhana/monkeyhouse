import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { adminDb } from '@/lib/firebase-admin';
import { safeDecryptMessage } from '@/lib/encryption';

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

// Helper function to populate participant data in conversations
async function populateConversationParticipants(conversations: any[], currentUserEmail: string) {
  const userCache = new Map();
  
  // First, collect all unique participant IDs
  const participantIds = Array.from(new Set(
    conversations.flatMap(conv => 
      (conv.participants || []).map((p: any) => typeof p === 'string' ? p : p._id || p.email)
    ).filter(Boolean)
  ));
  
  // Fetch user data for all participants
  for (const participantId of participantIds) {
    if (!userCache.has(participantId)) {
      const userData = await getUserData(participantId);
      userCache.set(participantId, userData);
    }
  }
  
  // Populate conversations with user data
  return conversations.map(conv => {
    const participants = (conv.participants || []).map((p: any) => {
      const participantId = typeof p === 'string' ? p : p._id || p.email;
      return userCache.get(participantId) || {
        _id: participantId,
        name: 'User',
        image: '',
        email: participantId
      };
    });
    
    const otherParticipants = participants.filter((p: any) => p._id !== currentUserEmail);
    
    // Decrypt lastMessage content if it exists
    let lastMessage = conv.lastMessage;
    if (lastMessage && typeof lastMessage === 'object' && lastMessage.content) {
      lastMessage = {
        ...lastMessage,
        content: safeDecryptMessage(lastMessage.content)
      };
    }
    
    return {
      ...conv,
      participants,
      otherParticipants,
      lastMessage
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userEmail = session.user.email;
    
    // Set up Server-Sent Events
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      start(controller) {
        // Set up Firebase Admin listener for conversations
        // Sort by updatedAt (most recent first)
        const unsubscribe = adminDb
          .collection('conversations')
          .where('participants', 'array-contains', userEmail)
          .orderBy('updatedAt', 'desc')
          .onSnapshot(
            async (snapshot) => {
              const conversations = snapshot.docs.map(doc => ({
                _id: doc.id,
                ...doc.data()
              }));

              // Filter out conversations that have no messages
              const conversationsWithMessages = [];
              for (const conversation of conversations) {
                try {
                  // Check if this conversation has any messages
                  const messagesSnapshot = await adminDb
                    .collection('messages')
                    .where('conversationId', '==', conversation._id)
                    .limit(1)
                    .get();
                  
                  // Only include conversations that have at least one message
                  if (!messagesSnapshot.empty) {
                    conversationsWithMessages.push(conversation);
                  }
                } catch (error) {
                  console.error(`Error checking messages for conversation ${conversation._id}:`, error);
                  // On error, include the conversation to be safe
                  conversationsWithMessages.push(conversation);
                }
              }

              // Populate participant data with user information
              const populatedConversations = await populateConversationParticipants(conversationsWithMessages, userEmail);

              const data = `data: ${JSON.stringify({ 
                type: 'conversations', 
                data: populatedConversations 
              })}\n\n`;
              
              controller.enqueue(encoder.encode(data));
            },
            (error) => {
              console.error('Real-time conversations error:', error);
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
          userEmail 
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
    console.error('Error setting up real-time conversations:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 