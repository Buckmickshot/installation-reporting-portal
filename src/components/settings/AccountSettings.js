// Account settings: profile, password, two-factor authentication, data protection.
import React, { useCallback, useEffect, useState } from 'react';
import { supabase, createEphemeralClient } from '../../relationship/supabaseConfig';
import { useAuth } from '../../contexts/AuthProvider';
import AppHeader from '../layout/AppHeader';
import { PasswordInput, PasswordRules } from '../auth/AuthUi';
import { isStrongPassword, authErrorMessage } from '../../utils/passwordPolicy';
import { isValidPhone } from '../../utils/Enforce';
import '../../styles/portal.css';
import '../../styles/auth.css';

function Section({ title, description, children }) {
  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <h2>{title}</h2>
        {description && <p className="sub">{description}</p>}
      </div>
      <div className="settings-section-body">{children}</div>
    </section>
  );
}

function Status({ msg }) {
  if (!msg) return null;
  return <div className={`banner ${msg.kind === 'error' ? 'danger' : 'good'}`} role="status">{msg.text}</div>;
}

function ProfileForm() {
  const { profile, user } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const dirty = name !== (profile?.name || '') || phone !== (profile?.phone || '');

  const save = async e => {
    e.preventDefault();
    setMsg(null);
    if (!name.trim()) return setMsg({ kind: 'error', text: 'Name is required.' });
    if (phone && !isValidPhone(phone)) return setMsg({ kind: 'error', text: 'Enter a valid Australian phone number.' });
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ name: name.trim(), phone: phone.trim() || null }).eq('user_id', user.id);
    setBusy(false);
    setMsg(error ? { kind: 'error', text: error.message } : { kind: 'ok', text: 'Profile saved.' });
  };

  return (
    <form onSubmit={save} className="settings-form">
      <Status msg={msg} />
      <label className="settings-label">Full name<input className="input" value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="settings-label">Email address
        <input className="input" value={user?.email || ''} disabled />
        <span className="sub">Contact an administrator to change your sign-in email.</span>
      </label>
      <label className="settings-label">Mobile number<input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="04xx xxx xxx" /></label>
      <div><button className="btn primary" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</button></div>
    </form>
  );
}

function PasswordForm() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async e => {
    e.preventDefault();
    setMsg(null);
    if (!isStrongPassword(next)) return setMsg({ kind: 'error', text: 'Your new password doesn’t meet the requirements.' });
    if (next !== confirm) return setMsg({ kind: 'error', text: 'New passwords don’t match.' });
    setBusy(true);
    try {
      // confirm the current password without disturbing this session
      const { error: checkErr } = await createEphemeralClient().auth.signInWithPassword({ email: user.email, password: current });
      if (checkErr) throw new Error('Your current password is incorrect.');
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw new Error(authErrorMessage(error));
      setCurrent(''); setNext(''); setConfirm('');
      setMsg({ kind: 'ok', text: 'Password updated.' });
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="settings-form auth-like">
      <Status msg={msg} />
      <PasswordInput label="Current password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
      <PasswordInput label="New password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} />
      <PasswordRules password={next} />
      <PasswordInput label="Confirm new password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)}
        error={confirm && next !== confirm ? 'Passwords don’t match.' : ''} />
      <div><button className="btn primary" disabled={busy || !current || !next || !confirm}>{busy ? 'Updating…' : 'Update password'}</button></div>
    </form>
  );
}

