"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter, useParams } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import AddParticipantModal from "./AddParticipantModal";
import { initializeSocket, disconnectSocket } from "@/lib/socket";

interface Conversation {
  _id: string;
  name: string;
  participants: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  _id: string;
  conversationId: string;
  sender: string;
  content: string;
  createdAt: string;
}

interface TypingUser {
  user: string;
  timestamp: number;
}

export default function ConversationPage() {
  // Use useParams hook instead of directly accessing params
  const params = useParams();
  const id = params.id as string;
  
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/signin");
    },
  });

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket connection
  useEffect(() => {
    if (!session || !id) return;
    
    // Set up WebSocket connection
    const socket = initializeSocket();
    
    // Join the conversation room
    socket.emit('join-conversation', id);
    
    // Listen for new messages
    socket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
    });
    
    // Listen for typing indicators
    socket.on('user-typing', (data) => {
      if (data.isTyping) {
        setTypingUsers(prev => {
          // Add user to typing list if not already present
          if (!prev.some(u => u.user === data.user)) {
            return [...prev, { user: data.user, timestamp: Date.now() }];
          }
          return prev;
        });
      } else {
        // Remove user from typing list
        setTypingUsers(prev => prev.filter(u => u.user !== data.user));
      }
    });
    
    // Clean up on unmount
    return () => {
      socket.emit('leave-conversation', id);
      socket.off('new-message');
      socket.off('user-typing');
      disconnectSocket();
    };
  }, [id, session]);

  // Clean up typing users that haven't typed in a while
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => 
        prev.filter(user => now - user.timestamp < 5000)
      );
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Fetch conversation details
  useEffect(() => {
    const fetchConversation = async () => {
      if (!session || !id) return;
      
      try {
        const response = await fetch(`/api/conversations/${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            // Conversation not found or user not a participant
            router.push("/messaging");
            return;
          }
          throw new Error("Failed to fetch conversation");
        }
        
        const result = await response.json();
        setConversation(result.data);
      } catch (error) {
        console.error("Error fetching conversation:", error);
        setError("Failed to fetch conversation details");
      }
    };

    if (session) {
      fetchConversation();
    }
  }, [id, session, router]);

  // Fetch initial messages
  useEffect(() => {
    const fetchInitialMessages = async () => {
      if (!session || !id) return;
      
      try {
        const response = await fetch(`/api/conversations/${id}/messages`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch messages");
        }
        
        const result = await response.json();
        setMessages(result.data || []);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching messages:", error);
        setError("Failed to fetch messages");
        setLoading(false);
      }
    };

    if (session) {
      fetchInitialMessages();
    }
  }, [id, session]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle typing indicator
  const handleTyping = () => {
    if (!session?.user?.email || !id) return;
    
    if (!isTyping) {
      setIsTyping(true);
      // Emit typing event
      const socket = initializeSocket();
      socket.emit('typing', {
        user: session.user.email,
        conversationId: id,
        isTyping: true
      });
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing indicator after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      const socket = initializeSocket();
      socket.emit('typing', {
        user: session.user.email,
        conversationId: id,
        isTyping: false
      });
    }, 2000);
  };

  // Function to send a new message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !session?.user?.email || !id) return;
    
    setSending(true);
    
    try {
      const response = await fetch(`/api/conversations/${id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: newMessage.trim(),
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to send message");
      }
      
      const result = await response.json();
      
      // Add the new message to the local state
      setMessages(prev => [...prev, result.data]);
      setNewMessage("");
      
      // Emit the message via WebSocket to other participants
      const socket = initializeSocket();
      socket.emit('send-message', result.data);
      
      // Clear typing indicator
      setIsTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      socket.emit('typing', {
        user: session.user.email,
        conversationId: id,
        isTyping: false
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  // Handle adding new participants
  const handleAddParticipants = async (participants: string[]) => {
    if (!id) return;
    
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participants,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to add participants");
      }
      
      const result = await response.json();
      setConversation(result.data);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error adding participants:", error);
      setError("Failed to add participants");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-800 dark:text-gray-200">Loading...</p>
      </div>
    );
  }

  // Generate display names for typing indicator
  const typingDisplay = typingUsers
    .filter(user => user.user !== session?.user?.email)
    .map(user => user.user.split('@')[0])
    .join(', ');

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 dark:bg-gray-900">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-center">
        <div>
          <button
            onClick={() => router.push("/messaging")}
            className="text-blue-500 hover:text-blue-700 mr-4"
          >
            ← Back
          </button>
          <span className="text-xl font-semibold text-gray-900 dark:text-white">
            {conversation?.name || "Loading..."}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <button
            className="text-blue-500 hover:text-blue-700 text-sm"
            onClick={() => setIsModalOpen(true)}
          >
            Add People
          </button>
          <ThemeToggle />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-center">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-850">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message, index) => {
            const isCurrentUser = message.sender === session?.user?.email;
            const prevSender = index > 0 ? messages[index - 1].sender : null;
            const showSender = prevSender !== message.sender;
            
            return (
              <div
                key={message._id}
                className={`flex ${isCurrentUser ? "justify-end" : "justify-start"} mb-1`}
              >
                <div
                  className={`max-w-[70%] px-4 py-3 ${
                    isCurrentUser 
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-2xl rounded-bl-2xl" 
                      : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-t-2xl rounded-br-2xl shadow-sm"
                  }`}
                >
                  {!isCurrentUser && showSender && (
                    <div className="text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
                      {message.sender.split("@")[0]}
                    </div>
                  )}
                  <div className="text-sm">{message.content}</div>
                  <div className={`text-xs mt-1 opacity-70 text-right ${isCurrentUser ? "text-blue-100" : "text-gray-400 dark:text-gray-400"}`}>
                    {new Date(message.createdAt).toLocaleTimeString([], { 
                      hour: "2-digit", 
                      minute: "2-digit" 
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {typingDisplay && (
        <div className="px-4 py-1 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          {typingDisplay} {typingUsers.filter(u => u.user !== session?.user?.email).length > 1 ? 'are' : 'is'} typing...
        </div>
      )}

      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSendMessage} className="flex">
          <input
            type="text"
            className="flex-1 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            disabled={sending}
          />
          <button
            type="submit"
            className="rounded-r-md bg-accent hover:bg-accent-hover px-4 py-2 text-white disabled:opacity-50"
            disabled={sending || !newMessage.trim()}
          >
            Send
          </button>
        </form>
      </div>

      {isModalOpen && (
        <AddParticipantModal
          onClose={() => setIsModalOpen(false)}
          onAddParticipants={handleAddParticipants}
          existingParticipants={conversation?.participants || []}
        />
      )}
    </div>
  );
} 