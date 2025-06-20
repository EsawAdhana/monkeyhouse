import { adminDb } from './firebase-admin';
import { User } from 'next-auth';
import { getRecommendedMatches } from '@/utils/recommendationEngine';
import { encryptMessage, safeDecryptMessage, EncryptedData } from './encryption';

// Firebase data interfaces
export interface FirebaseUser {
  _id?: string;
  email: string;
  name?: string;
  image?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface FirebaseMessage {
  _id?: string;
  content: string | EncryptedData; // Can be plain text (legacy) or encrypted data
  senderId: string | FirebaseUser | { _id: string; name?: string; image?: string; };
  conversationId: string;
  readBy?: Array<string | FirebaseUser | { _id: string; name?: string; image?: string; }>;
  createdAt?: any;
  updatedAt?: any;
}

export interface FirebaseConversation {
  _id?: string;
  participants: string[] | FirebaseUser[];
  lastMessage?: string | FirebaseMessage;
  name?: string | null;
  isGroup?: boolean;
  hiddenBy?: string[]; // Array of user emails who have hidden this conversation
  createdAt?: any;
  updatedAt?: any;
}

// User Methods
export const createOrUpdateUser = async (user: User | FirebaseUser) => {
  if (!user.email) throw new Error('User email is required');
  
  const userRef = adminDb.collection('users').doc(user.email);
  const userDoc = await userRef.get();
  
  // Check if the user has a survey with firstName
  const surveyRef = adminDb.collection('surveys').doc(user.email);
  const surveyDoc = await surveyRef.get();
  let surveyFirstName = '';
  
  if (surveyDoc.exists) {
    const surveyData = surveyDoc.data();
    if (surveyData?.firstName && typeof surveyData.firstName === 'string') {
      surveyFirstName = surveyData.firstName.trim();
    }
  }
  
  const now = new Date();
  const userData: FirebaseUser = {
    email: user.email,
    name: surveyFirstName || user.name || '',
    image: user.image || '',
    updatedAt: now
  };
  
  if (!userDoc.exists) {
    // Create new user
    userData.createdAt = now;
    await userRef.set(userData);
  } else {
    // Update existing user - but only overwrite name if it's provided and non-empty
    const updateData: Partial<FirebaseUser> = {
      updatedAt: now
    };
    
    if (user.image) updateData.image = user.image;
    
    // Always prioritize firstName from survey over any other name
    if (surveyFirstName) {
      updateData.name = surveyFirstName;
    } else if (user.name && user.name.trim() !== '') {
      // Only update name from user object if no survey firstName exists
      const existingUserData = userDoc.data() as FirebaseUser;
      // Don't overwrite existing name if it might be a firstName from survey
      if (!existingUserData.name || existingUserData.name.trim() === '') {
        updateData.name = user.name;
      }
    }
    
    await userRef.update(updateData);
    
    // Return the updated user data
    const updatedDoc = await userRef.get();
    if (updatedDoc.exists) {
      return {
        _id: user.email,
        ...updatedDoc.data()
      } as FirebaseUser;
    }
  }
  
  return {
    _id: user.email,
    ...userData
  };
};

export const getUser = async (email: string) => {
  const userRef = adminDb.collection('users').doc(email);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    return null;
  }
  
  return {
    _id: userDoc.id,
    ...userDoc.data()
  } as FirebaseUser;
};

// Conversation Methods
export const findExistingConversation = async (participants: string[]): Promise<FirebaseConversation | null> => {
  // Sort participants to ensure consistent comparison
  const sortedParticipants = [...participants].sort();
  
  // Get all conversations that include at least one of the participants
  const querySnapshot = await adminDb.collection('conversations')
    .where('participants', 'array-contains', participants[0])
    .get();
  
  // Check each conversation to see if it has exactly the same participants
  for (const doc of querySnapshot.docs) {
    const conversation = doc.data() as FirebaseConversation;
    
    // Extract participant emails/IDs from the conversation
    const conversationParticipants = conversation.participants.map(p => 
      typeof p === 'string' ? p : p.email || (p as any)._id
    ).filter(Boolean).sort();
    
    // Check if participant arrays are identical
    if (conversationParticipants.length === sortedParticipants.length &&
        conversationParticipants.every((p, index) => p === sortedParticipants[index])) {
      return {
        _id: doc.id,
        ...conversation
      };
    }
  }
  
  return null;
};

export const createOrFindDirectMessage = async (currentUserEmail: string, otherUserEmail: string) => {
  // First, check if a conversation already exists between these two users
  const participants = [currentUserEmail, otherUserEmail].sort();
  const existingConversation = await findExistingConversation(participants);
  
  if (existingConversation) {
    return {
      conversation: existingConversation,
      isExisting: true
    };
  }
  
  // Create new direct message conversation
  const newConversation = await createConversation({
    participants,
    isGroup: false,
    name: null
  });
  
  return {
    conversation: newConversation,
    isExisting: false
  };
};