function TwoFactor() {
  const [factors, setFactors] = useState([]);
  const [enrolling, setEnrolling] = useState(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  const verified = factors.filter(f => f.status === 'verified');

  const start = async () => {
    setMsg(null);
    setBusy(true);
    for (const f of factors.filter(x => x.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator app ${Date.now().toString(36)}` });
    setBusy(false);
    if (error) return setMsg({ kind: 'error', text: error.message });
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const confirm = async e => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code: code.trim() });
    setBusy(false);
    if (error) return setMsg({ kind: 'error', text: 'That code isn’t valid. Check your authenticator app and try again.' });
    setEnrolling(null);
    setCode('');
    setMsg({ kind: 'ok', text: 'Two-factor authentication is on. You’ll be asked for a code each time you sign in.' });
    load();
  };

  const remove = async f => {
    if (!window.confirm('Turn off two-factor authentication? Your account will be protected by your password only.')) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) return setMsg({ kind: 'error', text: error.message });
    setMsg({ kind: 'ok', text: 'Two-factor authentication turned off.' });
    load();
  };

  return (
    <div className="settings-form">
      <Status msg={msg} />
      <div className="mfa-row">
        <div>
          <b>Authenticator app</b>
          <div className="sub">Use Google Authenticator, Microsoft Authenticator, 1Password or similar to get sign-in codes.</div>
        </div>
        <span className={`pill ${verified.length ? 'good' : 'neutral'}`}>{verified.length ? 'On' : 'Off'}</span>
      </div>
      {enrolling ? (
        <form onSubmit={confirm} className="mfa-enrol">
          <img src={enrolling.qr} alt="QR code to scan with your authenticator app" width={168} height={168} />
          <div>
            <ol className="steps">
              <li>Scan the QR code with your authenticator app.</li>
              <li>Can’t scan it? Enter this key instead: <span className="mono">{enrolling.secret}</span></li>
              <li>Enter the 6-digit code the app shows.</li>
            </ol>
            <div className="capture-row">
              <input className="input auth-otp" style={{ width: 150 }} inputMode="numeric" maxLength={6} autoComplete="one-time-code"
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" aria-label="6-digit code" />
              <button className="btn primary" disabled={busy || code.length !== 6}>Verify and turn on</button>
              <button type="button" className="btn ghost" onClick={() => setEnrolling(null)}>Cancel</button>
            </div>
          </div>
        </form>
      ) : verified.length ? (
        <div><button className="btn danger" onClick={() => remove(verified[0])}>Turn off</button></div>
      ) : (
        <div><button className="btn primary" onClick={start} disabled={busy}>Set up authenticator app</button></div>
      )}
    </div>
  );
}

function DataProtection() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    supabase.rpc('fn_security_overview').then(({ data }) => setInfo(data || null));
  }, []);
  if (!info) return <p className="sub">Loading…</p>;
  return (
    <details className="protect">
      <summary>How your data is protected</summary>
      <ul>
        <li><b>Encrypted at rest.</b> Customer phone numbers and emails are stored as AES-256 ciphertext; the key is held in Supabase Vault and never reaches the browser.
          {info.ciphertext_sample && <code className="cipher-inline">{info.ciphertext_sample.slice(0, 48)}…</code>}</li>
        <li><b>Company isolation.</b> Row-level security on {info.rls_tables} of {info.all_tables} tables — each company can only ever read its own jobs.</li>
        <li><b>Passwords</b> are stored as {info.password_hashing} hashes and are never visible to anyone, including administrators.</li>
        <li><b>Two-factor</b> {info.mfa_factors > 0 ? `is on for your account (this session: ${String(info.session_aal).toUpperCase()}).` : 'is available above.'}</li>
        <li><b>Audit trail.</b> {info.audit_events} recorded job events (status changes, allocations, evidence, notes).</li>
        <li><b>In transit.</b> {info.transport}.</li>
      </ul>
    </details>
  );
}

export default function AccountSettings() {
  return (
    <div className="portal">
      <AppHeader />
      <main className="page settings-page">
        <div className="page-title"><h1>Settings</h1></div>
        <Section title="Profile" description="Your name and contact details as shown to your team."><ProfileForm /></Section>
        <Section title="Password" description="Use a strong password you don’t use anywhere else."><PasswordForm /></Section>
        <Section title="Two-factor authentication" description="Require a code from your phone in addition to your password when signing in."><TwoFactor /></Section>
        <Section title="Security & privacy"><DataProtection /></Section>
      </main>
    </div>
  );
}
