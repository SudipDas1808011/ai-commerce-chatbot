// components/Chatbot.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  timestamp?: Date;
}

interface ChatHistoryResponse {
  success: boolean;
  data?: {
    messages?: ChatMessage[];
  };
}

interface ChatResponse {
  success: boolean;
  response: string;
}

export default function Chatbot() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (status === 'authenticated') {
        try {
          const res = await fetch('/api/chat-history');
          const data: ChatHistoryResponse = await res.json();
          if (data.success && data.data?.messages) {
            setMessages(data.data.messages);
          }
        } catch (err) {
          console.error('Error loading history:', err);
        }
      } else if (status === 'unauthenticated') {
        setMessages([]); // Clear if not signed in
      }
    };
    fetchChatHistory();
  }, [status]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading || status !== 'authenticated') return;

    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });
      const data: ChatResponse = await res.json();

      const botMsg: ChatMessage = {
        role: 'bot',
        text: data.response || 'Error processing request.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [...prev, { role: 'bot', text: 'Connection error.', timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  if (status === 'loading') {
    return <div className="flex items-center justify-center h-full">Loading session...</div>;
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center bg-white p-6">
        <p className="mb-4 text-lg font-medium text-gray-700">Please sign in to chat with our AI.</p>
        <Link href="/auth/signin" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#ece5dd] font-sans">
      {/* Header */}
      <div className="bg-[#075e54] text-white py-3 px-4 flex items-center shadow-md">
        <div className="bg-white rounded-full p-2 mr-3 shadow-sm">
          <svg className="w-6 h-6 text-[#075e54]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.555 4.106 1.523 5.824L0 24l6.373-1.67A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" fill="#25d366"/>
            <path d="..." fill="#fff"/>
          </svg>
        </div>
        <h2 className="text-lg font-semibold tracking-wide text-white">Product AI</h2>
      </div>

      {/* Messages */}
      <div className="flex-grow overflow-y-auto p-4 bg-[#ece5dd] custom-scrollbar">
        {messages.length === 0 ? (
          <div className="text-center text-gray-600 py-4 text-sm italic">Welcome! Type a message to start chatting.</div>
        ) : (
          <div className="flex flex-col space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`relative max-w-[75%] px-4 py-2 rounded-2xl text-[15px] shadow bg-[#dcf8c6] text-gray-900 border border-black mb-4 
                  ${msg.role === 'user' ? 'rounded-br-none ml-auto' : 'rounded-bl-none mr-auto'}`}>
                  {msg.text}
                  <span className="block text-right text-xs text-gray-500 mt-1">
                    {msg.timestamp && new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.role === 'user' ? (
                    <span className="absolute bottom-0 right-[-8px] w-0 h-0 border-t-8 border-t-transparent border-l-8 border-l-[#dcf8c6]"></span>
                  ) : (
                    <span className="absolute bottom-0 left-[-8px] w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-[#dcf8c6]"></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={e => { e.preventDefault(); handleSendMessage(); }} className="p-3 bg-[#f0f0f0] flex items-center gap-2 shadow-inner">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={loading ? 'Thinking...' : 'Type a message...'}
          disabled={loading}
          className="flex-grow border-none rounded-full py-2.5 px-4 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#25d366] bg-white"
        />
        <button
          type="submit"
          className="bg-[#25d366] hover:bg-[#128c7e] text-white p-3 rounded-full disabled:opacity-50"
          disabled={loading}
          aria-label="Send"
        >
          ➤
        </button>
      </form>

      {/* Scrollbar styling */}
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
