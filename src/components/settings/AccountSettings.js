// Account settings: profile, password, two-factor authentication, data protection.
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../relationship/supabaseConfig';
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

const maskEmail = e => (e || '').replace(/^(.)(.*)(@.*)$/, (m, a, mid, d) => a + '•'.repeat(Math.min(mid.length, 6)) + d);

/** Change password: prove it's you (authenticator code, or a code emailed to you), then set a new one. */
function PasswordForm() {
  const { user } = useAuth();
  const [step, setStep] = useState('idle'); // idle | verify | new | done
  const [method, setMethod] = useState(null); // 'totp' | 'email'
  const [factor, setFactor] = useState(null);
  const [emailSent, setEmailSent] = useState(false);
  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setStep('idle'); setMethod(null); setEmailSent(false); setCode(''); setNext(''); setConfirm(''); };

  const start = async () => {
    setMsg(null);
    const { data } = await supabase.auth.mfa.listFactors();
    const f = (data?.totp || []).find(x => x.status === 'verified');
    setFactor(f || null);
    setMethod(f ? 'totp' : 'email');
    setStep('verify');
  };

  const sendEmail = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.reauthenticate();
    setBusy(false);
    if (error) return setMsg({ kind: 'error', text: authErrorMessage(error) });
    setEmailSent(true);
    setMsg({ kind: 'ok', text: `We sent a 6-digit code to ${maskEmail(user?.email)}. It expires in 15 minutes.` });
  };

  const verify = async e => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (method === 'totp') {
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
        if (error) throw new Error('That code isn’t valid. Check your authenticator app and try again.');
      } else {
        const { data, error } = await supabase.rpc('fn_check_reauth_code', { _code: code.trim() });
        if (error || !data) throw new Error('That code is incorrect or has expired. Check the email or send a new code.');
      }
      setStep('new');
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const save = async e => {
    e.preventDefault();
    setMsg(null);
    if (!isStrongPassword(next)) return setMsg({ kind: 'error', text: 'Your new password doesn’t meet the requirements.' });
    if (next !== confirm) return setMsg({ kind: 'error', text: 'New passwords don’t match.' });
    setBusy(true);
    const { error } = await supabase.rpc('fn_change_password', { _password: next, _code: method === 'email' ? code.trim() : null });
    setBusy(false);
    if (error) {
      const text = (error.message || '').replace(/^.*?exception:\s*/i, '');
      if (/verify|code/i.test(text)) { setStep('verify'); setCode(''); }
      return setMsg({ kind: 'error', text });
    }
    reset();
    setStep('done');
    setMsg({ kind: 'ok', text: 'Password changed. Any other devices have been signed out.' });
  };

  if (step === 'idle' || step === 'done') {
    return (
      <div className="settings-form">
        <Status msg={msg} />
        <div className="mfa-row">
          <div><b>Password</b><div className="sub">You’ll confirm it’s you with a code before choosing a new password.</div></div>
        </div>
        <div><button className="btn primary" onClick={start}>Change password</button></div>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <form onSubmit={verify} className="settings-form auth-like">
        <Status msg={msg} />
        <div className="pw-step"><span className="step-no">1</span><b>Confirm it’s you</b></div>
        {method === 'totp' ? (
          <p className="sub" style={{ margin: 0 }}>Enter the 6-digit code from your authenticator app.</p>
        ) : emailSent ? (
          <p className="sub" style={{ margin: 0 }}>Enter the 6-digit code we emailed to {maskEmail(user?.email)}.</p>
        ) : (
          <p className="sub" style={{ margin: 0 }}>We’ll email a 6-digit code to {maskEmail(user?.email)}.</p>
        )}
        {(method === 'totp' || emailSent) && (
          <input className="input auth-otp" inputMode="numeric" maxLength={6} autoComplete="one-time-code" autoFocus
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" aria-label="6-digit code" />
        )}
        <div className="capture-row">
          {method === 'email' && !emailSent
            ? <button type="button" className="btn primary" onClick={sendEmail} disabled={busy}>{busy ? 'Sending…' : 'Email me a code'}</button>
            : <button className="btn primary" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Continue'}</button>}
          <button type="button" className="btn ghost" onClick={() => { reset(); setMsg(null); }}>Cancel</button>
        </div>
        {method === 'totp' && <button type="button" className="linklike" onClick={() => { setMethod('email'); setCode(''); setMsg(null); }}>Can’t use your app? Email me a code instead</button>}
        {method === 'email' && emailSent && <button type="button" className="linklike" onClick={sendEmail} disabled={busy}>Send a new code</button>}
        {method === 'email' && factor && <button type="button" className="linklike" onClick={() => { setMethod('totp'); setCode(''); setMsg(null); }}>Use my authenticator app instead</button>}
      </form>
    );
  }

  return (
    <form onSubmit={save} className="settings-form auth-like">
      <Status msg={msg} />
      <div className="pw-step"><span className="step-no done">✓</span><b>Verified</b><span className="step-no">2</span><b>Choose a new password</b></div>
      <PasswordInput label="New password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} autoFocus />
      <PasswordRules password={next} />
      <PasswordInput label="Confirm new password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)}
        error={confirm && next !== confirm ? 'Passwords don’t match.' : ''} />
      <div className="capture-row">
        <button className="btn primary" disabled={busy || !next || !confirm}>{busy ? 'Saving…' : 'Change password'}</button>
        <button type="button" className="btn ghost" onClick={() => { reset(); setMsg(null); }}>Cancel</button>
      </div>
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
