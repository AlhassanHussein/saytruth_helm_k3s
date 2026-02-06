import { useState, useEffect } from 'react';
import { linksAPI } from '../services/api';
import { translations } from '../i18n/translations';
import './LinksTab.css';

const LinksTab = ({ isAuthenticated, language = 'EN' }) => {
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState(null);

    // Creation states
    const [displayName, setDisplayName] = useState('');
    const [expiration, setExpiration] = useState('12h');
    const [creating, setCreating] = useState(false);
    const [createdLink, setCreatedLink] = useState(null);
    const [copiedPublic, setCopiedPublic] = useState(false);
    const [copiedPrivate, setCopiedPrivate] = useState(false);
    const [showGuestWarning, setShowGuestWarning] = useState(false);

    // Delete confirmation state
    const [deletingLinkId, setDeletingLinkId] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const t = translations[language] || translations.EN;
    const guestExpirations = ['6h', '12h'];
    const allExpirations = ['6h', '12h', '24h', '7d', '30d'];

    useEffect(() => {
        if (isAuthenticated) {
            fetchUserLinks();
        } else {
            setLoading(false);
        }
    }, [isAuthenticated]);

    const fetchUserLinks = async () => {
        try {
            setLoading(true);
            const userLinks = await linksAPI.getUserLinks();
            setLinks(userLinks);
        } catch (err) {
            console.error('Failed to load links:', err);
            setLinks([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();

        if (!isAuthenticated && !guestExpirations.includes(expiration)) {
            setShowGuestWarning(true);
            setTimeout(() => setShowGuestWarning(false), 5000);
            return;
        }

        setCreating(true);
        setShowGuestWarning(false);

        try {
            const link = await linksAPI.createLink({
                display_name: displayName || 'Anonymous',
                expiration_option: expiration,
            });
            setCreatedLink(link);
            setDisplayName('');
            if (isAuthenticated) {
                fetchUserLinks();
            }
        } catch (err) {
            console.error('Failed to create link:', err);
            alert(t.errors.generic);
        } finally {
            setCreating(false);
        }
    };

    const safeCopy = async (text) => {
        if (!text) return false;

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (err) {
            console.error('Clipboard API failed:', err);
        }

        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const succeeded = document.execCommand('copy');
            document.body.removeChild(textarea);
            return succeeded;
        } catch (err) {
            console.error('Fallback copy failed:', err);
        }

        return false;
    };

    const handleCopy = async (url, id) => {
        const copied = await safeCopy(url);
        if (copied) {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        }
    };

    const copyCreated = async (url, type) => {
        const copied = await safeCopy(url);
        if (!copied) return;
        if (type === 'public') {
            setCopiedPublic(true);
            setTimeout(() => setCopiedPublic(false), 2000);
        } else {
            setCopiedPrivate(true);
            setTimeout(() => setCopiedPrivate(false), 2000);
        }
    };

    const getPublicUrl = (publicId) => `${window.location.origin}/link/public/${publicId}`;
    const getPrivateUrl = (privateId) => `${window.location.origin}/link/private/${privateId}`;

    const parseApiDate = (value) => {
        if (!value) return null;
        if (value instanceof Date) return value;
        if (typeof value === 'string') {
            const hasTimezone = /[zZ]|[+-]\d\d:?\d\d$/.test(value);
            return new Date(hasTimezone ? value : `${value}Z`);
        }
        return new Date(value);
    };

    const getTimeRemaining = (expiresAt) => {
        if (!expiresAt) return t.links.permanent;

        const now = new Date();
        const expires = parseApiDate(expiresAt);
        if (!expires || Number.isNaN(expires.getTime())) return t.links.permanent;
        const remaining = expires - now;

        if (remaining <= 0) return t.links.expired;

        const dayMs = 1000 * 60 * 60 * 24;
        const hourMs = 1000 * 60 * 60;
        const minuteMs = 1000 * 60;
        const days = Math.floor(remaining / dayMs);
        if (days > 0) {
            const hours = Math.floor((remaining % dayMs) / hourMs);
            return `${days}d ${hours}h`;
        }
        const hours = Math.ceil(remaining / hourMs);
        if (hours >= 1) return `${hours}h`;
        const minutes = Math.ceil(remaining / minuteMs);
        return `${minutes}m`;
    };

    const isExpired = (expiresAt) => {
        if (!expiresAt) return false;
        const expires = parseApiDate(expiresAt);
        if (!expires || Number.isNaN(expires.getTime())) return false;
        return expires <= new Date();
    };

    const formatExpiration = (expiresAt) => {
        if (!expiresAt) return t.links.permanent;
        const now = new Date();
        const expires = parseApiDate(expiresAt);
        if (!expires || Number.isNaN(expires.getTime())) return t.links.permanent;
        const diff = expires - now;
        if (diff <= 0) return t.links.expired;
        const dayMs = 1000 * 60 * 60 * 24;
        const hourMs = 1000 * 60 * 60;
        const minuteMs = 1000 * 60;
        const days = Math.floor(diff / dayMs);
        if (days > 0) return `${days} ${t.links.days}`;
        const hours = Math.ceil(diff / hourMs);
        if (hours >= 1) return `${hours} ${t.links.hours}`;
        const minutes = Math.ceil(diff / minuteMs);
        if (minutes >= 1) return `${minutes} min`;
        return t.links.lessThanHour;
    };

    const handleDeleteLink = async () => {
        if (!deletingLinkId) return;
        
        try {
            await linksAPI.deleteLink(deletingLinkId);
            setLinks(links.filter(link => link.id !== deletingLinkId));
            setShowDeleteModal(false);
            setDeletingLinkId(null);
        } catch (err) {
            console.error('Failed to delete link:', err);
            alert(t.errors?.generic || 'Failed to delete link');
        }
    };

    const confirmDelete = (linkId) => {
        setDeletingLinkId(linkId);
        setShowDeleteModal(true);
    };

    if (loading) {
        return (
            <div className="links-tab links-loading">
                <div className="card links-card">
                    <p>{t.common.loading}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="links-tab">
            {/* Intro Hero Card */}
            <section className="card links-card links-hero">
                <span className="links-hero-eyebrow">{t.nav.links}</span>
                <h1 className="links-hero-title">{t.links.introTitle}</h1>
                <p className="links-hero-subtitle">{t.links.introSubtitle}</p>
                
                <p className="links-hero-desc">
                    {t.links.introDescription}
                </p>
                
                <div className="links-hero-bullets">
                    <div className="links-hero-bullet">
                        <span className="links-hero-bullet-dot">•</span>
                        <p className="links-hero-bullet-text">
                            {t.links.introBullets?.generate}
                        </p>
                    </div>
                    <div className="links-hero-bullet">
                        <span className="links-hero-bullet-dot">•</span>
                        <p className="links-hero-bullet-text">
                            {t.links.introBullets?.public}
                        </p>
                    </div>
                    <div className="links-hero-bullet">
                        <span className="links-hero-bullet-dot">•</span>
                        <p className="links-hero-bullet-text">
                            {t.links.introBullets?.private}
                        </p>
                    </div>
                </div>
            </section>

            {/* Create link section */}
            <section className="card links-card">
                <h2 className="links-section-title">{t.links.createLinkTitle}</h2>
                <p className="links-section-subtitle">{t.links.generateSubtitle}</p>
                <form onSubmit={handleCreate}>
                    <div className="links-form-group">
                        <label className="links-form-label">{t.links.displayNameLabel}</label>
                        <input
                            type="text"
                            placeholder={t.links.displayNamePlaceholder}
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="links-input"
                            maxLength="50"
                        />
                    </div>

                    <div className="links-form-group">
                        <label className="links-form-label">{t.links.durationLabel}</label>
                        <select
                            value={expiration}
                            onChange={(e) => setExpiration(e.target.value)}
                            className="links-select"
                        >
                            {allExpirations.map((exp) => (
                                <option
                                    key={exp}
                                    value={exp}
                                    disabled={!isAuthenticated && !guestExpirations.includes(exp)}
                                >
                                    {
                                        {
                                            '6h': t.links.duration6h,
                                            '12h': t.links.duration12h,
                                            '24h': t.links.duration24h,
                                            '7d': t.links.duration7d,
                                            '30d': t.links.duration30d
                                        }[exp]
                                    }
                                    {!isAuthenticated && !guestExpirations.includes(exp) ? ` (${t.auth.login})` : ''}
                                </option>
                            ))}
                        </select>
                        {!isAuthenticated && (
                            <p className="links-duration-note">
                                {t.links.guestDurationNote} <a href="/login">{t.auth.login}</a> · <a href="/signup">{t.auth.signup}</a>
                            </p>
                        )}
                    </div>

                    {showGuestWarning && (
                        <div className="links-warning">
                            ⚠️ {t.links.guestWarning}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={creating}
                        className="action primary btn-block"
                    >
                        {creating ? t.common.loading : t.links.createBtn}
                    </button>
                </form>
            </section>

            {createdLink && (
                <section className="card links-card">
                    <div className="created-header">
                        <h2 className="links-section-title">{t.links.linksGenerated}</h2>
                        <div className="created-badge">
                            {t.links.expiresIn} {formatExpiration(createdLink.expires_at)}
                        </div>
                    </div>

                    <div className="link-block">
                        <div className="link-block-header">
                            <span className="link-block-icon">🌍</span>
                            <div>
                                <h3 className="link-block-title">{t.links.publicLinkTitle}</h3>
                                <p className="link-block-desc">{t.links.publicLinkDesc}</p>
                                <div className="link-block-code">
                                    /link/public/{createdLink.public_id}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => copyCreated(getPublicUrl(createdLink.public_id), 'public')}
                            className="action primary btn-block"
                        >
                            {copiedPublic ? t.links.copied : t.links.copyPublic}
                        </button>
                    </div>

                    <div className="link-block">
                        <div className="link-block-header">
                            <span className="link-block-icon">🔒</span>
                            <div>
                                <h3 className="link-block-title">{t.links.privateLinkTitle}</h3>
                                <p className="link-block-desc">{t.links.privateLinkDesc}</p>
                                <div className="link-block-code">
                                    /link/private/{createdLink.private_id}
                                </div>
                            </div>
                        </div>
                        <div className="link-block-actions">
                            <button
                                onClick={() => copyCreated(getPrivateUrl(createdLink.private_id), 'private')}
                                className="action outline"
                            >
                                {copiedPrivate ? t.links.copied : t.links.copyPrivate}
                            </button>
                            <a
                                href={`/link/private/${createdLink.private_id}`}
                                className="action primary"
                            >
                                {t.links.viewInbox}
                            </a>
                        </div>
                    </div>
                </section>
            )}

            {/* My links (auth only) */}
            <section className="card links-card">
                <h1 className="links-section-title">{t.links.myLinksTitle}</h1>
                <p className="links-section-subtitle">{t.links.myLinksSubtitle}</p>
            </section>

            {!isAuthenticated && (
                <div className="card links-card links-empty">
                    <div className="links-empty-icon">🔒</div>
                    <h3 className="links-empty-title">{t.links.loginToView}</h3>
                    <p className="links-empty-text">
                        {t.links.guestLinksWarning}
                    </p>
                </div>
            )}

            {isAuthenticated && (
                links.length === 0 ? (
                    <div className="card links-card links-empty">
                        <div className="links-empty-icon">📭</div>
                        <h3 className="links-empty-title">{t.links.noLinksYet}</h3>
                        <p className="links-empty-text">
                            {t.links.noLinksDesc}
                        </p>
                    </div>
                ) : (
                    links.map((link) => {
                        const expired = isExpired(link.expires_at);
                        const publicUrl = getPublicUrl(link.public_id);
                        const privateUrl = getPrivateUrl(link.private_id);

                        return (
                            <div key={link.public_id} className={`card links-card link-item ${expired ? 'expired' : ''}`}>
                                <div className="link-item-header">
                                    <h3 className="link-item-title">{link.display_name || t.links.anonymous}</h3>
                                    <span className={`link-item-badge ${expired ? 'expired' : ''}`}>
                                        {expired ? t.links.expired : `⏱ ${getTimeRemaining(link.expires_at)}`}
                                    </span>
                                </div>
                                <p className="link-item-meta">
                                    {t.links.created} {new Date(link.created_at).toLocaleDateString()}
                                </p>

                                <div className="link-url-group">
                                    <div className="link-url-label">
                                        <span>🌍</span>
                                        <span>{t.links.publicLinkTitle}</span>
                                    </div>
                                    <div className="link-url-row">
                                        <input
                                            type="text"
                                            value={publicUrl}
                                            readOnly
                                            className="link-url-input"
                                        />
                                        <button
                                            onClick={() => handleCopy(publicUrl, `public-${link.public_id}`)}
                                            disabled={expired}
                                            className="action outline"
                                        >
                                            {copiedId === `public-${link.public_id}` ? t.links.copied : t.links.copy}
                                        </button>
                                    </div>
                                </div>

                                <div className="link-url-group">
                                    <div className="link-url-label">
                                        <span>🔒</span>
                                        <span>{t.links.privateLinkTitle}</span>
                                    </div>
                                    <div className="link-url-row">
                                        <input
                                            type="text"
                                            value={privateUrl}
                                            readOnly
                                            className="link-url-input"
                                        />
                                        <button
                                            onClick={() => handleCopy(privateUrl, `private-${link.private_id}`)}
                                            className="action outline"
                                        >
                                            {copiedId === `private-${link.private_id}` ? t.links.copied : t.links.copy}
                                        </button>
                                        <a
                                            href={privateUrl}
                                            className="action primary"
                                        >
                                            {t.links.view}
                                        </a>
                                    </div>
                                </div>

                                <div className="link-delete-row">
                                    <button
                                        onClick={() => confirmDelete(link.id)}
                                        className="action outline danger btn-block"
                                    >
                                        🗑️ {t.links.deleteLink}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )
            )}

            {/* Delete confirmation modal */}
            {showDeleteModal && (
                <div className="links-modal-overlay">
                    <div className="card links-modal-card">
                        <h3 className="links-modal-title">
                            {t.links.confirmDeleteLink}
                        </h3>
                        <p className="links-modal-text">
                            {t.links.confirmDeleteLinkMessage}
                        </p>
                        <div className="links-modal-actions">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeletingLinkId(null);
                                }}
                                className="action outline"
                            >
                                {t.common.cancel}
                            </button>
                            <button
                                onClick={handleDeleteLink}
                                className="action danger"
                            >
                                {t.common.delete}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LinksTab;
