import { useState, useEffect } from 'react';
import { linksAPI } from '../services/api';
import { translations } from '../i18n/translations';
import './LinkPages.css';

const PublicLinkPage = ({ publicId, language = 'EN' }) => {
  const [linkInfo, setLinkInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);

  const t = translations[language]?.publicLinkPage || translations.EN.publicLinkPage;
  const isRTL = language === 'AR';

  // Countdown display for sender
  const parseApiDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const hasTimezone = /[zZ]|[+-]\d\d:?\d\d$/.test(value);
      return new Date(hasTimezone ? value : `${value}Z`);
    }
    return new Date(value);
  };

  const formatTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
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
      return `${days}d ${hours}h`;
    }
    const hours = Math.ceil(diff / hourMs);
    if (hours >= 1) return `${hours}h`;
    const minutes = Math.ceil(diff / minuteMs);
    if (minutes >= 1) return `${minutes}m`;
    const seconds = Math.max(1, Math.ceil(diff / 1000));
    return `${seconds}s`;
  };

  useEffect(() => {
    const fetchLinkInfo = async () => {
      try {
        setLoading(true);
        const info = await linksAPI.getLinkInfo(publicId);
        setLinkInfo(info);
      } catch (err) {
        if (err.message.includes('404')) {
          setError(t.notFound);
        } else if (err.message.includes('expired')) {
          setError(t.expired);
        } else {
          setError(t.error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLinkInfo();
  }, [publicId, t]);

  useEffect(() => {
    if (!linkInfo?.expires_at) return;
    const update = () => setCountdown(formatTimeRemaining(linkInfo.expires_at));
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, [linkInfo]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    setError(null);

    try {
      await linksAPI.sendLinkMessage(publicId, message);
      setSent(true);
      setMessage('');
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      setError(t.errors);
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className={`link-page public-link-page ${isRTL ? 'rtl' : ''}`}>
        <div className="link-page-shell">
          <div className="link-page-loading">{t.loading}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`link-page public-link-page ${isRTL ? 'rtl' : ''}`}>
        <div className="link-page-shell">
          <section className="card link-hero error">
            <div className="link-hero-icon">⏰</div>
            <h2 className="link-hero-title">{error}</h2>
            {error.includes('expired') && (
              <p className="link-hero-subtitle">This link can no longer accept messages.</p>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className={`link-page public-link-page ${isRTL ? 'rtl' : ''}`}>
      <div className="link-page-shell">
        <section className="card link-hero">
          <div className="link-hero-badge">{t.eyebrow}</div>
          <div className="link-hero-grid">
            <div>
              <h1 className="link-hero-title">{t.introTitle}</h1>
              <p className="link-hero-subtitle">{t.introSubtitle}</p>
              <p className="link-hero-description">{t.introDescription}</p>
            </div>
            <div className="link-hero-side">
              <div className="link-hero-icon">💌</div>
              <span className="link-hero-pill">{t.multipleAllowed}</span>
              {countdown && (
                <div className="link-hero-countdown">
                  ⏱ {t.timeLeft}: <strong>{countdown}</strong>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="card link-info-card">
          {linkInfo?.display_name && (
            <h2 className="link-info-title">{linkInfo.display_name}</h2>
          )}
          <p className="link-info-subtitle">{t.multipleAllowed}</p>
        </section>

        <section className="card link-form-card">
          <form onSubmit={handleSendMessage} className="link-form">
            <div className="link-form-group">
              <label className="link-form-label">{t.yourMessage}</label>
              <textarea
                placeholder={t.placeholder}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength="5000"
                rows="8"
                className="link-form-textarea"
                disabled={sending}
              />
              <div className="link-form-count">
                {message.length} / 5000 {t.characterCount}
              </div>
            </div>

            {error && <div className="link-alert error">{error}</div>}
            {sent && <div className="link-alert success">{t.success}</div>}

            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="action primary link-form-submit"
            >
              {sending ? t.sending : t.send}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default PublicLinkPage;
