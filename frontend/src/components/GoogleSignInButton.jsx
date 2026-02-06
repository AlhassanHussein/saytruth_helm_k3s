import { useEffect, useRef, useCallback } from 'react';
import './GoogleSignInButton.css';

/**
 * Reusable Google Sign-In button using Google Identity Services.
 * 
 * Props:
 * - onSuccess(credential): called with the Google ID token string
 * - onError(error): called on failure
 * - label: button text (default: "Sign in with Google")
 * - disabled: boolean
 */
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const GoogleSignInButton = ({ onSuccess, onError, label = 'Sign in with Google', disabled = false }) => {
    const btnRef = useRef(null);
    const initialized = useRef(false);

    const handleCredentialResponse = useCallback((response) => {
        if (response.credential) {
            onSuccess?.(response.credential);
        } else {
            onError?.('No credential received from Google');
        }
    }, [onSuccess, onError]);

    useEffect(() => {
        // Wait for Google Identity Services SDK to load
        const tryInit = () => {
            if (!window.google?.accounts?.id || !GOOGLE_CLIENT_ID || initialized.current) return;
            
            initialized.current = true;

            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleCredentialResponse,
                auto_select: false,
                cancel_on_tap_outside: true,
            });

            // Render the official Google button into our container
            if (btnRef.current) {
                window.google.accounts.id.renderButton(btnRef.current, {
                    type: 'standard',
                    theme: 'outline',
                    size: 'large',
                    text: 'continue_with',
                    shape: 'pill',
                    width: btnRef.current.offsetWidth || 320,
                    locale: document.documentElement.lang || 'en',
                });
            }
        };

        tryInit();

        // If SDK not loaded yet, retry after a short delay
        if (!window.google?.accounts?.id) {
            const interval = setInterval(() => {
                if (window.google?.accounts?.id) {
                    tryInit();
                    clearInterval(interval);
                }
            }, 300);
            return () => clearInterval(interval);
        }
    }, [handleCredentialResponse]);

    // Fallback button when SDK not loaded or no client ID
    if (!GOOGLE_CLIENT_ID) {
        return (
            <button
                type="button"
                className="google-btn-fallback"
                disabled={true}
                title="Google OAuth not configured"
            >
                <GoogleIcon />
                <span>Google Sign-In (not configured)</span>
            </button>
        );
    }

    return (
        <div className="google-btn-wrapper">
            <div ref={btnRef} className="google-btn-container" />
            {disabled && <div className="google-btn-overlay" />}
        </div>
    );
};

const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
);

export { GoogleIcon };
export default GoogleSignInButton;
