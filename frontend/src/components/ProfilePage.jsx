import { useState } from 'react';
import { translations } from '../i18n/translations';
import { authAPI } from '../services/api';
import './ProfilePage.css';

const ProfilePage = ({ isAuthenticated, currentUser, onLogout, onLoginClick, onSignupClick, onSettingsClick, language = 'EN' }) => {
    const t = translations[language] || translations.EN;
    const [copied, setCopied] = useState(false);
    const storedBio = typeof window !== 'undefined' ? localStorage.getItem('profileBio') : '';
    const initialBio = isAuthenticated ? (currentUser?.bio || storedBio || '') : '';
    const [savedBio, setSavedBio] = useState(initialBio);
    const [bio, setBio] = useState(initialBio);
    const [isEditingBio, setIsEditingBio] = useState(false);
    const username = isAuthenticated ? currentUser?.username || 'User' : t.auth.login;
    const displayName = isAuthenticated ? (currentUser?.name || currentUser?.username || 'User') : t.auth.login;
    const targetUsername = isAuthenticated && currentUser?.username ? currentUser.username : 'guest';
    const targetId = isAuthenticated && currentUser?.id ? currentUser.id : 'guest';
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    const canonicalUrl = `${origin}/profile/${targetId}`;

    const mockLinks = [
        { id: 1, label: 'Confession board', status: 'active', timeLeft: '2h 14m' },
        { id: 2, label: 'Feedback form', status: 'expiring', timeLeft: '28m' },
    ];

    const mockFollowing = [
        { id: 1, name: 'alex_johnson' },
        { id: 2, name: 'maria_garcia' },
        { id: 3, name: 'sarah_smith' },
    ];

    const isRTL = language === 'AR';

 
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
        <div className={`profile-page ${isRTL ? 'rtl' : ''}`}>
            <section className="profile-hero card">
                <div className="profile-cover" />
                <div className="profile-content">
                    <div className="profile-identity">
                        <div className="profile-avatar">
                            {displayName?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="profile-info">
                            <h1 className="profile-name">{displayName}</h1>
                            <p className="profile-username">@{username}</p>
                            <div className="profile-bio-row">
                                {isEditingBio ? (
                                    <textarea
                                        className="profile-bio-input"
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder={t.profile.bioPlaceholder}
                                        maxLength={200}
                                    />
                                ) : (
                                    <p className="profile-bio">
                                        {renderBio(savedBio || t.profile.bioPlaceholder)}
                                    </p>
                                )}
                                {isAuthenticated && (
                                    <div className="profile-bio-actions">
                                        {isEditingBio ? (
                                            <>
                                                <button
                                                    className="action primary"
                                                    type="button"
                                                    onClick={() => {
                                                        setSavedBio(bio);
                                                        setIsEditingBio(false);
                                                        if (typeof window !== 'undefined') {
                                                            localStorage.setItem('profileBio', bio);
                                                        }
                                                        if (isAuthenticated) {
                                                            authAPI.updateSettings({ bio }).catch(() => {});
                                                        }
                                                    }}
                                                >
                                                    {t.common.save}
                                                </button>
                                                <button
                                                    className="action outline"
                                                    type="button"
                                                    onClick={() => {
                                                        setBio(savedBio);
                                                        setIsEditingBio(false);
                                                    }}
                                                >
                                                    {t.common.cancel}
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                className="action soft"
                                                type="button"
                                                onClick={() => setIsEditingBio(true)}
                                            >
                                                {t.profile.editBio}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="profile-stats">
                        <div className="stat-box">
                            <div className="stat-number">{mockLinks.length}</div>
                            <div className="stat-label">{t.links.title}</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-number">{mockFollowing.length}</div>
                            <div className="stat-label">{t.buttons.following || 'Following'}</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-number">0</div>
                            <div className="stat-label">{t.messages.messagePlural}</div>
                        </div>
                    </div>

                    <div className="profile-url">
                        <button
                            className="chip subtle clickable profile-url-chip"
                            type="button"
                            onClick={() => {
                                if (navigator?.clipboard?.writeText) {
                                    navigator.clipboard.writeText(canonicalUrl).then(() => {
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 1500);
                                    }).catch(() => {});
                                }
                            }}
                        >
                            <span className="profile-url-label">{t.profile.profileUrl}</span>
                            <span className="profile-url-path">/profile/{targetUsername}</span>
                            <span className="profile-url-copy">{t.profile.copy}</span>
                        </button>
                        {copied && <span className="profile-copied">{t.profile.copied}</span>}
                    </div>

                    <div className="profile-actions">
                        {isAuthenticated ? (
                            <>
                                <button className="action primary" onClick={onSettingsClick}>
                                    {t.nav.settings}
                                </button>
                                <button className="action outline danger" onClick={onLogout}>
                                    {t.buttons.logout}
                                </button>
                            </>
                        ) : (
                            <>
                                <button className="action primary" onClick={onLoginClick}>
                                    {t.buttons.login}
                                </button>
                                <button className="action soft" onClick={onSignupClick}>
                                    {t.buttons.signup}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {!isAuthenticated && (
                <section className="profile-card card">
                    <div className="card-header">
                        <div>
                            <p className="eyebrow subtle">{t.profile.guestTitle}</p>
                            <h2 className="card-title">{t.profile.guestSubtitle}</h2>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
export default ProfilePage;
