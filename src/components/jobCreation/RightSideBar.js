// Suggestions from earlier jobs and the VEU product register, shown on demand:
// a small floating button (only when there is something to suggest) opens a drawer.
import React, { useEffect, useState } from 'react';
import { useSearch } from '../../contexts/SearchContext';
import { sectionsConfig } from '../../utils/SectionsConfig';
import './wizard.css';

const LABELS = {
  first_name: 'First name', last_name: 'Surname', phone_number: 'Phone', email_address: 'Email',
  full_address: 'Address', premises_type: 'Premises type', name: 'Name', company_name: 'Company',
  company_address: 'Company address', licence_number: 'Licence no.', registration_number: 'Registration no.',
};
const HIDE = /(_id|created_at|updated_at|company_id|is_draft|_enc|content_hash)$/;

function describe(rec) {
  const reg = sectionsConfig['Activity 6 Registry'].fields;
  if (rec[reg.productCategory] !== undefined) {
    const vals = Object.values(reg).map(col => rec[col]).filter(v => v !== null && v !== undefined && `${v}` !== '');
    return { title: [rec.brand || rec.Brand, rec.model || rec.Model].filter(Boolean).join(' ') || 'Registered product', lines: vals.slice(0, 6).map(String), kind: 'Product register' };
  }
  if (rec.first_name != null || rec.last_name != null) {
    return { title: [rec.first_name, rec.last_name].filter(Boolean).join(' '), lines: [rec.phone_number, rec.email_address].filter(Boolean), kind: 'Earlier customer' };
  }
  if (rec.full_address) return { title: rec.full_address, lines: [rec.premises_type].filter(Boolean), kind: 'Known address' };
  const lines = Object.entries(rec).filter(([k, v]) => !HIDE.test(k) && v !== null && `${v}` !== '' && k !== 'name')
    .map(([k, v]) => `${LABELS[k] || k}: ${v}`);
  return { title: rec.name || 'Saved details', lines, kind: 'Saved tradesperson' };
}

export default function RightSideBar({ sections, onSelect }) {
  const { getResults } = useSearch();
  const [open, setOpen] = useState(false);

  const raw = Object.values(sections || {}).flatMap(table => getResults(table) || []);
  const seen = new Set();
  const entries = [];
  for (const r of raw) {
    const key = r.first_name != null || r.last_name != null
      ? [r.first_name, r.last_name, r.phone_number, r.email_address].map(x => (x || '').trim()).join('|')
      : r.registry_id ? `registry:${r.registry_id}`
      : r.electrician_id ? `electrician:${r.electrician_id}`
      : r.plumber_id ? `plumber:${r.plumber_id}`
      : r.handler_id ? `handler:${r.handler_id}`
      : JSON.stringify(r);
    if (!seen.has(key)) { seen.add(key); entries.push(r); }
  }

  useEffect(() => {
    if (!open) return;
    const esc = e => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  if (!entries.length) return null;

  return (
    <>
      <button type="button" className="wz-suggest-fab" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.4 1 2.5h6c0-1.1.3-1.8 1-2.5A6 6 0 0 0 12 3z" /></svg>
        {entries.length} suggestion{entries.length === 1 ? '' : 's'}
      </button>
      {open && (
        <div className="wz-drawer-overlay" onMouseDown={e => e.target === e.currentTarget && setOpen(false)}>
          <aside className="wz-drawer" role="dialog" aria-label="Suggestions">
            <div className="wz-drawer-head">
              <div><b>Suggestions</b><span className="wz-muted">Matches from earlier jobs and the VEU product register</span></div>
              <button type="button" className="wz-x" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>
            <ul className="wz-suggest-list">
              {entries.map((rec, i) => {
                const d = describe(rec);
                return (
                  <li key={i}>
                    <span className="wz-suggest-kind">{d.kind}</span>
                    <b>{d.title}</b>
                    {d.lines.map(l => <span key={l} className="wz-muted">{l}</span>)}
                    <button type="button" className="wz-btn small" onClick={() => { onSelect?.(rec); setOpen(false); }}>Use these details</button>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      )}
    </>
  );
}
