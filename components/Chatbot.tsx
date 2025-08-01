// components/Chatbot.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  timestamp?: Date;
}

interface Product {
  _id: string;
  name: string;
  image: string;
  price: number;
  sizes: number[];
  category: string;
  description: string;
}

interface CartItem {
  _id: string;
  productId: {
    _id: string;
    name: string;
    image: string;
    price: number;
  };
  name: string;
  image: string;
  price: number;
  size: number;
  quantity: number;
}

interface ChatResponse {
  success: boolean;
  response: string;
  products?: Product[];
  cart?: {
    userId: string;
    items: CartItem[];
  };
  orderId?: string;
}

export default function Chatbot() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to scroll to the bottom of the chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch chat history on component mount and when session changes
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (status === 'authenticated' && session?.user?.id) {
        try {
          const res = await fetch('/api/chat-history');
          const data = await res.json();
          if (data.success && data.data?.messages) {
            setMessages(data.data.messages);
          }
        } catch (error) {
          console.error('Failed to fetch chat history:', error);
        }
      } else if (status === 'unauthenticated') {
        setMessages([]); // Clear messages if unauthenticated
      }
    };
    fetchChatHistory();
  }, [session, status]);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading || status !== 'authenticated') {
      return;
    }

    const userMessage: ChatMessage = { role: 'user', text: input, timestamp: new Date() };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input }),
      });

      if (res.status === 401) {
        setMessages((prevMessages) => [
          ...prevMessages,
          { role: 'bot', text: 'Authentication required. Please sign in to use the chatbot.', timestamp: new Date() },
        ]);
        setLoading(false);
        return;
      }

      const data: ChatResponse = await res.json();

      if (data.success) {
        const botMessage: ChatMessage = { role: 'bot', text: data.response, timestamp: new Date() };
        setMessages((prevMessages) => [...prevMessages, botMessage]);
      } else {
        setMessages((prevMessages) => [
          ...prevMessages,
          { role: 'bot', text: data.response || 'Error processing your request.', timestamp: new Date() },
        ]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: 'bot', text: 'Failed to connect to the chatbot service.', timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex flex-col h-full bg-white rounded-2xl shadow-xl p-6 items-center justify-center">
        <p className="text-gray-600 animate-pulse">Loading user session...</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex flex-col h-full bg-white rounded-2xl shadow-xl p-6 items-center justify-center text-center">
        <p className="text-gray-700 mb-4 text-lg font-medium">Please sign in to chat with our AI.</p>
        <Link href="/auth/signin" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#ece5dd] rounded-2xl shadow-xl overflow-hidden font-sans"> {/* WhatsApp bg */}
      {/* Header */}
      <div className="bg-[#075e54] text-white py-3 px-4 flex items-center shadow-md">
        <div className="bg-white rounded-full p-2 mr-3 shadow-sm">
          {/* WhatsApp chat icon */}
          <svg className="w-6 h-6 text-[#075e54]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.555 4.106 1.523 5.824L0 24l6.373-1.67A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" fill="#25d366"/>
            <path d="M19.05 17.34c-.29-.145-1.71-.844-1.974-.94-.264-.097-.456-.145-.648.145-.193.29-.744.94-.912 1.134-.168.193-.336.218-.626.073-.29-.145-1.225-.452-2.334-1.44-.863-.77-1.445-1.72-1.615-2.01-.168-.29-.018-.447.127-.592.13-.13.29-.336.435-.504.145-.168.193-.29.29-.484.097-.193.048-.363-.024-.508-.073-.145-.648-1.566-.888-2.146-.234-.563-.472-.487-.648-.496l-.553-.01c-.193 0-.508.073-.773.363-.264.29-1.01.99-1.01 2.418 0 1.428 1.034 2.808 1.178 3.003.145.193 2.04 3.12 4.95 4.25.693.238 1.233.38 1.655.486.695.177 1.33.152 1.83.092.558-.066 1.71-.698 1.953-1.372.242-.674.242-1.252.17-1.372-.073-.12-.264-.193-.553-.338z" fill="#fff"/>
          </svg>
        </div>
        <h2 className="text-lg font-semibold tracking-wide text-white">Product AI</h2>
      </div>

      {/* Chat Box */}
      <div className="flex-grow overflow-y-auto p-4 bg-[#ece5dd] custom-scrollbar">
        {messages.length === 0 && (
          <div className="text-center text-gray-600 py-4 text-sm italic">
            Welcome! Type a message to start chatting.
          </div>
        )}
        <div className="flex flex-col space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`relative max-w-[75%] px-4 py-2 rounded-2xl text-[15px] shadow bg-[#dcf8c6] text-gray-900 border border-black mb-4
                  ${msg.role === 'user' ? 'rounded-br-none ml-auto' : 'rounded-bl-none mr-auto'}`}
                style={{ wordBreak: 'break-word' }}
              >
                {msg.text}
                <span className="block text-right text-xs text-gray-500 mt-1">
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
                {/* Message tail */}
                {msg.role === 'user' ? (
                  <span className="absolute bottom-0 right-[-8px] w-0 h-0 border-solid border-t-8 border-t-transparent border-l-8 border-l-[#dcf8c6]"></span>
                ) : (
                  <span className="absolute bottom-0 left-[-8px] w-0 h-0 border-solid border-t-8 border-t-transparent border-r-8 border-r-[#dcf8c6]"></span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={e => { e.preventDefault(); handleSendMessage(); }} className="p-3 bg-[#f0f0f0] flex items-center gap-2 shadow-inner">
        <input
          type="text"
          id="userInput"
          className="flex-grow border-none rounded-full py-2.5 px-4 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#25d366] bg-white"
          placeholder={loading ? 'Thinking...' : 'Type a message...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          autoComplete="off"
          required
          disabled={loading}
        />
        <button
          type="submit"
          className="bg-[#25d366] hover:bg-[#128c7e] text-white p-3 rounded-full shadow-md transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          disabled={loading}
          aria-label="Send"
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            // Paper plane icon
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          )}
        </button>
      </form>
      {/* Custom scrollbar style */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #ece5dd;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #bdbdbd;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a0aec0;
        }
      `}</style>
    </div>
  );
}
