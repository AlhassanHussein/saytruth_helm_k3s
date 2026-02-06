import { useState, useEffect } from 'react';
import { linksAPI } from '../services/api';
import { translations } from '../i18n/translations';
import './LinkPages.css';

const parseApiDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const hasTimezone = /[zZ]|[+-]\d\d:?\d\d$/.test(value);
    return new Date(hasTimezone ? value : `${value}Z`);
  }
  return new Date(value);
};

const formatTimeRemaining = (expiresAt, t) => {
  const now = new Date();
  const expires = parseApiDate(expiresAt);
  if (!expires || Number.isNaN(expires.getTime())) return null;
  const diff = expires - now;

  if (diff <= 0) return null;

  const dayMs = 1000 * 60 * 60 * 24;
  const hourMs = 1000 * 60 * 60;
  const minuteMs = 1000 * 60;
  const days = Math.floor(diff / dayMs);
  if (days > 0) {
    const hours = Math.floor((diff % dayMs) / hourMs);
    return `${days} ${t.days}`;
  }
  const hours = Math.ceil(diff / hourMs);
  if (hours >= 1) return `${hours} ${t.hours}`;
  const minutes = Math.ceil(diff / minuteMs);
  if (minutes >= 1) return `${minutes} ${t.minutes}`;
  const seconds = Math.max(1, Math.ceil(diff / 1000));
  return `${seconds} ${t.seconds}`;
};

const formatMessageTime = (createdAt, t) => {
  const now = new Date();
  const created = parseApiDate(createdAt);
  if (!created || Number.isNaN(created.getTime())) return t.just_now;
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return t.just_now;
  if (diffMins < 60) return `${diffMins} ${t.minutes} ${t.ago}`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} ${t.hours} ${t.ago}`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ${t.days} ${t.ago}`;
};

const MessageList = ({ messages, onMakePublic, onDelete, language, t }) => {
  const isRTL = language === 'AR';

  return (
    <div className="link-messages-container">
      {messages.length === 0 ? (
        <div className="link-messages-empty">{t.noMessages}</div>
      ) : (
        <div className="link-messages-list">
          {messages.map((msg) => (
            <div key={msg.id} className={`link-message-card ${msg.status}`}>
              <div className="link-message-content">{msg.content}</div>
              <div className="link-message-meta">
                <span className="link-message-time">
                  {formatMessageTime(msg.created_at, t)}
                </span>
              </div>
              <div className={`link-message-actions ${isRTL ? 'rtl' : ''}`}>
               
                <button
                  onClick={() => onDelete(msg.id)}
                  className="link-message-btn delete"
                  title={t.delete}
                >
                 Delete 🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PrivateLinkPage = ({ privateId, language = 'EN' }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [activeTab, setActiveTab] = useState('inbox');

  const t = translations[language]?.privateLinkPage || translations.EN.privateLinkPage;
  const isRTL = language === 'AR';

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true);
        const data = await linksAPI.getLinkMessages(privateId);
        console.log('Private link data received:', data);
        // New backend structure: { messages, display_name, expires_at, status }
        const messagesList = data?.messages || [];
        console.log('Messages array:', messagesList, 'Length:', messagesList.length);
        setMessages(messagesList);
        setExpiresAt(data?.expires_at || null);
      } catch (err) {
        setError(t.error || 'Failed to load messages');
        console.error('Failed to load messages:', err);
        console.error('Error details:', err.message, err.response);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [privateId, t]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const updateCountdown = () => {
      const remaining = formatTimeRemaining(expiresAt, t);
      setCountdown(remaining);
      if (!remaining) {
        setError(t.expired);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, t]);

  const handleMakePublic = async (messageId) => {
    try {
      await linksAPI.makeLinkMessagePublic(privateId, messageId);
      // Optimistic update
      setMessages((msgs) =>
        msgs.map((msg) =>
          msg.id === messageId ? { ...msg, status: 'public' } : msg
        )
      );
    } catch (err) {
      setError('Failed to update message');
    }
  };

  const handleDelete = async (messageId) => {
    try {
      await linksAPI.deleteLinkMessage(privateId, messageId);
      // Optimistic update: drop the message from view
      setMessages((msgs) => msgs.filter((msg) => msg.id !== messageId));
    } catch (err) {
      setError('Failed to delete message');
    }
  };

  // Show only inbox messages; public/deleted tabs removed for simplicity
  const inboxMessages = messages.filter((m) => m.status === 'inbox');

  if (loading) {
    return (
      <div className={`link-page private-link-page ${isRTL ? 'rtl' : ''}`}>
        <div className="link-page-shell">
          <div className="link-page-loading">{t.loading}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`link-page private-link-page ${isRTL ? 'rtl' : ''}`}>
      <div className="link-page-shell">
        <section className="card link-hero">
          <div className="link-hero-badge">{t.inbox}</div>
          <div className="link-hero-grid">
            <div>
              <h1 className="link-hero-title">{t.introTitle}</h1>
              <p className="link-hero-subtitle">{t.introSubtitle}</p>
              <p className="link-hero-description">{t.introDescription}</p>
            </div>
            <div className="link-hero-side">
              <div className="link-hero-icon">🔒</div>
              {countdown && (
                <div className="link-hero-countdown">
                  {t.expiresIn}: <strong>{countdown}</strong>
                </div>
              )}
              <span className="link-hero-pill">{t.yourAnonymousMessages}</span>
            </div>
          </div>
        </section>

        {error && <div className="link-alert error">{error}</div>}

        <section className="card link-messages-card">
          <div className="link-messages-header">
            <h2 className="link-messages-title">{t.inbox}</h2>
            <span className="link-messages-count">{inboxMessages.length}</span>
          </div>
          <MessageList
            messages={inboxMessages}
            onMakePublic={handleMakePublic}
            onDelete={handleDelete}
            language={language}
            t={t}
          />
        </section>
      </div>
    </div>
  );
};

export default PrivateLinkPage;
