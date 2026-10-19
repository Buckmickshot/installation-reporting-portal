import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../relationship/supabaseConfig';
import { AuthShell, PasswordInput, PasswordRules, TextInput, Alert } from '../auth/AuthUi';
import { isStrongPassword, authErrorMessage } from '../../utils/passwordPolicy';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [state, setState] = useState('checking'); // checking | ready | invalid
  const [needsCode, setNeedsCode] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setState('invalid');
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      setNeedsCode(aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2');
      setState('ready');
    })();
  }, []);

  const mismatch = touched && confirm && password !== confirm ? 'Passwords don’t match.' : '';

  const submit = async e => {
    e.preventDefault();
    setTouched(true);
    setError('');
    if (!isStrongPassword(password)) return setError('Your password doesn’t meet the requirements below.');
    if (password !== confirm) return;
    setBusy(true);
    try {
      if (needsCode) {
        // accounts with two-factor must confirm it before changing their password
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const factor = factors?.totp?.find(f => f.status === 'verified');
        const { error: mfaErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
        if (mfaErr) throw new Error('That authentication code isn’t valid. Try again.');
        setNeedsCode(false);
      }
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw new Error(authErrorMessage(err));
      await supabase.auth.signOut();
      navigate('/login', { replace: true, state: { notice: 'Your password has been updated. Sign in with your new password.' } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'checking') return <AuthShell><p className="auth-sub">Checking your reset link…</p></AuthShell>;

  if (state === 'invalid') {
    return (
      <AuthShell>
        <h1>Link expired</h1>
        <p className="auth-sub">This password reset link is invalid or has expired. Reset links can only be used once and expire after 1 hour.</p>
        <Link className="auth-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }} to="/forgot-password">
          Request a new link
        </Link>
        <div className="auth-center"><Link className="auth-link auth-back" to="/login">← Back to sign in</Link></div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={submit} noValidate>
        <h1>Set a new password</h1>
        <p className="auth-sub">Choose a strong password you haven’t used before.</p>
        {error && <Alert>{error}</Alert>}
        <PasswordInput label="New password" autoComplete="new-password" autoFocus value={password} onChange={e => setPassword(e.target.value)} />
        <PasswordRules password={password} />
        <PasswordInput label="Confirm new password" autoComplete="new-password" value={confirm}
          onChange={e => setConfirm(e.target.value)} onBlur={() => setTouched(true)} error={mismatch} />
        {needsCode && (
          <TextInput label="Authentication code" hint="Your account uses two-factor authentication. Enter the 6-digit code from your authenticator app."
            inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="auth-otp" value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
        )}
        <button className="auth-btn" disabled={busy || !password || !confirm || (needsCode && code.length !== 6)}>
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  );
}
