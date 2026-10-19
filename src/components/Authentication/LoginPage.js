import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthProvider';
import { AuthShell, TextInput, PasswordInput, Alert } from '../auth/AuthUi';
import { isEmail } from '../../utils/passwordPolicy';

const ACCOUNT_MESSAGES = {
  'company-inactive': 'Your company’s account is inactive. Contact your administrator.',
  'user-inactive': 'Your account has been deactivated. Contact your administrator.',
  'profile-fetch-failed': 'Your account isn’t set up yet. Contact your administrator.',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signIn, authError, mfaPending, verifyMfa, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const notice = location.state?.notice;
  // a fresh notice (e.g. password updated) takes precedence over stale account errors

  useEffect(() => {
    if (!loading && user) navigate(location.state?.from || '/', { replace: true });
    else if (!loading && !notice && authError && ACCOUNT_MESSAGES[authError]) setError(ACCOUNT_MESSAGES[authError]);
  }, [user, loading, navigate, authError, location.state, notice]);

  const emailError = touched && email && !isEmail(email) ? 'Enter a valid email address.' : '';

  const submit = async e => {
    e.preventDefault();
    setTouched(true);
    setError('');
    if (!isEmail(email)) return;
    setBusy(true);
    const { error: err } = await signIn(email.trim(), password);
    setBusy(false);
    if (err && err !== 'mfa-required') setError(ACCOUNT_MESSAGES[err] || err);
  };

  const submitCode = async e => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error: err } = await verifyMfa(code.trim());
    setBusy(false);
    if (err) {
      setError(ACCOUNT_MESSAGES[err] || err);
      setCode('');
    }
  };

  if (loading) return <AuthShell><p className="auth-sub">Loading…</p></AuthShell>;

  if (mfaPending) {
    return (
      <AuthShell>
        <form onSubmit={submitCode} noValidate>
          <h1>Two-factor authentication</h1>
          <p className="auth-sub">Enter the 6-digit code from your authenticator app.</p>
          {error && <Alert>{error}</Alert>}
          <TextInput label="Authentication code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            className="auth-otp" autoFocus value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
          <button className="auth-btn" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify'}</button>
          <div className="auth-center">
            <button type="button" className="auth-link auth-back" onClick={() => signOut()}>← Back to sign in</button>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={submit} noValidate>
        <h1>Sign in</h1>
        <p className="auth-sub">Welcome back. Sign in to your staff account.</p>
        {notice && !error && <Alert kind="success">{notice}</Alert>}
        {error && <Alert>{error}</Alert>}
        <TextInput label="Email address" type="email" autoComplete="username" autoFocus value={email}
          onChange={e => setEmail(e.target.value)} onBlur={() => setTouched(true)} error={emailError} />
        <PasswordInput label="Password" autoComplete="current-password" value={password}
          onChange={e => setPassword(e.target.value)}
          right={<Link className="auth-link" to="/forgot-password" state={{ email }}>Forgot password?</Link>} />
        <button className="auth-btn" disabled={busy || !email || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthShell>
  );
}
