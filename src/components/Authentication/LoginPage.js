import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthProvider';
import { supabase } from '../../relationship/supabaseConfig';
import '../../styles/portal.css';

const MESSAGES = {
  'company-inactive': 'Your company is inactive. Please contact support if this is incorrect.',
  'user-inactive': 'Your account is inactive. Please contact your admin.',
  'profile-fetch-failed': 'Your account has no staff profile yet. Ask your admin to finish setting it up.',
  'unexpected-error': 'Unexpected error. Please try again.',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, signIn, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/');
    else if (!loading && authError && MESSAGES[authError]) setError(MESSAGES[authError]);
  }, [user, loading, navigate, authError]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    const { error: err } = await signIn(email, password);
    setBusy(false);
    if (err) setError(MESSAGES[err] || 'Invalid email or password.');
  };

  const forgot = async () => {
    setError('');
    if (!email) return setError('Enter your email above first.');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (err) setError(err.message);
    else setInfo(`If ${email} has an account, a reset link is on its way.`);
  };

  if (loading) return <div className="login-shell"><p className="sub">Loading…</p></div>;

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>VEU Installation Portal</h1>
        <p className="sub">Staff sign in</p>
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
    </div>
  );
}
