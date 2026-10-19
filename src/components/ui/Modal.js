// Accessible dialog + dropdown menu used across the portal.
import React, { useEffect, useRef, useState } from 'react';

export function Modal({ title, subtitle, onClose, children, footer, width = 520 }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="ui-overlay" onMouseDown={e => e.target === e.currentTarget && onClose?.()}>
      <div className="ui-dialog" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: width }}>
        <div className="ui-dialog-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="sub">{subtitle}</p>}
          </div>
          <button className="ui-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="ui-dialog-body">{children}</div>
        {footer && <div className="ui-dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Button that opens a small menu of actions. items: [{ label, hint, onClick, danger, disabled }] */
export function MenuButton({ label, items, className = 'btn', align = 'right', disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = e => !ref.current?.contains(e.target) && setOpen(false);
    const esc = e => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="ui-menu-wrap" ref={ref}>
      <button className={className} onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} disabled={disabled}>
        {label} <span className="ui-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className={`ui-menu ${align}`} role="menu">
          {items.filter(Boolean).map(it => (
            <button key={it.label} role="menuitem" className={`ui-menu-item ${it.danger ? 'danger' : ''}`} disabled={it.disabled}
              onClick={() => { setOpen(false); it.onClick(); }}>
              <span>{it.label}</span>
              {it.hint && <small>{it.hint}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <label className={`ui-field ${error ? 'has-error' : ''}`}>
      <span className="ui-label">{label}</span>
      {children}
      {error ? <span className="ui-error">{error}</span> : hint ? <span className="ui-hint">{hint}</span> : null}
    </label>
  );
}

export function Toast({ msg, onDone }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  if (!msg) return null;
  return <div className={`ui-toast ${msg.kind || ''}`} role="status">{msg.text}</div>;
}
