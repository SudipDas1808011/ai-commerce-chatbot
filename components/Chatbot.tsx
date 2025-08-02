'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import styles from '../styles/chatbot.module.css';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  timestamp?: Date;
}

interface ChatHistoryResponse {
  success: boolean;
  data?: { messages?: ChatMessage[] };
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        setMessages([]);
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
    return <div className={styles.messageArea}>Loading session...</div>;
  }

  if (status === 'unauthenticated') {
    return (
      <div className={styles.messageArea}>
        <p className={styles.emptyMessage}>Please sign in to chat with our AI.</p>
        <Link href="/auth/signin" className={styles.sendButton}>
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.iconWrapper}>
          <svg className="w-6 h-6 text-[#075e54]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.555 4.106 1.523 5.824L0 24l6.373-1.67A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" fill="#25d366"/>
            <path d="..." fill="#fff"/>
          </svg>
        </div>
        <h2 className={styles.title}>Product AI</h2>
      </div>

      {/* Messages */}
      <div className={styles.messageArea}>
        {messages.length === 0 ? (
          <div className={styles.emptyMessage}>Welcome! Type a message to start chatting.</div>
        ) : (
          <div className="flex flex-col">
            {messages.map((msg, index) => (
              <div key={index} className={`${styles.messageGroup} ${msg.role === 'user' ? styles.userAlign : styles.botAlign}`}>
                <div className={styles.messageBubble}>
                  {msg.text}
                  <span className={styles.timestamp}>
                    {msg.timestamp && new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className={styles.inputForm}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={loading ? 'Thinking...' : 'Type a message...'}
          disabled={loading}
          className={styles.inputField}
        />
                <button
          type="submit"
          className={styles.sendButton}
          disabled={loading}
          aria-label="Send"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
