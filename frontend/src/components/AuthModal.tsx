import React, { useState } from 'react';
import { X, User, Lock, Mail, ShieldCheck, ArrowRight, AlertCircle, CheckCircle, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { AuthUser } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AuthUser) => void;
  promptMessage?: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  promptMessage = null,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Status feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Clear inputs and errors when modal is opened
  React.useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setLoginPassword('');
      setRegPassword('');
      setRegConfirmPassword('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const usernameTrimmed = loginUsername.trim();
    if (!usernameTrimmed || !loginPassword) {
      setErrorMsg('Please enter your username/email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameTrimmed,
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Failed to authenticate. Please check credentials.');
        setLoading(false);
        return;
      }

      setSuccessMsg(data.message || 'Login successful!');
      const authenticatedUser: AuthUser = data.user;
      try {
        localStorage.setItem('amts_auth_user', JSON.stringify(authenticatedUser));
      } catch (err) {
        console.warn('Could not save to localStorage:', err);
      }

      setTimeout(() => {
        setLoading(false);
        onLoginSuccess(authenticatedUser);
      }, 500);
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg('Network error. Unable to connect to authentication service.');
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const usernameTrimmed = regUsername.trim();
    const fullNameTrimmed = regFullName.trim();
    const emailTrimmed = regEmail.trim();

    if (!usernameTrimmed) {
      setErrorMsg('Username is required.');
      return;
    }
    if (usernameTrimmed.length < 3) {
      setErrorMsg('Username must be at least 3 characters.');
      return;
    }
    if (usernameTrimmed.toLowerCase() === 'admin') {
      setErrorMsg("The username 'admin' is reserved for municipal transit administration.");
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setErrorMsg('Password must be at least 4 characters long.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameTrimmed,
          full_name: fullNameTrimmed,
          email: emailTrimmed,
          password: regPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Registration failed. Please review your details.');
        setLoading(false);
        return;
      }

      setSuccessMsg(data.message || 'Registration successful! Signing in...');
      const registeredUser: AuthUser = data.user;
      try {
        localStorage.setItem('amts_auth_user', JSON.stringify(registeredUser));
      } catch (err) {
        console.warn('Could not save to localStorage:', err);
      }

      setTimeout(() => {
        setLoading(false);
        onLoginSuccess(registeredUser);
      }, 700);
    } catch (err) {
      console.error('Registration error:', err);
      setErrorMsg('Network error. Unable to register account at this time.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="auth-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="auth-modal-header">
          <div className="auth-header-title-box">
            <div className="auth-badge-icon">
              <ShieldCheck size={22} className="text-red" />
            </div>
            <div>
              <h2 className="auth-modal-title">AMTS Portal Authentication</h2>
              <p className="auth-modal-subtitle">Ahmedabad Municipal Transport Service</p>
            </div>
          </div>
          <button
            type="button"
            className="auth-modal-close-btn"
            onClick={onClose}
            aria-label="Close authentication modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Prompt Notification Banner (e.g. Booking requirement) */}
        {promptMessage && (
          <div className="auth-prompt-banner">
            <Lock size={15} className="text-red shrink-0" />
            <span>{promptMessage}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="auth-tab-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'login'}
            className={`auth-tab-button ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('login');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
          >
            <LogIn size={16} />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'register'}
            className={`auth-tab-button ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('register');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
          >
            <UserPlus size={16} />
            <span>Create Account</span>
          </button>
        </div>

        {/* Alert Feedback Messages */}
        {errorMsg && (
          <div className="auth-alert error">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="auth-alert success">
            <CheckCircle size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* SIGN IN FORM */}
        {activeTab === 'login' && (
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="auth-field-group">
              <label className="auth-label" htmlFor="login-username">
                Username or Email
              </label>
              <div className="auth-input-wrapper">
                <User size={17} className="auth-input-icon" />
                <input
                  id="login-username"
                  type="text"
                  className="auth-input"
                  placeholder="Enter username (e.g. admin or commuter)"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-label" htmlFor="login-password">
                Password
              </label>
              <div className="auth-input-wrapper">
                <Lock size={17} className="auth-input-icon" />
                <input
                  id="login-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-pwd-toggle-btn"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to AMTS</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {activeTab === 'register' && (
          <form className="auth-form" onSubmit={handleRegisterSubmit}>
            <div className="auth-field-group">
              <label className="auth-label" htmlFor="reg-fullname">
                Full Name
              </label>
              <div className="auth-input-wrapper">
                <User size={17} className="auth-input-icon" />
                <input
                  id="reg-fullname"
                  type="text"
                  className="auth-input"
                  placeholder="e.g. Chirag Patel"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-label" htmlFor="reg-username">
                Username
              </label>
              <div className="auth-input-wrapper">
                <User size={17} className="auth-input-icon" />
                <input
                  id="reg-username"
                  type="text"
                  className="auth-input"
                  placeholder="Choose a unique username"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-label" htmlFor="reg-email">
                Email Address <span className="auth-optional">(Optional)</span>
              </label>
              <div className="auth-input-wrapper">
                <Mail size={17} className="auth-input-icon" />
                <input
                  id="reg-email"
                  type="email"
                  className="auth-input"
                  placeholder="e.g. chirag@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-label" htmlFor="reg-password">
                Password
              </label>
              <div className="auth-input-wrapper">
                <Lock size={17} className="auth-input-icon" />
                <input
                  id="reg-password"
                  type={showRegPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Minimum 4 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-pwd-toggle-btn"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                >
                  {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-label" htmlFor="reg-confirm-password">
                Confirm Password
              </label>
              <div className="auth-input-wrapper">
                <Lock size={17} className="auth-input-icon" />
                <input
                  id="reg-confirm-password"
                  type={showRegPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Re-enter password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-btn register"
              disabled={loading}
            >
              {loading ? (
                <span>Registering Account...</span>
              ) : (
                <>
                  <span>Create Passenger Account</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
