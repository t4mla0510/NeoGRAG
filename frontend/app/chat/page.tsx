'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { assets } from '../components/assets';
import Link from 'next/link';
import styles from './Chat.module.css';
import StarRating from '../components/StarRating';
import { DefaultChatTransport } from 'ai';
import type { Components } from 'react-markdown';

const markdownComponents: Partial<Components> = {
  a: ({ node, ...props }) => {
    void node;
    return <a {...props} target="_blank" rel="noopener noreferrer" />;
  },
};

const normalizeMarkdownMath = (markdown: string) => {
  let inCodeFence = false;

  return markdown
    .split('\n')
    .map(line => {
      if (/^\s*(```|~~~)/.test(line)) {
        inCodeFence = !inCodeFence;
        return line;
      }

      if (inCodeFence) return line;

      const displayMath = line.match(/^(\s*)\$\$(.+?)\$\$\s*$/);
      if (!displayMath) return line;

      const [, indent, expression] = displayMath;
      return `${indent}$$\n${expression.trim()}\n${indent}$$`;
    })
    .join('\n');
};
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

const STORAGE_MESSAGES_KEY = 'rebot_chat_messages';
const STORAGE_RATINGS_KEY = 'rebot_chat_ratings';

const Chat = () => {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_RATINGS_KEY);
        return saved ? JSON.parse(saved) : {};
      } catch { return {}; }
    }
    return {};
  });
  const [hoverRatings, setHoverRatings] = useState<Record<string, number>>({});
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const { messages, sendMessage, setMessages, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_MESSAGES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          setHasInitialized(true);
          return;
        }
      }
      // No saved messages - send initial greeting from REBot
      const welcomeMessage = {
        id: `welcome-${Date.now()}`,
        role: 'assistant' as const,
        parts: [{ type: 'text' as const, text: 'Chào bạn! Tôi là **REBot — Trợ lý AI Tư vấn Học vụ** của Trường Đại học Cần Thơ. Tôi có thể giúp bạn tra cứu thông tin về quy chế đào tạo, đăng ký học phần, điểm số, GPA, CPA, điều kiện tốt nghiệp, cảnh báo học vụ, lịch học, học bổng, khóa luận, và chuẩn đầu ra. Bạn muốn hỏi điều gì về quy chế học vụ hôm nay?' }],
        createdAt: new Date(),
      };
      setMessages([welcomeMessage]);
      setHasInitialized(true);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (hasInitialized && typeof window !== 'undefined') {
      const serializable = messages.map(m => ({
        id: m.id,
        role: m.role,
        parts: m.parts.filter(p => p.type === 'text').map(p => ({ type: p.type, text: (p as { text: string }).text })),
      }));
      localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(serializable));
    }
  }, [messages, hasInitialized]);

  const isLoading = status === 'submitted' || status === 'streaming';
  const lastMessage = messages[messages.length - 1];
  const showBotLoading = isLoading && lastMessage?.role !== 'assistant';

  const openDeleteModal = () => {
    if (isLoading || messages.length === 0) return;
    setShowDeleteModal(true);
  };

  const confirmClearChat = () => {
    setShowDeleteModal(false);
    setMessages([]);
    setRatings({});
    setHoverRatings({});
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_MESSAGES_KEY);
      localStorage.removeItem(STORAGE_RATINGS_KEY);
    }
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_RATINGS_KEY, JSON.stringify(ratings));
  }, [ratings]);

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

  const handleRate = async (messageId: string, star: number) => {
    setRatings(prev => ({ ...prev, [messageId]: star }));

    const msgIndex = messages.findIndex(m => m.id === messageId);
    const botMessage = messages[msgIndex];
    const userMessage = msgIndex > 0 ? messages[msgIndex - 1] : undefined;

    const botResponseText =
      botMessage?.parts
        ?.filter(p => p.type === 'text')
        .map(p => (p as { text: string }).text)
        .join('') || '';

    const userQueryText =
      userMessage?.parts
        ?.filter(p => p.type === 'text')
        .map(p => (p as { text: string }).text)
        .join('') || '';

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          rating: star,
          user_query: userQueryText,
          bot_response: botResponseText,
          session_id: '',
        }),
      });
    } catch {
      // silently fail; rating already saved locally
    }
  };

  const handleHover = (messageId: string, star: number) => {
    setHoverRatings(prev => ({ ...prev, [messageId]: star }));
  };

  const handleLeave = (messageId: string) => {
    setHoverRatings(prev => {
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
  };

  const handleCopy = async (messageId: string) => {
    const msgIndex = messages.findIndex(m => m.id === messageId);
    const botMessage = messages[msgIndex];
    const text =
      botMessage?.parts
        ?.filter(p => p.type === 'text')
        .map(p => (p as { text: string }).text)
        .join('\n') || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMap(prev => ({ ...prev, [messageId]: true }));
      setTimeout(() => {
        setCopiedMap(prev => {
          const next = { ...prev };
          delete next[messageId];
          return next;
        });
      }, 2000);
    } catch {
      // ignore
    }
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
                    <div className={styles['bot-message-content']}>
                      <div className={`${styles['message-text']} prose prose-sm max-w-none`}>
                        {message.parts.map((part, i) => {
                          if (part.type !== 'text') return null;
                          if (!part.text.trim()) return null;
                          return (
                            <ReactMarkdown
                              key={`${message.id}-${i}`}
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeRaw, rehypeKatex]}
                              components={markdownComponents}
                            >
                              {normalizeMarkdownMath(part.text)}
                            </ReactMarkdown>
                          );
                        })}
                        {message.parts.every(
                          part => part.type !== 'text' || !part.text.trim()
                        ) ? (
                          status !== 'ready' ? (
                            <div className={styles['typing-indicator']} aria-label="REBot đang trả lời">
                              <span />
                              <span />
                              <span />
                            </div>
                          ) : (
                            <p>REBot không thể tạo phản hồi. Vui lòng thử lại.</p>
                          )
                        ) : null}
                      </div>
                      {status !== 'streaming' && !isLoading && (
                        <div className={styles['message-actions']}>
                          <button
                            type="button"
                            className={`material-symbols-outlined ${styles['copy-btn']}`}
                            onClick={() => handleCopy(message.id)}
                            title="Sao chép nội dung"
                            aria-label="Sao chép nội dung"
                          >
                            {copiedMap[message.id] ? 'check' : 'content_copy'}
                          </button>
                          <StarRating
                            messageId={message.id}
                            rating={ratings[message.id] || 0}
                            hoverRating={hoverRatings[message.id] || 0}
                            onRate={handleRate}
                            onHover={handleHover}
                            onLeave={handleLeave}
                          />
                        </div>
                      )}
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
              onClick={openDeleteModal}
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

        {showDeleteModal && (
          <div className={styles['modal-overlay']} role="dialog" aria-modal="true">
            <div className={styles['modal-box']}>
              <h3 className={styles['modal-title']}>Xác nhận xóa</h3>
              <p className={styles['modal-body']}>
                Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện không?
              </p>
              <div className={styles['modal-actions']}>
                <button
                  type="button"
                  className={styles['modal-btn-secondary']}
                  onClick={closeDeleteModal}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className={styles['modal-btn-danger']}
                  onClick={confirmClearChat}
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
