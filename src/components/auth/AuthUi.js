// Shared building blocks for the sign-in, forgot-password and reset-password screens.
import React, { useState } from 'react';
import { BRAND } from '../../config/brand';
import { PASSWORD_RULES } from '../../utils/passwordPolicy';
import '../../styles/auth.css';

export function AuthShell({ children }) {
  return (
    <div className="auth">
      <aside className="auth-brand" aria-hidden="true">
        <div className="auth-brand-inner">
          <div className="auth-logo">
            <span className="auth-mark">AR</span>
            <span>{BRAND.name}</span>
          </div>
          <div className="auth-pitch">
            <h2>Victorian Energy Upgrades, from site visit to VEECs.</h2>
            <ul>
              <li>Capture jobs, photos and signatures on site</li>
              <li>Built-in Activity 6 compliance checks</li>
              <li>Review, submit and track every rebate</li>
            </ul>
          </div>
          <div className="auth-foot">© {new Date().getFullYear()} {BRAND.name}</div>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-logo auth-logo-mobile">
            <span className="auth-mark">AR</span>
            <span>{BRAND.name}</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export function TextInput({ label, error, hint, right, id, ...props }) {
  const inputId = id || `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className={`auth-field ${error ? 'has-error' : ''}`}>
      <div className="auth-label-row">
        <label htmlFor={inputId}>{label}</label>
        {right}
      </div>
      <input id={inputId} aria-invalid={!!error} aria-describedby={error ? `${inputId}-err` : undefined} {...props} />
      {error ? <p className="auth-error-text" id={`${inputId}-err`}>{error}</p> : hint ? <p className="auth-hint">{hint}</p> : null}
    </div>
  );
}

export function PasswordInput({ label = 'Password', error, right, id, ...props }) {
  const [show, setShow] = useState(false);
  const inputId = id || `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className={`auth-field ${error ? 'has-error' : ''}`}>
      <div className="auth-label-row">
        <label htmlFor={inputId}>{label}</label>
        {right}
      </div>
      <div className="auth-pw">
        <input id={inputId} type={show ? 'text' : 'password'} aria-invalid={!!error} {...props} />
        <button type="button" className="auth-eye" onClick={() => setShow(s => !s)}
          aria-label={show ? 'Hide password' : 'Show password'} title={show ? 'Hide password' : 'Show password'}>
          {show ? (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M2.1 3.5 3.5 2.1l18.4 18.4-1.4 1.4-3.2-3.2A10.9 10.9 0 0 1 12 20C6.5 20 2.2 16.4 1 12c.5-1.8 1.6-3.5 3.1-4.9L2.1 3.5Zm5.4 5.4A4.5 4.5 0 0 0 15.1 16.5l-1.6-1.6a2.5 2.5 0 0 1-3.4-3.4L7.5 8.9ZM12 4c5.5 0 9.8 3.6 11 8a11.3 11.3 0 0 1-3.3 5.2l-1.4-1.4A9 9 0 0 0 20.9 12C19.8 8.6 16.2 6 12 6c-1 0-2 .2-2.9.4L7.5 4.8C8.9 4.3 10.4 4 12 4Z"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 4c5.5 0 9.8 3.6 11 8-1.2 4.4-5.5 8-11 8S2.2 16.4 1 12c1.2-4.4 5.5-8 11-8Zm0 2c-4.2 0-7.8 2.6-8.9 6 1.1 3.4 4.7 6 8.9 6s7.8-2.6 8.9-6c-1.1-3.4-4.7-6-8.9-6Zm0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"/></svg>
          )}
        </button>
      </div>
      {error && <p className="auth-error-text">{error}</p>}
    </div>
  );
}

export function PasswordRules({ password }) {
  return (
    <ul className="pw-rules" aria-label="Password requirements">
      {PASSWORD_RULES.map(r => {
        const ok = r.test(password || '');
        return (
          <li key={r.id} className={ok ? 'ok' : ''}>
            <span className="pw-dot" aria-hidden="true">{ok ? '✓' : ''}</span>
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}

export function Alert({ kind = 'error', children }) {
  return <div className={`auth-alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}
