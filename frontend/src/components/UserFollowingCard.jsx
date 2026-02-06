import { useState, useEffect } from 'react';
import { translations } from '../i18n/translations';
import './UserFollowingCard.css';

const UserFollowingCard = ({ user, onCardClick, language = 'EN' }) => {
    const [lastMessage, setLastMessage] = useState(null);
    const t = translations[language] || translations.EN;

    useEffect(() => {
        if (user.public_messages && user.public_messages.length > 0) {
            setLastMessage(user.public_messages[0]);
        }
    }, [user.public_messages]);

    const truncateText = (text, maxLen = 120) => {
        if (!text) return '';
        if (text.length > maxLen) return text.substring(0, maxLen) + '…';
        return text;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t.time.now;
        if (diffMins < 60) return t.time.minutesAgo(diffMins);
        if (diffHours < 24) return t.time.hoursAgo(diffHours);
        if (diffDays < 7) return t.time.daysAgo(diffDays);
        if (diffDays < 30) return t.time.weeksAgo(Math.floor(diffDays / 7));
        return date.toLocaleDateString();
    };

    const getGradient = (name) => {
        const gradients = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
            'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
            'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
        ];
        const hash = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        return gradients[hash % gradients.length];
    };

    const messageCount = user.public_messages?.length || 0;
    const initial = (user.name || user.username || '?').charAt(0).toUpperCase();

    return (
        <div className="ufc-card" onClick={onCardClick}>
            {/* Decorative gradient bar */}
            <div className="ufc-accent" style={{ background: getGradient(user.username) }} />

            <div className="ufc-body">
                <div className="ufc-top-row">
                    <div className="ufc-avatar" style={{ background: getGradient(user.username) }}>
                        <span>{initial}</span>
                    </div>
                    <div className="ufc-identity">
                        <h3 className="ufc-name">{user.name || user.username}</h3>
                        <span className="ufc-handle">@{user.username}</span>
                    </div>
                    <div className="ufc-arrow">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>

                {lastMessage ? (
                    <div className="ufc-message-preview">
                        <div className="ufc-msg-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                        </div>
                        <p className="ufc-msg-text">{truncateText(lastMessage.content)}</p>
                        <span className="ufc-msg-time">{formatDate(lastMessage.created_at)}</span>
                    </div>
                ) : (
                    <div className="ufc-empty-msg">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <span>{t.userProfile.noMessagesYet}</span>
                    </div>
                )}

                {messageCount > 0 && (
                    <div className="ufc-stats">
                        <span className="ufc-stat-badge">
                            {messageCount} {t.userProfile.messagesCount}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserFollowingCard;
