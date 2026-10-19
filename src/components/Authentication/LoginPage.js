import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthProvider';
import { supabase } from '../../relationship/supabaseConfig';
import { appUrl } from '../../config/env';
import '../../styles/portal.css';

const MESSAGES = {
  'company-inactive': 'Your company is inactive. Please contact support if this is incorrect.',
  'user-inactive': 'Your account is inactive. Please contact your admin.',
  'profile-fetch-failed': 'Your account has no staff profile yet. Ask your admin to finish setting it up.',
  'invalid-credentials': 'Invalid email or password.',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, signIn, authError, mfaPending, verifyMfa, sendEmailCode, verifyEmailCode, signOut } = useAuth();
  const [mode, setMode] = useState('password'); // password | email-code
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/');
    else if (!loading && authError && MESSAGES[authError]) setError(MESSAGES[authError]);
  }, [user, loading, navigate, authError]);

  const run = async fn => {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = e => {
    e.preventDefault();
    run(async () => {
      const { error: err } = await signIn(email, password);
      if (err && err !== 'mfa-required') setError(MESSAGES[err] || 'Sign-in failed.');
    });
  };

  const submitMfa = e => {
    e.preventDefault();
    run(async () => {
      const { error: err } = await verifyMfa(code.trim());
      if (err) setError(MESSAGES[err] || err);
      setCode('');
    });
  };

  const requestCode = e => {
    e.preventDefault();
    run(async () => {
      const { error: err } = await sendEmailCode(email);
      if (err) return setError(err.message);
      setCodeSent(true);
      setInfo(`We emailed a 6-digit code to ${email}. It expires in 1 hour.`);
    });
  };

  const submitEmailCode = e => {
    e.preventDefault();
    run(async () => {
      const { error: err } = await verifyEmailCode(email, code.trim());
      if (err && err !== 'mfa-required') setError(MESSAGES[err] || 'That code is not valid or has expired.');
      setCode('');
    });
  };

  const forgot = () =>
    run(async () => {
      if (!email) return setError('Enter your email above first.');
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl('/auth/callback') });
      if (err) setError(err.message);
      else setInfo(`If ${email} has an account, a reset link is on its way.`);
    });

  if (loading) return <div className="login-shell"><p className="sub">Loading…</p></div>;

  if (mfaPending) {
    return (
      <div className="login-shell">
        <form className="login-card" onSubmit={submitMfa}>
          <div className="lock-badge" aria-hidden>🔐</div>
          <h1>Two-factor authentication</h1>
          <p className="sub">Enter the 6-digit code from your authenticator app.</p>
          <label>
            Authentication code
            <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} autoFocus
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} required />
          </label>
          {error && <div className="error" role="alert">{error}</div>}
          <button type="submit" className="btn primary" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify'}</button>
          <button type="button" className="linklike" onClick={() => signOut()}>Use a different account</button>
        </form>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1>VEU Installation Portal</h1>
        <p className="sub">Staff sign in</p>
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={mode === 'password'} className={mode === 'password' ? 'on' : ''}
            onClick={() => { setMode('password'); setError(''); setInfo(''); }}>Password</button>
          <button role="tab" aria-selected={mode === 'email-code'} className={mode === 'email-code' ? 'on' : ''}
            onClick={() => { setMode('email-code'); setError(''); setInfo(''); setCodeSent(false); }}>Email code</button>
        </div>

        {mode === 'password' ? (
          <form onSubmit={submitPassword}>
            <label>
              Email
              <input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
            </label>
            {error && <div className="error" role="alert">{error}</div>}
            {info && <div className="sub" role="status">{info}</div>}
            <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <button type="button" className="linklike" onClick={forgot}>Forgot password?</button>
          </form>
        ) : (
          <form onSubmit={codeSent ? submitEmailCode : requestCode}>
            <label>
              Email
              <input type="email" autoComplete="username" value={email} disabled={codeSent} onChange={e => setEmail(e.target.value)} required />
            </label>
            {codeSent && (
              <label>
                6-digit code
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
                  value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} required />
              </label>
            )}
            {error && <div className="error" role="alert">{error}</div>}
            {info && <div className="sub" role="status">{info}</div>}
            <button type="submit" className="btn primary" disabled={busy || (codeSent && code.length !== 6)}>
              {busy ? 'Please wait…' : codeSent ? 'Verify code' : 'Email me a code'}
            </button>
            {codeSent && <button type="button" className="linklike" onClick={() => { setCodeSent(false); setCode(''); setInfo(''); }}>Use a different email</button>}
          </form>
        )}
        <p className="sub" style={{ marginTop: 18, fontSize: '.75rem' }}>
          🔒 Protected by TLS, row-level security and optional two-factor authentication.
        </p>
      </div>
    </div>
  );
}
