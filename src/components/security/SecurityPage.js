// Security centre: two-factor authentication setup and a live view of how
// the portal protects data (encryption, access control, auditing).
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../relationship/supabaseConfig';
import { useAuth } from '../../contexts/AuthProvider';
import AppHeader from '../layout/AppHeader';
import '../../styles/portal.css';

function MfaCard() {
  const [factors, setFactors] = useState([]);
  const [enrolling, setEnrolling] = useState(null); // { id, qr, secret }
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const verified = factors.filter(f => f.status === 'verified');

  const start = async () => {
    setMsg('');
    setBusy(true);
    // clean up abandoned, unverified enrolments first
    for (const f of factors.filter(x => x.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toLocaleDateString('en-AU')}` });
    setBusy(false);
    if (error) return setMsg(error.message);
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const confirm = async e => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code: code.trim() });
    setBusy(false);
    if (error) return setMsg('That code did not match. Check your phone’s clock and try again.');
    setEnrolling(null);
    setCode('');
    setMsg('Two-factor authentication is on. You will be asked for a code each time you sign in.');
    load();
  };

  const remove = async f => {
    if (!window.confirm('Turn off two-factor authentication for your account?')) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) return setMsg(error.message);
    setMsg('Two-factor authentication turned off.');
    load();
  };

  return (
    <section className="card">
      <h2>Two-factor authentication (MFA)</h2>
      <p className="sub" style={{ marginTop: -6 }}>
        Adds a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) to every sign-in.
        Once it is on, the database itself refuses to return data until the code has been entered.
      </p>
      {verified.length > 0 ? (
        <div className="banner good">✅ On — {verified.map(f => f.friendly_name || 'Authenticator app').join(', ')}</div>
      ) : (
        <div className="banner warn">Off — strongly recommended for admins.</div>
      )}

      {enrolling ? (
        <form onSubmit={confirm}>
          <ol className="steps">
            <li>Open your authenticator app and scan this QR code:</li>
          </ol>
          <img src={enrolling.qr} alt="QR code for authenticator app" width={180} height={180} style={{ background: '#fff', padding: 6, borderRadius: 6 }} />
          <p className="sub">Can’t scan? Enter this key: <span className="mono">{enrolling.secret}</span></p>
          <ol className="steps" start={2}><li>Enter the 6-digit code it shows:</li></ol>
          <div className="capture-row">
            <input className="input" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
            <button className="btn primary" disabled={busy || code.length !== 6}>Turn on</button>
            <button type="button" className="btn ghost" onClick={() => setEnrolling(null)}>Cancel</button>
          </div>
        </form>
      ) : verified.length ? (
        verified.map(f => <button key={f.id} className="btn danger small" onClick={() => remove(f)}>Turn off</button>)
      ) : (
        <button className="btn primary" onClick={start} disabled={busy}>Set up authenticator app</button>
      )}
      {msg && <p className="sub" role="status" style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  );
}

function Fact({ icon, title, children }) {
  return (
    <div className="sec-fact">
      <div className="sec-icon" aria-hidden>{icon}</div>
      <div><b>{title}</b><div className="sub">{children}</div></div>
    </div>
  );
}

export default function SecurityPage() {
  const { profile } = useAuth();
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.rpc('fn_security_overview').then(({ data, error }) => (error ? setErr(error.message) : setInfo(data)));
  }, []);

  const role = profile?.is_global_admin ? 'Global admin' : profile?.is_admin ? 'Company admin' : 'Staff';

  return (
    <div className="portal">
      <AppHeader />
      <main className="page">
        <div className="page-title"><h1>Security</h1></div>
        <div className="grid-2">
          <div>
            <MfaCard />
            <section className="card">
              <h2>How your data is protected</h2>
              {err && <div className="banner danger">{err}</div>}
              {!info && !err && <p className="sub">Loading…</p>}
              {info && (
                <div className="sec-facts">
                  <Fact icon="🔑" title="Customer details encrypted at rest">
                    Phone numbers and emails are stored as {info.cipher} ciphertext. Key: {info.key_store}.
                    {' '}{info.encrypted_customers} customer record{info.encrypted_customers === 1 ? '' : 's'} encrypted in your company.
                  </Fact>
                  {info.ciphertext_sample && (
                    <div className="cipher">
                      <div className="sub">What is actually stored in the database for a customer phone number:</div>
                      <code>{info.ciphertext_sample.match(/.{1,8}/g).join(' ')}…</code>
                    </div>
                  )}
                  <Fact icon="🛡️" title="Row-level security on every table">
                    {info.rls_tables} of {info.all_tables} tables enforce per-company access in Postgres itself — even a modified browser
                    cannot read another company’s jobs. Your role: <b>{role}</b>.
                  </Fact>
                  <Fact icon="🔒" title="Passwords">
                    Stored as {info.password_hashing} hashes by Supabase Auth — never in plain text, never visible to admins.
                  </Fact>
                  <Fact icon="📱" title="Two-factor authentication">
                    {info.mfa_factors > 0
                      ? `Enabled on your account. This session is verified at level ${info.session_aal.toUpperCase()}.`
                      : 'Not enabled on your account yet — set it up above.'}
                  </Fact>
                  <Fact icon="✉️" title="Email verification">
                    New accounts must confirm their email before first sign-in; staff can also sign in with a one-time email code.
                  </Fact>
                  <Fact icon="🧾" title="Audit trail">
                    {info.audit_events} recorded events (status changes, allocations, evidence, notes) — append-only for staff.
                  </Fact>
                  <Fact icon="🌐" title="Encryption in transit">{info.transport}.</Fact>
                </div>
              )}
            </section>
          </div>
          <div>
            <section className="card">
              <h2>Permission levels</h2>
              <table className="jobs">
                <thead><tr><th>Can…</th><th>Staff</th><th>Admin</th><th>Global</th></tr></thead>
                <tbody>
                  {[
                    ['Create & edit own company’s jobs', 1, 1, 1],
                    ['Capture photos & signatures', 1, 1, 1],
                    ['Send a job for review', 1, 1, 1],
                    ['Allocate installers', 0, 1, 1],
                    ['Request info / submit / approve', 0, 1, 1],
                    ['Edit a submitted job', 0, 1, 1],
                    ['Manage users in company', 0, 1, 1],
                    ['See every company', 0, 0, 1],
                    ['Create companies', 0, 0, 1],
                  ].map(([label, ...v]) => (
                    <tr key={label}><td>{label}</td>{v.map((x, i) => <td key={i}>{x ? '✓' : '—'}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
