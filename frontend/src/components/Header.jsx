import { useNavigate } from 'react-router-dom';
import { translations } from '../i18n/translations';
import './Header.css';

const Header = ({ isAuthenticated, currentUser, language, onLanguageChange, theme, onThemeToggle }) => {
    const navigate = useNavigate();
    const t = translations[language] || translations.EN;
    const username = isAuthenticated && currentUser?.username ? currentUser.username : t.auth.login;

    const languages = ['EN', 'AR', 'ES'];

    const handleProfileClick = () => {
        navigate(isAuthenticated ? '/profile/me' : '/profile/guest');
    };

    return (
        <header className={`header ${language === 'AR' ? 'rtl' : ''}`}>
            <div className="header-content">
                <div className="header-left">
                    <div className="logo">
                        <span className="logo-icon">💬</span>
                        <span className="logo-text">SayTruth</span>
                    </div>
                    <span className="username">{username}</span>
                </div>

                <div className="header-right">
                    <div className="language-selector">
                        {languages.map((lang) => (
                            <button
                                key={lang}
                                className={`lang-btn ${language === lang ? 'active' : ''}`}
                                onClick={() => onLanguageChange(lang)}
                            >
                                {lang}
                            </button>
                        ))}
                    </div>

                    <button
                        className="theme-toggle-btn"
                        aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                        type="button"
                        onClick={onThemeToggle}
                    >
                        {theme === 'light' ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="5" />
                                <line x1="12" y1="1" x2="12" y2="3" />
                                <line x1="12" y1="21" x2="12" y2="23" />
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                <line x1="1" y1="12" x2="3" y2="12" />
                                <line x1="21" y1="12" x2="23" y2="12" />
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                        )}
                    </button>

                    <button
                        className="profile-btn"
                        aria-label={t.nav.profile}
                        type="button"
                        onClick={handleProfileClick}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="8" r="4" />
                            <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                        </svg>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
