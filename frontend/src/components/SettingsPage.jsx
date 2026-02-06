import { useState, useCallback } from 'react';
import { translations } from '../i18n/translations';
import { authAPI } from '../services/api';
import GoogleSignInButton, { GoogleIcon } from './GoogleSignInButton';
import './AuthPages.css';

const SettingsPage = ({ currentUser, language = 'EN', onLogout, onLanguageChange, onUserUpdate }) => {
  const t = translations[language]?.settings || translations.EN.settings;
  const isRTL = language === 'AR';

  // Username
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [newUsername, setNewUsername] = useState(currentUser?.username || '');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState({ type: '', text: '' });

  // Language
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Change security phrase
  const [secOpen, setSecOpen] = useState(false);
  const [oldAnswer, setOldAnswer] = useState('');
  const [newPhrase, setNewPhrase] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [confirmAnswer, setConfirmAnswer] = useState('');
  const [secSaving, setSecSaving] = useState(false);
  const [secMsg, setSecMsg] = useState({ type: '', text: '' });
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // Google
  const [googleMsg, setGoogleMsg] = useState({ type: '', text: '' });
  const [googleLinking, setGoogleLinking] = useState(false);
  const [googleResetOpen, setGoogleResetOpen] = useState(false);
  const [grNewPhrase, setGrNewPhrase] = useState('');
  const [grNewAnswer, setGrNewAnswer] = useState('');
  const [grConfirmAnswer, setGrConfirmAnswer] = useState('');
  const [grSaving, setGrSaving] = useState(false);
  const [grMsg, setGrMsg] = useState({ type: '', text: '' });
  const [pendingGoogleCred, setPendingGoogleCred] = useState(null);

  const handleUsernameChange = async (e) => {
    e.preventDefault();
    setUsernameMsg({ type: '', text: '' });
    const trimmed = newUsername.trim();

    if (!trimmed) {
      setUsernameMsg({ type: 'error', text: t.allFieldsRequired });
      return;
    }
    if (trimmed.length < 3) {
      setUsernameMsg({ type: 'error', text: translations[language]?.auth?.usernameMinLength || 'Username must be at least 3 characters' });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setUsernameMsg({ type: 'error', text: translations[language]?.auth?.usernameInvalidChars || 'Letters, numbers, and underscores only' });
      return;
    }
    if (trimmed === currentUser?.username) {
      setUsernameMsg({ type: 'error', text: t.usernameSame });
      return;
    }

    setUsernameSaving(true);
    try {
      await authAPI.changeUsername(trimmed);
      setUsernameMsg({ type: 'success', text: t.usernameUpdated });
      if (onUserUpdate) onUserUpdate();
      setTimeout(() => {
        setUsernameMsg({ type: '', text: '' });
        setUsernameOpen(false);
      }, 2000);
    } catch (err) {
      const detail = err?.message || err?.response?.data?.detail || t.usernameTaken;
      setUsernameMsg({ type: 'error', text: detail });
    } finally {
      setUsernameSaving(false);
    }
  };

  const handleLanguageChange = async (lang) => {
    if (lang === language) return;
    setSaving(true);
    setSaved(false);
    try {
      await authAPI.updateSettings({ language: lang });
      onLanguageChange?.(lang);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      console.error('Failed to update language:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSecurityUpdate = async (e) => {
    e.preventDefault();
    setSecMsg({ type: '', text: '' });

    // Validate
    if (!oldAnswer.trim() || !newPhrase.trim() || !newAnswer.trim() || !confirmAnswer.trim()) {
      setSecMsg({ type: 'error', text: t.allFieldsRequired });
      return;
    }
    if (newAnswer !== confirmAnswer) {
      setSecMsg({ type: 'error', text: t.answersMismatch });
      return;
    }

    setSecSaving(true);
    try {
      await authAPI.changePassword(oldAnswer, newPhrase, newAnswer);
      setSecMsg({ type: 'success', text: t.securityUpdated });
      setOldAnswer('');
      setNewPhrase('');
      setNewAnswer('');
      setConfirmAnswer('');
      setTimeout(() => {
        setSecMsg({ type: '', text: '' });
        setSecOpen(false);
      }, 2000);
    } catch (err) {
      const detail = err?.response?.data?.detail || t.wrongAnswer;
      setSecMsg({ type: 'error', text: detail });
    } finally {
      setSecSaving(false);
    }
  };

  // Google link handler
  const handleGoogleLink = useCallback(async (credential) => {
    setGoogleMsg({ type: '', text: '' });
    setGoogleLinking(true);
    try {
      const result = await authAPI.googleLink(credential);
      setGoogleMsg({ type: 'success', text: t.googleLinkSuccess });
      // Refresh user data to show linked email
      if (onUserUpdate) onUserUpdate();
      setTimeout(() => setGoogleMsg({ type: '', text: '' }), 3000);
    } catch (err) {
      const detail = err.message || t.googleAlreadyLinked;
      setGoogleMsg({ type: 'error', text: detail });
    } finally {
      setGoogleLinking(false);
    }
  }, [t, onUserUpdate]);

  // Google reset: step 1 - get credential
  const handleGoogleResetCredential = useCallback((credential) => {
    setPendingGoogleCred(credential);
    setGoogleResetOpen(true);
    setGrMsg({ type: '', text: '' });
  }, []);

  // Google reset: step 2 - submit new phrase
  const handleGoogleResetSubmit = async (e) => {
    e.preventDefault();
    setGrMsg({ type: '', text: '' });

    if (!grNewPhrase.trim() || !grNewAnswer.trim() || !grConfirmAnswer.trim()) {
      setGrMsg({ type: 'error', text: t.allFieldsRequired });
      return;
    }
    if (grNewAnswer !== grConfirmAnswer) {
      setGrMsg({ type: 'error', text: t.answersMismatch });
      return;
    }
    if (!pendingGoogleCred) {
      setGrMsg({ type: 'error', text: 'Please sign in with Google first' });
      return;
    }

    setGrSaving(true);
    try {
      await authAPI.googleResetSecurity(pendingGoogleCred, grNewPhrase, grNewAnswer);
      setGrMsg({ type: 'success', text: t.securityUpdated });
      setGrNewPhrase('');
      setGrNewAnswer('');
      setGrConfirmAnswer('');
      setPendingGoogleCred(null);
      if (onUserUpdate) onUserUpdate();
      setTimeout(() => {
        setGrMsg({ type: '', text: '' });
        setGoogleResetOpen(false);
      }, 2000);
    } catch (err) {
      setGrMsg({ type: 'error', text: err.message || 'Failed to reset security phrase' });
    } finally {
      setGrSaving(false);
    }
  };

  return (
    <div className={`auth-page ${isRTL ? 'rtl' : ''}`}>
      <section className="auth-card card">
        {/* Header */}
        <div className="auth-hero">
          <div className="auth-copy">
            <span className="eyebrow">{t.title}</span>
            <h1 className="auth-title">{t.subtitle}</h1>
            <p className="auth-subtitle">{currentUser?.username || ''}</p>
          </div>
        </div>

        {/* Username section */}
        <div className="helper-row">
          <span className="badge">{t.usernameSection}</span>
        </div>

        <div className="auth-form">
          {!usernameOpen ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>{t.currentUsername}</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currentUser?.username}</div>
                </div>
              </div>
              <button
                className="action outline"
                type="button"
                onClick={() => { setUsernameOpen(true); setNewUsername(currentUser?.username || ''); setUsernameMsg({ type: '', text: '' }); }}
                style={{ width: '100%' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }}>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {t.changeUsername}
              </button>
            </div>
          ) : (
            <form onSubmit={handleUsernameChange}>
              <div className="form-group">
                <label className="label">{t.newUsernameLabel}</label>
                <input
                  type="text"
                  className="input"
                  placeholder={t.newUsernamePlaceholder}
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  autoComplete="off"
                  maxLength={50}
                />
                <small style={{ display: 'block', marginTop: 4, color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                  {t.usernameHint}
                </small>
              </div>

              {usernameMsg.text && (
                <div className={usernameMsg.type === 'success' ? 'field-success' : 'field-error'}>
                  {usernameMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                <button
                  className="action primary"
                  type="submit"
                  disabled={usernameSaving}
                  style={{ flex: 1 }}
                >
                  {usernameSaving ? (translations[language]?.common?.loading || 'Loading...') : t.saveUsername}
                </button>
                <button
                  className="action outline"
                  type="button"
                  onClick={() => { setUsernameOpen(false); setUsernameMsg({ type: '', text: '' }); }}
                >
                  {translations[language]?.common?.cancel || 'Cancel'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border-light)', margin: 'var(--spacing-md) 0' }} />

        {/* Security section */}
        <div className="helper-row">
          <span className="badge">{t.securitySection}</span>
        </div>

        <div className="auth-form">
          {!secOpen ? (
            <button
              className="action outline"
              type="button"
              onClick={() => setSecOpen(true)}
              style={{ width: '100%' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {t.changeSecurityPhrase}
            </button>
          ) : (
            <form onSubmit={handleSecurityUpdate}>
              {/* Current question display */}
              {currentUser?.secret_phrase && (
                <div className="form-group">
                  <label className="label">{t.currentQuestion}</label>
                  <div style={{
                    padding: 'var(--spacing-md)',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic',
                  }}>
                    {currentUser.secret_phrase}
                  </div>
                </div>
              )}

              {/* Old answer */}
              <div className="form-group">
                <div className="label-row">
                  <label className="label">{t.oldAnswer}</label>
                  <button type="button" className="hint" onClick={() => setShowOld(!showOld)}>
                    {showOld ? (translations[language]?.auth?.hidePassword || 'Hide') : (translations[language]?.auth?.showPassword || 'Show')}
                  </button>
                </div>
                <input
                  type={showOld ? 'text' : 'password'}
                  className="input"
                  placeholder={t.oldAnswerPlaceholder}
                  value={oldAnswer}
                  onChange={(e) => setOldAnswer(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {/* New phrase */}
              <div className="form-group">
                <label className="label">{t.newPhrase}</label>
                <input
                  type="text"
                  className="input"
                  placeholder={t.newPhrasePlaceholder}
                  value={newPhrase}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {/* New answer */}
              <div className="form-group">
                <div className="label-row">
                  <label className="label">{t.newAnswer}</label>
                  <button type="button" className="hint" onClick={() => setShowNew(!showNew)}>
                    {showNew ? (translations[language]?.auth?.hidePassword || 'Hide') : (translations[language]?.auth?.showPassword || 'Show')}
                  </button>
                </div>
                <input
                  type={showNew ? 'text' : 'password'}
                  className="input"
                  placeholder={t.newAnswerPlaceholder}
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {/* Confirm answer */}
              <div className="form-group">
                <label className="label">{t.confirmNewAnswer}</label>
                <input
                  type={showNew ? 'text' : 'password'}
                  className="input"
                  placeholder={t.confirmNewAnswerPlaceholder}
                  value={confirmAnswer}
                  onChange={(e) => setConfirmAnswer(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {/* Status message */}
              {secMsg.text && (
                <div className={secMsg.type === 'success' ? 'field-success' : 'field-error'}>
                  {secMsg.text}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                <button
                  className="action primary"
                  type="submit"
                  disabled={secSaving}
                  style={{ flex: 1 }}
                >
                  {secSaving ? (translations[language]?.common?.loading || 'Loading...') : t.updateSecurity}
                </button>
                <button
                  className="action outline"
                  type="button"
                  onClick={() => {
                    setSecOpen(false);
                    setSecMsg({ type: '', text: '' });
                    setOldAnswer('');
                    setNewPhrase('');
                    setNewAnswer('');
                    setConfirmAnswer('');
                  }}
                >
                  {translations[language]?.common?.cancel || 'Cancel'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border-light)', margin: 'var(--spacing-md) 0' }} />

        {/* Google Account Section */}
        <div className="helper-row">
          <span className="badge">{t.googleSection}</span>
        </div>

        <div className="auth-form">
          {/* Show linked state or link button */}
          {currentUser?.google_email ? (
            <div className="google-linked-badge">
              <GoogleIcon />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {t.googleLinked}
                </div>
                <div className="google-email">
                  {t.googleLinkedAs}: {currentUser.google_email}
                </div>
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label className="label">{t.linkGoogle}</label>
              <GoogleSignInButton
                onSuccess={handleGoogleLink}
                onError={(err) => setGoogleMsg({ type: 'error', text: err })}
                disabled={googleLinking}
              />
            </div>
          )}

          {googleMsg.text && (
            <div className={googleMsg.type === 'success' ? 'field-success' : 'field-error'} style={{ marginTop: 'var(--spacing-sm)' }}>
              {googleMsg.text}
            </div>
          )}

          {/* Reset security via Google */}
          {currentUser?.google_email && (
            <div className="form-group" style={{ marginTop: 'var(--spacing-md)' }}>
              {!googleResetOpen ? (
                <div>
                  <button
                    className="action outline"
                    type="button"
                    onClick={() => {
                      // Trigger Google sign-in to get fresh credential
                      // We use the GoogleSignInButton callback
                      setGoogleResetOpen(true);
                    }}
                    style={{ width: '100%' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }}>
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                    </svg>
                    {t.resetViaGoogle}
                  </button>
                  <small style={{ display: 'block', marginTop: 'var(--spacing-xs)', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                    {t.resetViaGoogleDesc}
                  </small>
                </div>
              ) : (
                <form onSubmit={handleGoogleResetSubmit}>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                    {t.resetViaGoogleDesc}
                  </p>

                  {!pendingGoogleCred && (
                    <div className="form-group">
                      <label className="label" style={{ marginBottom: 'var(--spacing-sm)' }}>Step 1: Verify with Google</label>
                      <GoogleSignInButton
                        onSuccess={handleGoogleResetCredential}
                        onError={(err) => setGrMsg({ type: 'error', text: err })}
                      />
                    </div>
                  )}

                  {pendingGoogleCred && (
                    <>
                      <div className="form-group">
                        <label className="label">{t.newPhrase}</label>
                        <input
                          type="text"
                          className="input"
                          placeholder={t.newPhrasePlaceholder}
                          value={grNewPhrase}
                          onChange={(e) => setGrNewPhrase(e.target.value)}
                          autoComplete="off"
                        />
                      </div>

                      <div className="form-group">
                        <label className="label">{t.newAnswer}</label>
                        <input
                          type="password"
                          className="input"
                          placeholder={t.newAnswerPlaceholder}
                          value={grNewAnswer}
                          onChange={(e) => setGrNewAnswer(e.target.value)}
                          autoComplete="off"
                        />
                      </div>

                      <div className="form-group">
                        <label className="label">{t.confirmNewAnswer}</label>
                        <input
                          type="password"
                          className="input"
                          placeholder={t.confirmNewAnswerPlaceholder}
                          value={grConfirmAnswer}
                          onChange={(e) => setGrConfirmAnswer(e.target.value)}
                          autoComplete="off"
                        />
                      </div>
                    </>
                  )}

                  {grMsg.text && (
                    <div className={grMsg.type === 'success' ? 'field-success' : 'field-error'}>
                      {grMsg.text}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                    {pendingGoogleCred && (
                      <button
                        className="action primary"
                        type="submit"
                        disabled={grSaving}
                        style={{ flex: 1 }}
                      >
                        {grSaving ? (translations[language]?.common?.loading || 'Loading...') : t.updateSecurity}
                      </button>
                    )}
                    <button
                      className="action outline"
                      type="button"
                      onClick={() => {
                        setGoogleResetOpen(false);
                        setGrMsg({ type: '', text: '' });
                        setPendingGoogleCred(null);
                        setGrNewPhrase('');
                        setGrNewAnswer('');
                        setGrConfirmAnswer('');
                      }}
                    >
                      {translations[language]?.common?.cancel || 'Cancel'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border-light)', margin: 'var(--spacing-md) 0' }} />

        {/* Logout */}
        <div className="auth-form">
          <div className="form-group">
            <button className="action outline danger" type="button" onClick={onLogout}>
              {translations[language]?.buttons?.logout || 'Logout'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
