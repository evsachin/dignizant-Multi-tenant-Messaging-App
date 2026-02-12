import React, { useState, useEffect, useRef, useCallback } from 'react';
import { messagesAPI } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { format, isToday, isYesterday } from 'date-fns';
import './ChatWindow.css';

const getInitials = (email) => email?.slice(0, 2).toUpperCase() || '??';

const formatTime = (dateStr) => {
  const d = new Date(dateStr);
  return format(d, 'h:mm a');
};

const formatDateSeparator = (dateStr) => {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
};

const shouldShowDateSeparator = (messages, index) => {
  if (index === messages.length - 1) return true;
  const current = new Date(messages[index].createdAt);
  const next = new Date(messages[index + 1].createdAt);
  return current.toDateString() !== next.toDateString();
};

const shouldGroupMessage = (messages, index) => {
  if (index === 0) return false;
  const prev = messages[index - 1];
  const curr = messages[index];
  if (prev.sender.id !== curr.sender.id) return false;
  const diff = new Date(curr.createdAt) - new Date(prev.createdAt);
  return diff < 5 * 60 * 1000; // 5 minutes
};

export default function ChatWindow({ group, onGroupUpdated }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isAtBottomRef = useRef(true);

  const scrollToBottom = (smooth = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      setMessages([]);
      try {
        const res = await messagesAPI.list(group.id, { limit: 50 });
        const reversed = [...res.data.messages].reverse();
        setMessages(reversed);
        setHasMore(res.data.pagination.hasMore);
        setNextCursor(res.data.pagination.nextCursor);
      } catch (err) {
        setError('Failed to load messages');
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [group.id]);

  // Scroll to bottom after initial load
  useEffect(() => {
    if (!loading) scrollToBottom(false);
  }, [loading]);

  // Socket.IO setup
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('join_group', { groupId: group.id });

    const handleReceive = ({ message }) => {
      setMessages(prev => {
        // Avoid duplicate
        if (prev.find(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      // Only scroll if already at bottom
      if (isAtBottomRef.current) {
        setTimeout(() => scrollToBottom(true), 50);
      }
    };

    const handleTypingStart = ({ email, userId }) => {
      if (userId !== user.id) {
        setTypingUsers(prev => {
          if (prev.find(u => u.userId === userId)) return prev;
          return [...prev, { userId, email }];
        });
      }
    };

    const handleTypingStop = ({ userId }) => {
      setTypingUsers(prev => prev.filter(u => u.userId !== userId));
    };

    const handleOnlineUsers = ({ userIds }) => setOnlineUsers(userIds);
    const handleUserJoined = ({ userId }) => {
      if (!onlineUsers.includes(userId)) setOnlineUsers(prev => [...prev, userId]);
    };
    const handleUserLeft = ({ userId }) => {
      setOnlineUsers(prev => prev.filter(id => id !== userId));
      setTypingUsers(prev => prev.filter(u => u.userId !== userId));
    };

    socket.on('receive_message', handleReceive);
    socket.on('user_typing', handleTypingStart);
    socket.on('user_stopped_typing', handleTypingStop);
    socket.on('online_users', handleOnlineUsers);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);

    return () => {
      socket.emit('leave_group', { groupId: group.id });
      socket.off('receive_message', handleReceive);
      socket.off('user_typing', handleTypingStart);
      socket.off('user_stopped_typing', handleTypingStop);
      socket.off('online_users', handleOnlineUsers);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
    };
  }, [group.id, user.id]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    isAtBottomRef.current = atBottom;
  }, []);

  // Load more messages (pagination)
  const loadMore = async () => {
    if (!hasMore || loadingMore || !nextCursor) return;
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;

    setLoadingMore(true);
    try {
      const res = await messagesAPI.list(group.id, { limit: 50, cursor: nextCursor });
      const older = [...res.data.messages].reverse();
      setMessages(prev => [...older, ...prev]);
      setHasMore(res.data.pagination.hasMore);
      setNextCursor(res.data.pagination.nextCursor);

      // Maintain scroll position
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - prevScrollHeight;
        }
      });
    } catch (err) {
      console.error('Failed to load more:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTyping = () => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('typing_start', { groupId: group.id });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { groupId: group.id });
    }, 2000);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    // Clear typing
    const socket = getSocket();
    if (socket) socket.emit('typing_stop', { groupId: group.id });
    clearTimeout(typingTimeoutRef.current);

    setInput('');
    setSending(true);
    setError('');

    try {
      // Send via socket for real-time
      if (socket?.connected) {
        socket.emit('send_message', { groupId: group.id, content }, (ack) => {
          if (ack?.error) setError(ack.error);
        });
      } else {
        // Fallback to REST
        await messagesAPI.send(group.id, content);
      }
      setTimeout(() => scrollToBottom(true), 50);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send message');
      setInput(content);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const memberCount = group._count?.members || group.members?.length || 0;
  const isMember = group.isMember || group.members?.some(m => m.userId === user.id);

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <span className="chat-hash">#</span>
          <h2 className="chat-title">{group.name}</h2>
          <span className="chat-meta">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            {memberCount} members
          </span>
          {onlineUsers.length > 0 && (
            <span className="chat-meta online">
              <span className="online-dot" style={{ width: 6, height: 6 }} />
              {onlineUsers.length} online
            </span>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div
        className="messages-container"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {/* Load More */}
        {hasMore && (
          <div className="load-more-wrapper">
            <button className="btn btn-ghost btn-sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Load earlier messages'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="messages-loading">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton-message" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="skeleton-avatar" />
                <div className="skeleton-content">
                  <div className="skeleton-name" />
                  <div className="skeleton-text" />
                  {i % 3 === 0 && <div className="skeleton-text short" />}
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="messages-empty">
            <div className="messages-empty-icon">#</div>
            <h3>Welcome to #{group.name}</h3>
            <p>This is the beginning of the channel. Say hello!</p>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((msg, index) => {
              const isOwn = msg.senderId === user.id || msg.sender?.id === user.id;
              const grouped = shouldGroupMessage(messages, index);
              const showDate = shouldShowDateSeparator(messages, index);

              return (
                <React.Fragment key={msg.id}>
                  {showDate && (
                    <div className="date-separator">
                      <span>{formatDateSeparator(messages[index + 1]?.createdAt || msg.createdAt)}</span>
                    </div>
                  )}
                  <div className={`message ${isOwn ? 'own' : ''} ${grouped ? 'grouped' : ''}`}>
                    {!grouped && (
                      <div className="avatar" style={isOwn ? { background: 'var(--accent-dim2)', color: 'var(--accent)' } : {}}>
                        {getInitials(msg.sender?.email)}
                      </div>
                    )}
                    {grouped && <div className="message-spacer" />}
                    <div className="message-body">
                      {!grouped && (
                        <div className="message-header">
                          <span className="message-sender">{msg.sender?.email}</span>
                          {msg.sender?.role === 'ADMIN' && <span className="badge badge-admin">admin</span>}
                          <span className="message-time">{formatTime(msg.createdAt)}</span>
                        </div>
                      )}
                      <div className="message-content">
                        <p>{msg.content}</p>
                        {grouped && <span className="message-time-inline">{formatTime(msg.createdAt)}</span>}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span /><span /><span />
            </div>
            <span className="typing-text">
              {typingUsers.map(u => u.email.split('@')[0]).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        {error && (
          <div className="chat-error">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}
        {!isMember && user.role !== 'ADMIN' ? (
          <div className="chat-not-member">You are not a member of this channel</div>
        ) : (
          <form className="chat-form" onSubmit={handleSend}>
            <input
              ref={inputRef}
              className="chat-input"
              placeholder={`Message #${group.name}`}
              value={input}
              onChange={e => { setInput(e.target.value); handleTyping(); }}
              onKeyDown={handleKeyDown}
              disabled={sending}
              autoFocus
            />
            <button
              type="submit"
              className={`send-btn ${input.trim() ? 'active' : ''}`}
              disabled={!input.trim() || sending}
              title="Send message"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