export const createConversation = async (conversation: Omit<FirebaseConversation, '_id' | 'createdAt' | 'updatedAt'>) => {
  const now = new Date();
  const conversationData = {
    ...conversation,
    createdAt: now,
    updatedAt: now
  };
  
  const docRef = await adminDb.collection('conversations').add(conversationData);
  
  return {
    _id: docRef.id,
    ...conversationData
  };
};

export const getConversation = async (conversationId: string) => {
  const conversationRef = adminDb.collection('conversations').doc(conversationId);
  const conversationDoc = await conversationRef.get();
  
  if (!conversationDoc.exists) {
    return null;
  }
  
  return {
    _id: conversationDoc.id,
    ...conversationDoc.data()
  } as FirebaseConversation;
};

export const getConversationsByUser = async (userEmail: string) => {
  const querySnapshot = await adminDb.collection('conversations')
    .where('participants', 'array-contains', userEmail)
    .orderBy('updatedAt', 'desc')
    .get();
  
  const conversations: FirebaseConversation[] = [];
  
  querySnapshot.forEach((doc) => {
    const conversationData = doc.data() as FirebaseConversation;
    
    // Decrypt lastMessage content if it exists
    if (conversationData.lastMessage && typeof conversationData.lastMessage === 'object') {
      const lastMessage = conversationData.lastMessage as FirebaseMessage;
      if (lastMessage.content) {
        lastMessage.content = safeDecryptMessage(lastMessage.content);
      }
    }
    
    conversations.push({
      _id: doc.id,
      ...conversationData
    });
  });
  
  return conversations;
};

export const updateConversation = async (conversationId: string, data: Partial<FirebaseConversation>) => {
  const conversationRef = adminDb.collection('conversations').doc(conversationId);
  await conversationRef.update({
    ...data,
    updatedAt: new Date()
  });
  
  return {
    _id: conversationId,
    ...data
  };
};

export const deleteConversation = async (conversationId: string) => {
  // Delete all messages in the conversation
  const messagesSnapshot = await adminDb.collection('messages')
    .where('conversationId', '==', conversationId)
    .get();
  
  const batch = adminDb.batch();
  
  messagesSnapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  // Delete the conversation
  const conversationRef = adminDb.collection('conversations').doc(conversationId);
  batch.delete(conversationRef);
  
  await batch.commit();
};

export const hideConversation = async (conversationId: string, userEmail: string) => {
  const conversationRef = adminDb.collection('conversations').doc(conversationId);
  const conversationDoc = await conversationRef.get();
  
  if (!conversationDoc.exists) {
    throw new Error('Conversation not found');
  }
  
  const conversation = conversationDoc.data() as FirebaseConversation;
  const hiddenBy = conversation.hiddenBy || [];
  
  // Add user to hiddenBy array if not already present
  if (!hiddenBy.includes(userEmail)) {
    hiddenBy.push(userEmail);
    await conversationRef.update({
      hiddenBy,
      updatedAt: new Date()
    });
  }
  
  return {
    _id: conversationId,
    ...conversation,
    hiddenBy
  };
};

export const unhideConversation = async (conversationId: string, userEmail: string) => {
  const conversationRef = adminDb.collection('conversations').doc(conversationId);
  const conversationDoc = await conversationRef.get();
  
  if (!conversationDoc.exists) {
    throw new Error('Conversation not found');
  }
  
  const conversation = conversationDoc.data() as FirebaseConversation;
  const hiddenBy = conversation.hiddenBy || [];
  
  // Remove user from hiddenBy array
  const updatedHiddenBy = hiddenBy.filter(email => email !== userEmail);
  await conversationRef.update({
    hiddenBy: updatedHiddenBy,
    updatedAt: new Date()
  });
  
  return {
    _id: conversationId,
    ...conversation,
    hiddenBy: updatedHiddenBy
  };
};

// Message Methods
export const createMessage = async (message: Omit<FirebaseMessage, '_id' | 'createdAt' | 'updatedAt'>) => {
  const now = new Date();
  
  // Encrypt the message content before storing
  const encryptedContent = typeof message.content === 'string' 
    ? encryptMessage(message.content)
    : message.content;
  
  const messageData = {
    ...message,
    content: encryptedContent,
    createdAt: now,
    updatedAt: now
  };
  
  const docRef = await adminDb.collection('messages').add(messageData);
  
  // For the lastMessage in conversation, we'll also store it encrypted for full encryption
  const lastMessageForConversation = {
    _id: docRef.id,
    content: encryptedContent, // Store encrypted content in conversation too
    senderId: message.senderId,
    conversationId: message.conversationId,
    createdAt: now
  };
  
  // Update the conversation's lastMessage and updatedAt
  await updateConversation(message.conversationId, {
    lastMessage: lastMessageForConversation,
    updatedAt: now
  });
  
  return {
    _id: docRef.id,
    ...messageData
  };
};

