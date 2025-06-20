import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { 
  getConversationsByUser, 
  createConversation, 
  findExistingConversation,
  createOrFindDirectMessage,
  getUser,
  enrichParticipantsWithUserData 
} from '@/lib/firebaseService';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    const userEmail = session.user.email;
    
    // Check if we should show hidden conversations
    const url = new URL(req.url);
    const showHidden = url.searchParams.get('showHidden') === 'true';
    
    // Get conversations for the current user using Firebase
    const conversations = await getConversationsByUser(userEmail);

    // Transform the conversations to include other participants' info with enriched data
    const transformedConversations = await Promise.all(conversations.map(async (conv) => {
      // Enrich participants with full user data including images
      const enrichedParticipants = await enrichParticipantsWithUserData(
        Array.isArray(conv.participants) ? conv.participants : []
      );
      
      // Filter to get other participants with complete data
      const otherParticipants = enrichedParticipants
        .filter((p: any) => p._id !== userEmail && p.email !== userEmail)
        .map((p: any) => ({
          _id: p._id || p.email,
          name: p.name || 'User',
          image: p.image || ''
        }));
      
      // The lastMessage content is already decrypted by getConversationsByUser
      return {
        _id: conv._id,
        participants: enrichedParticipants,
        otherParticipants,
        lastMessage: conv.lastMessage,
        isGroup: conv.isGroup,
        name: conv.name || (otherParticipants[0]?.name || 'Unknown User'),
        updatedAt: conv.updatedAt,
        hiddenBy: conv.hiddenBy || []
      };
    }));

    // Filter conversations based on whether they're hidden by the current user
    const filteredConversations = transformedConversations.filter(conv => {
      const isHiddenByUser = conv.hiddenBy.includes(userEmail);
      return showHidden ? isHiddenByUser : !isHiddenByUser;
    });

    return NextResponse.json({ success: true, data: filteredConversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    const { participants, isGroup, name } = await req.json();

    if (!participants || !Array.isArray(participants)) {
      return NextResponse.json({ error: 'Participants array is required' }, { status: 400 });
    }

    const userEmail = session.user.email;
    
    // Ensure the current user is included in participants
    let allParticipants = [...participants];
    if (!allParticipants.includes(userEmail)) {
      allParticipants.push(userEmail);
    }
    
    // Deduplicate participants
    allParticipants = Array.from(new Set(allParticipants));
    
    // For direct messages, check if it's just 2 participants and not a group
    const isDirectMessage = !isGroup && allParticipants.length === 2;
    
    // Check if a conversation with the same participants already exists
    const existingConversation = await findExistingConversation(allParticipants);
    
    if (existingConversation) {
      // Return the existing conversation instead of creating a new one
      return NextResponse.json({ 
        success: true, 
        data: existingConversation,
        message: 'Conversation already exists'
      });
    }
    
    // Create new conversation with validated participants
    const conversation = await createConversation({
      participants: allParticipants,
      isGroup: isGroup || false,
      name: name || null
    });

    return NextResponse.json({ success: true, data: conversation });
  } catch (error: unknown) {
    console.error('Error creating conversation:', error);
    
    // Provide more detailed error information
    if (error && typeof error === 'object' && 'name' in error) {
      return NextResponse.json({ 
        error: 'Validation Error', 
        details: error 
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
} 