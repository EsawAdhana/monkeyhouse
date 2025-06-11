import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await params;
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    const userEmail = session.user.email;

    // Get all messages in the conversation that the user hasn't read
    const messagesQuery = adminDb
      .collection('messages')
      .where('conversationId', '==', conversationId);

    const messagesSnapshot = await messagesQuery.get();
    
    let updatedCount = 0;
    const batch = adminDb.batch();

    for (const messageDoc of messagesSnapshot.docs) {
      const messageData = messageDoc.data();
      const readBy = Array.isArray(messageData.readBy) ? messageData.readBy : [];
      
      // Check if user is already in readBy array
      const isAlreadyRead = readBy.some((reader: any) => {
        if (typeof reader === 'string') {
          return reader === userEmail;
        }
        return reader._id === userEmail || reader.email === userEmail;
      });

      // If not already read, add user to readBy array
      if (!isAlreadyRead) {
        const updatedReadBy = [...readBy, userEmail];
        batch.update(messageDoc.ref, { readBy: updatedReadBy });
        updatedCount++;
      }
    }

    // Commit all updates
    if (updatedCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ 
      success: true, 
      message: `Marked ${updatedCount} messages as read`,
      updatedCount 
    });

  } catch (error) {
    console.error('Error marking conversation as read:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 