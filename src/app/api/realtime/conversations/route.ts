import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { adminDb } from '@/lib/firebase-admin';

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
        const unsubscribe = adminDb
          .collection('conversations')
          .where('participants', 'array-contains', userEmail)
          .onSnapshot(
            (snapshot) => {
              const conversations = snapshot.docs.map(doc => ({
                _id: doc.id,
                ...doc.data()
              }));

              const data = `data: ${JSON.stringify({ 
                type: 'conversations', 
                data: conversations 
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