export const getMessagesByConversation = async (conversationId: string) => {
  const querySnapshot = await adminDb.collection('messages')
    .where('conversationId', '==', conversationId)
    .orderBy('createdAt', 'asc')
    .get();
  
  const messages: FirebaseMessage[] = [];
  
  querySnapshot.forEach((doc) => {
    messages.push({
      _id: doc.id,
      ...doc.data()
    } as FirebaseMessage);
  });
  
  // Enrich messages with user data and decrypt content
  const enrichedMessages = await Promise.all(messages.map(async (message) => {
    let enrichedSenderId = message.senderId;
    
    // If senderId is a string (email), fetch user data
    if (typeof message.senderId === 'string') {
      try {
        const userData = await getUser(message.senderId);
        const surveyData = await getSurveyByUser(message.senderId);
        
        enrichedSenderId = {
          _id: message.senderId,
          name: (surveyData as any)?.firstName || userData?.name || '',
          image: userData?.image || ''
        };
      } catch (error) {
        console.error('Error enriching sender data:', error);
        // Fallback to basic structure
        enrichedSenderId = {
          _id: message.senderId,
          name: '',
          image: ''
        };
      }
    }
    
    // Decrypt message content
    const decryptedContent = safeDecryptMessage(message.content);
    
    return {
      ...message,
      content: decryptedContent,
      senderId: enrichedSenderId
    };
  }));
  
  return enrichedMessages;
};

export const getNewMessagesSince = async (conversationId: string, timestamp: Date) => {
  const querySnapshot = await adminDb.collection('messages')
    .where('conversationId', '==', conversationId)
    .where('createdAt', '>', timestamp)
    .orderBy('createdAt', 'asc')
    .get();
  
  const messages: FirebaseMessage[] = [];
  
  querySnapshot.forEach((doc) => {
    messages.push({
      _id: doc.id,
      ...doc.data()
    } as FirebaseMessage);
  });
  
  return messages;
};



// Survey Methods
export const getSurveyByUser = async (userEmail: string) => {
  const surveyRef = adminDb.collection('surveys').doc(userEmail);
  const surveyDoc = await surveyRef.get();
  
  if (!surveyDoc.exists) {
    return null;
  }
  
  return {
    _id: surveyDoc.id,
    ...surveyDoc.data()
  };
};

export const createOrUpdateSurvey = async (userEmail: string, surveyData: any) => {
  const surveyRef = adminDb.collection('surveys').doc(userEmail);
  const now = new Date();
  
  const dataToSave = {
    ...surveyData,
    userEmail,
    updatedAt: now
  };
  
  const surveyDoc = await surveyRef.get();
  
  if (!surveyDoc.exists) {
    // Create new survey
    dataToSave.createdAt = now;
    await surveyRef.set(dataToSave);
  } else {
    // Update existing survey
    await surveyRef.update(dataToSave);
  }
  
  return {
    _id: userEmail,
    ...dataToSave
  };
};

// Recommendation Methods
export const getRecommendationsByUser = async (userEmail: string, showTestUsers: boolean = false) => {
  try {
    // Get recommendations using the existing utility function
    const matches = await getRecommendedMatches(
      userEmail,
      undefined, // testMinCompatibilityScore
      undefined, // filterEmails
      true, // useEnhancedScoring
      showTestUsers
    );
    
    return {
      matches,
      totalMatches: matches.length
    };
  } catch (error) {
    console.error('Error getting recommendations:', error);
    throw error;
  }
};

// Search Methods
export const searchUsers = async (searchQuery: string, currentUserEmail: string) => {
  try {
    // Search in surveys collection by firstName
    const surveysSnapshot = await adminDb.collection('surveys')
      .where('isSubmitted', '==', true)
      .get();
    
    const users: any[] = [];
    
    surveysSnapshot.forEach((doc) => {
      const surveyData = doc.data();
      const userEmail = surveyData.userEmail || doc.id;
      
      // Skip current user
      if (userEmail === currentUserEmail) return;
      
      // Check if firstName matches search query (case insensitive)
      const firstName = surveyData.firstName || '';
      if (firstName.toLowerCase().includes(searchQuery.toLowerCase())) {
        users.push({
          email: userEmail,
          name: firstName,
          surveyData: surveyData
        });
      }
    });
    
    return users;
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};

// Helper Methods
export const enrichParticipantsWithUserData = async (participants: (string | any)[]) => {
  const enrichedParticipants = [];
  
  for (const participant of participants) {
    if (typeof participant === 'string') {
      // It's just an email, fetch user data
      const userData = await getUser(participant);
      if (userData) {
        enrichedParticipants.push(userData);
      } else {
        // Fallback if user not found
        enrichedParticipants.push({
          _id: participant,
          email: participant,
          name: 'Unknown User'
        });
      }
    } else {
      // It's already an object, use as is
      enrichedParticipants.push(participant);
    }
  }
  
  return enrichedParticipants;
}; 