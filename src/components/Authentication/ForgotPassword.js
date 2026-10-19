import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../relationship/supabaseConfig';
import { appUrl } from '../../config/env';
import { AuthShell, TextInput, Alert } from '../auth/AuthUi';
import { isEmail, authErrorMessage } from '../../utils/passwordPolicy';

const RESEND_SECONDS = 60;

export default function ForgotPassword() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [touched, setTouched] = useState(false);
  const [sentTo, setSentTo] = useState(null);
  const [error, setError] = useState(location.state?.error || '');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return undefined;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const emailError = touched && !isEmail(email) ? (email ? 'Enter a valid email address.' : 'Enter your email address.') : '';

  const send = async e => {
    e?.preventDefault();
    setTouched(true);
    setError('');
    if (!isEmail(email)) return;
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl('/auth/callback') });
    setBusy(false);
    if (err) return setError(authErrorMessage(err));
    setSentTo(email.trim());
    setCooldown(RESEND_SECONDS);
  };

  if (sentTo) {
    return (
      <AuthShell>
        <div className="auth-center">
          <div className="auth-icon-circle" aria-hidden="true">✉</div>
          <h1>Check your email</h1>
          <p className="auth-sub">
            If an account exists for <b>{sentTo}</b>, you’ll receive an email with a link to reset your password.
            The link expires in 1 hour.
          </p>
        </div>
        {error && <Alert>{error}</Alert>}
        <p className="auth-hint auth-center" style={{ marginBottom: 14 }}>
          Didn’t get the email? Check your spam folder, or
        </p>
        <button className="auth-btn secondary" onClick={send} disabled={busy || cooldown > 0}>
          {cooldown > 0 ? `Resend email in ${cooldown}s` : busy ? 'Sending…' : 'Resend email'}
        </button>
        <div className="auth-center">
          <Link className="auth-link auth-back" to="/login">← Back to sign in</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={send} noValidate>
        <h1>Reset your password</h1>
        <p className="auth-sub">Enter the email address associated with your account and we’ll send you a link to reset your password.</p>
        {error && <Alert>{error}</Alert>}
        <TextInput label="Email address" type="email" autoComplete="username" autoFocus value={email}
          onChange={e => setEmail(e.target.value)} onBlur={() => setTouched(true)} error={emailError} />
        <button className="auth-btn" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        <div className="auth-center">
          <Link className="auth-link auth-back" to="/login">← Back to sign in</Link>
        </div>
      </form>
    </AuthShell>
  );
}
