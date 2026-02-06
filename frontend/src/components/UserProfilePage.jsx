import { useEffect, useState } from 'react';
import { userAPI, messagesAPI } from '../services/api';
import { translations } from '../i18n/translations';
import './ProfilePage.css'; // Reuse profile styles

const UserProfilePage = ({ userId, isAuthenticated, currentUser, onBack, onLoginClick, language = 'EN' }) => {
    const [profile, setProfile] = useState(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [messageContent, setMessageContent] = useState('');
    const [messageStatus, setMessageStatus] = useState(null);
    const [copied, setCopied] = useState(false);

    const t = translations[language] || translations.EN;
    const isRTL = language === 'AR';
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';

    useEffect(() => {
        if (userId) {
            loadProfile();
        }
    }, [userId, isAuthenticated]); // Re-fetch when userId or auth state changes

    const loadProfile = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // Detect if userId is a UUID or a username
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
            const data = isUUID
                ? await userAPI.getUserProfile(userId)
                : await userAPI.getUserByUsername(userId);
            setProfile(data);
            
            // Check follow status using the actual user ID from profile
            const profileId = data.id;
            if (isAuthenticated) {
                try {
                    const statusData = await userAPI.checkFollowStatus(profileId);
                    console.log('✅ Follow status for user', profileId, ':', statusData);
                    setIsFollowing(statusData.is_following === true);
                } catch (err) {
                    console.error('❌ Error checking follow status:', err);
                    setIsFollowing(false);
                }
            } else {
                setIsFollowing(false);
            }
        } catch (err) {
            setError(err.message || t.error);
            console.error('Failed to load profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async () => {
        if (!isAuthenticated) {
            onLoginClick();
            return;
        }

        try {
            if (isFollowing) {
                // User is following → UNFOLLOW
                console.log('🔄 Unfollowing user', profile.id);
                await userAPI.unfollowUser(profile.id);
                console.log('✅ Successfully unfollowed');
                setIsFollowing(false);
            } else {
                // User is NOT following → FOLLOW
                console.log('🔄 Following user', profile.id);
                await userAPI.followUser(profile.id);
                console.log('✅ Successfully followed');
                setIsFollowing(true);
            }
        } catch (err) {
            console.error('❌ Failed to update follow status:', err);
            // Re-fetch the actual state from backend to stay in sync
            try {
                const statusData = await userAPI.checkFollowStatus(profile.id);
                setIsFollowing(statusData.is_following === true);
            } catch (refetchErr) {
                console.error('❌ Failed to refetch follow status:', refetchErr);
            }
        }
    };

    const handleSendMessage = async () => {
        const trimmed = messageContent.trim();
        if (!trimmed) {
            setMessageStatus({ type: 'error', text: t.errors.generic });
            return;
        }

        try {
            await messagesAPI.sendMessage(profile.username, trimmed);
            setMessageStatus({ type: 'success', text: t.messages.sent });
            setMessageContent('');
        } catch (err) {
            setMessageStatus({ type: 'error', text: t.errors.generic });
            console.error('Failed to send message:', err);
        }
    };

    if (loading) {
        return (
            <div className={`user-profile-page ${isRTL ? 'rtl' : ''}`}>
                <div className="loading">{t.common.loading}</div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className={`user-profile-page ${isRTL ? 'rtl' : ''}`}>
                <div className="error-state card">
                    <p className="error-icon">⚠️</p>
                    <p className="error-title">{t.errors.generic}</p>
                    <button onClick={loadProfile} className="action primary">{t.common.retry}</button>
                </div>

                <div className="hero-controls">
                    {profile && (
                        <div
                            className="chip subtle"
                            role="button"
                            aria-label="Copy user URL"
                            onClick={() => {
                                const canonicalUrl = `${origin}/user/${profile.username}`;
                                if (navigator?.clipboard?.writeText) {
                                    navigator.clipboard.writeText(canonicalUrl).then(() => {
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 1500);
                                    }).catch(() => {});
                                }
                            }}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                </svg>
                                <span>Share URL:</span>
                            </span>
                            <a href={`/user/${profile.username}`} style={{ marginLeft: '0.35rem' }}>/user/{profile.username}</a>
                            {copied && <span style={{ marginLeft: '0.5rem', fontWeight: 700 }}>Copied!</span>}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const renderBio = (text) => {
        if (!text) return null;
        const regex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
        return text.split(regex).map((part, idx) => {
            if (regex.test(part)) {
                const href = part.startsWith('http') ? part : `https://${part}`;
                return (
                    <a
                        key={idx}
                        href={href}
                        className="bio-link"
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                            if (navigator?.clipboard?.writeText) {
                                navigator.clipboard.writeText(href).catch(() => {});
                            }
                        }}
                    >
                        {part}
                    </a>
                );
            }
            return <span key={idx}>{part}</span>;
        });
    };

    return (
        <div className={`user-profile-page ${isRTL ? 'rtl' : ''}`}>
            <section className="profile-hero card">
                <div className="profile-cover" />
                <div className="profile-content">
                    <div className="profile-identity">
                        <div className="profile-avatar">
                            {profile.username[0].toUpperCase()}
                        </div>
                        <div className="profile-info">
                            <h1 className="profile-name">{profile.name || profile.username}</h1>
                            <p className="profile-username">@{profile.username}</p>
                            {profile.bio && (
                                <p className="profile-bio">
                                    {renderBio(profile.bio)}
                                </p>
                            )}
                        </div>
                        <div className="profile-actions">
                            {isAuthenticated ? (
                                <button
                                    onClick={handleFollow}
                                    className={`action ${isFollowing ? 'outline' : 'primary'}`}
                                >
                                    {isFollowing ? t.buttons.following : t.buttons.follow}
                                </button>
                            ) : (
                                <button onClick={onLoginClick} className="action soft">
                                    {t.buttons.login}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="profile-url">
                        <button
                            className="chip subtle clickable profile-url-chip"
                            type="button"
                            onClick={() => {
                                const canonicalUrl = `${origin}/profile/${profile.id}`;
                                if (navigator?.clipboard?.writeText) {
                                    navigator.clipboard.writeText(canonicalUrl).then(() => {
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 1500);
                                    }).catch(() => {});
                                }
                            }}
                        >
                            <span className="profile-url-label">{t.userProfile.shareUrl}</span>
                            <span className="profile-url-path">/profile/{profile.id}</span>
                            <span className="profile-url-copy">{t.profile.copy}</span>
                        </button>
                        {copied && <span className="profile-copied">{t.profile.copied}</span>}
                    </div>
                </div>
            </section>

            <section className="message-composer card">
                <div className="composer-header">
                    <div>
                        <p className="eyebrow subtle">{t.messages.anonymousTitle}</p>
                        <h3 className="composer-title">@{profile.username}</h3>
                    </div>
                    <span className="count-badge">✉️</span>
                </div>
                <textarea
                    className="composer-input"
                    placeholder={t.messages.send}
                    value={messageContent}
                    onChange={(e) => {
                        setMessageContent(e.target.value);
                        if (messageStatus) setMessageStatus(null);
                    }}
                    maxLength={500}
                />
                {messageStatus && (
                    <div className={`composer-status ${messageStatus.type}`}>
                        {messageStatus.text}
                    </div>
                )}
                <div className="composer-actions">
                    <button
                        className="action primary"
                        onClick={handleSendMessage}
                        disabled={!messageContent.trim()}
                    >
                        {t.messages.send}
                    </button>
                </div>
            </section>

            <section className="profile-card card">
                <div className="card-header">
                    <h2 className="card-title">{t.userProfile.messages}</h2>
                    <span className="count-badge">{profile.total_public_messages || profile.public_messages?.length || 0}</span>
                </div>

                {!profile.public_messages || profile.public_messages.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">💭</div>
                        <p className="empty-title">{t.userProfile.noMessages}</p>
                    </div>
                ) : (
                    <div className="messages-list">
                        {profile.public_messages.map((msg) => (
                            <div key={msg.id} className="message-card public">
                                <div className="message-content">{msg.content}</div>
                                <div className="message-meta">
                                    <span className="message-date">
                                        {new Date(msg.created_at).toLocaleDateString(language === 'AR' ? 'ar-EG' : language === 'ES' ? 'es-ES' : 'en-US')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default UserProfilePage;
