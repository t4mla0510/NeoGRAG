'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { assets } from '../components/assets';
import Link from 'next/link';
import styles from './Chat.module.css';
import { DefaultChatTransport } from 'ai';

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognitionInstance;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognitionInstance;
    };
  }
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const Chat = () => {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const { messages, sendMessage, setMessages, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';
  const lastMessage = messages[messages.length - 1];
  const showBotLoading = isLoading && lastMessage?.role !== 'assistant';

  const clearChat = () => {
    if (isLoading) return;
    setMessages([]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showBotLoading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [status]);

  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI() as SpeechRecognitionInstance;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'vi-VN';
      recognition.onresult = event => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => {
        setIsRecording(false);
        inputRef.current?.focus();
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const submitMessage = () => {
    if (!input.trim() || isLoading) return;

    sendMessage({ text: input });
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className={styles['window-container']}>
      <div className={styles.main}>
        <nav className={styles.nav}>
          <Link href="/" className={styles['nav-logo']}>
            <img src={assets.logo} alt="REBot Logo" />
            <p>REBot</p>
          </Link>
        </nav>

        <main className={styles['main-container']}>
          <section className={styles['chats-container']}>
            {messages.map(message => (
              <div
                key={message.id}
                className={`${styles.message} ${
                  message.role === 'user'
                    ? styles['user-message']
                    : styles['bot-message']
                }`}
              >
                {message.role === 'user' ? (
                  <p className={styles['message-text']}>
                    {message.parts.map((part, i) =>
                      part.type === 'text' ? (
                        <span key={`${message.id}-${i}`}>{part.text}</span>
                      ) : null
                    )}
                  </p>
                ) : (
                  <>
                    <img
                      src={assets.bot_avatar}
                      alt="bot-icon"
                      className={styles.avatar}
                    />
                    <div className={`${styles['message-text']} prose prose-sm max-w-none`}>
                      {message.parts.some(
                        part => part.type === 'text' && part.text.trim()
                      ) ? (
                        message.parts.map((part, i) =>
                          part.type === 'text' ? (
                            <ReactMarkdown
                              key={`${message.id}-${i}`}
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeRaw]}
                            >
                              {part.text}
                            </ReactMarkdown>
                          ) : null
                        )
                      ) : isLoading ? (
                        <div className={styles['typing-indicator']} aria-label="REBot đang trả lời">
                          <span />
                          <span />
                          <span />
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            ))}
            {showBotLoading ? (
              <div className={`${styles.message} ${styles['bot-message']} ${styles.loading}`}>
                <img
                  src={assets.bot_avatar}
                  alt="bot-icon"
                  className={styles.avatar}
                />
                <div className={styles['message-text']} aria-label="REBot đang trả lời">
                  <div className={styles['typing-indicator']} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </section>
        </main>

        <form
          className={`${styles['prompt-container']} ${styles['at-bottom']}`}
          onSubmit={e => {
            e.preventDefault();
            submitMessage();
          }}
        >
          <div className={styles['prompt-wrapper']}>
            <div className={styles['prompt-search']}>
              <textarea
                ref={inputRef}
                className={styles['prompt-input']}
                value={input}
                onChange={e => setInput(e.currentTarget.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitMessage();
                  }
                }}
                placeholder="Nhắn tin cho REBot..."
                required
                rows={1}
                disabled={isLoading}
              />

              <div className={styles['prompt-actions']}>
                <button
                  id="send-btn"
                  className={`material-symbols-outlined ${styles['side-btn']}`}
                  type="submit"
                  disabled={isLoading || !input.trim()}
                >
                  {isLoading ? 'hourglass_empty' : 'send'}
                </button>
              </div>
            </div>

            <button
              type="button"
              id="mic-btn"
              className={`material-symbols-outlined ${styles['side-btn']}`}
              onClick={toggleMic}
              title="Nhập bằng giọng nói"
              disabled={isLoading}
            >
              {isRecording ? 'stop' : 'mic'}
            </button>

            <button
              type="button"
              id="delete-btn"
              className={`material-symbols-outlined ${styles['side-btn']}`}
              onClick={clearChat}
              title="Xóa cuộc trò chuyện"
              disabled={isLoading}
            >
              delete
            </button>
          </div>

          <p className={styles['bottom-info']}>
            REBot có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.
          </p>
        </form>
      </div>
    </div>
  );
};

export default Chat;
