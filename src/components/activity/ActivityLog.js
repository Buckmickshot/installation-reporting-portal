// Data log: every change recorded by the database's audit triggers, with exactly
// where the changed record lives (schema.table + id) so it can be shown in Supabase.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../relationship/supabaseConfig';
import { useAuth } from '../../contexts/AuthProvider';
import AppHeader from '../layout/AppHeader';
import { permissions } from '../../utils/roles';
import { formatDate } from '../../utils/jobStatus';
import '../../styles/portal.css';

const PK = {
  'snapshot.companies': 'company_id',
  'snapshot.company_versions': 'company_version_id',
  'snapshot.profiles': 'user_id',
  'snapshot.installation': 'installation_id',
  'snapshot.premises': 'premises_id',
  'snapshot.consumer_records': 'consumer_id',
  'snapshot.job_evidence': 'evidence_id',
  'snapshot.decommissioning': 'decom_id',
  'snapshot.building_documents': 'building_documents_id',
  'auth.users': 'id',
  'auth.mfa_factors': 'id',
};

const LOCATIONS = [
  ['auth.users', 'Sign-in accounts', 'Authentication → Users'],
  ['auth.mfa_factors', 'Two-factor', 'Authentication → Users → (user) → MFA factors'],
  ['snapshot.profiles', 'User profiles', 'Table Editor → snapshot → profiles'],
  ['snapshot.companies', 'Companies', 'Table Editor → snapshot → companies'],
  ['snapshot.company_versions', 'Company details', 'Table Editor → snapshot → company_versions'],
  ['snapshot.installation', 'Jobs', 'Table Editor → snapshot → installation'],
  ['snapshot.premises', 'Premises', 'Table Editor → snapshot → premises'],
  ['snapshot.consumer_records', 'Customers (encrypted)', 'Table Editor → snapshot → consumer_records'],
  ['snapshot.job_evidence', 'Photos & signatures', 'Table Editor → snapshot → job_evidence  (files: Storage → uploads)'],
  ['snapshot.decommissioning', 'Decommissioned units', 'Table Editor → snapshot → decommissioning'],
  ['snapshot.building_documents', 'Building documents', 'Table Editor → snapshot → building_documents'],
];
const WHERE = Object.fromEntries(LOCATIONS.map(([k, label, path]) => [k, { label, path }]));

export const sqlFor = (location, id) => `select * from ${location} where ${PK[location] || 'id'} = '${id}';`;

const fmt = v => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

function Copy({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn small ghost" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ }
    }}>{done ? 'Copied' : 'Copy SQL'}</button>
  );
}

function Changes({ entry }) {
  const rows = Object.entries(entry.changes || {});
  if (!rows.length) return <p className="sub">No field-level details.</p>;
  const isDiff = rows.some(([, v]) => v && typeof v === 'object' && ('old' in v || 'new' in v));
  return (
    <table className="audit-diff">
      <thead><tr><th>Field</th>{isDiff ? <><th>Before</th><th>After</th></> : <th>Value</th>}</tr></thead>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td className="mono">{k}</td>
            {v && typeof v === 'object' && ('old' in v || 'new' in v)
              ? <><td className="old">{fmt(v.old)}</td><td className="new">{fmt(v.new)}</td></>
              : isDiff ? <td colSpan={2}>{fmt(v)}</td> : <td>{fmt(v)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A list of audit entries. Used on this page and on a job's page. */
export function AuditEntries({ entries, names = {}, compact = false }) {
  const [open, setOpen] = useState(null);
  if (!entries.length) return <p className="empty">Nothing recorded yet.</p>;
  return (
    <ul className={`audit-list ${compact ? 'compact' : ''}`}>
      {entries.map(e => {
        const where = WHERE[e.location];
        const isOpen = open === e.audit_id;
        return (
          <li key={e.audit_id} className={isOpen ? 'open' : ''}>
            <button className="audit-row" onClick={() => setOpen(isOpen ? null : e.audit_id)} aria-expanded={isOpen}>
              <span className="audit-when">{formatDate(e.at, true)}</span>
              <span className="audit-what">
                <b>{e.action}</b>
                <span className="sub"> · {where?.label || e.location}{e.summary && !compact ? ` · ${e.summary}` : ''}</span>
              </span>
              <span className="audit-who">{names[e.actor] || (e.actor ? 'User' : 'System')}</span>
              <span className="audit-caret" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
            </button>
            {isOpen && (
              <div className="audit-detail">
                <Changes entry={e} />
                <div className="audit-where">
                  <div>
                    <div className="sub">Stored in</div>
                    <div className="mono">{e.location}{e.record_id ? ` · ${PK[e.location] || 'id'} = ${e.record_id}` : ''}</div>
                    {where && <div className="sub">Supabase: {where.path}</div>}
                  </div>
                  {e.record_id && (
                    <div className="audit-sql">
                      <code>{sqlFor(e.location, e.record_id)}</code>
                      <Copy text={sqlFor(e.location, e.record_id)} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export async function actorNames(entries) {
  const ids = [...new Set(entries.map(e => e.actor).filter(Boolean))];
  if (!ids.length) return {};
  const { data } = await supabase.from('profiles').select('user_id, name').in('user_id', ids);
  return Object.fromEntries((data || []).map(p => [p.user_id, p.name]));
}

export default function ActivityLog() {
  const { profile } = useAuth();
  const can = permissions(profile);
  const [params, setParams] = useSearchParams();
  const [entries, setEntries] = useState(null);
  const [names, setNames] = useState({});
  const [companies, setCompanies] = useState([]);
  const [q, setQ] = useState(params.get('q') || '');
  const [signIns, setSignIns] = useState(false);
  const location = params.get('in') || '';
  const company = params.get('company') || '';
  const record = params.get('record') || '';

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    let query = supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(300);
    if (location) query = query.eq('location', location);
    if (company) query = query.eq('company_id', company);
    if (record) query = query.eq('record_id', record);
    const { data } = await query;
    setEntries(data || []);
    setNames(await actorNames(data || []));
  }, [location, company, record]);
  useEffect(() => { if (can.viewAudit) load(); }, [can.viewAudit, load]);
  useEffect(() => {
    if (!can.isGlobal) return;
    supabase.from('current_company_versions').select('company_id, name').order('name').then(({ data }) => setCompanies(data || []));
  }, [can.isGlobal]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!entries) return [];
    const base = signIns ? entries : entries.filter(e => e.action !== 'signed in');
    if (!s) return base;
    return base.filter(e => [e.action, e.summary, e.location, e.record_id, names[e.actor], JSON.stringify(e.changes)]
      .filter(Boolean).some(v => v.toLowerCase().includes(s)));
  }, [entries, q, names, signIns]);

  if (profile && !can.viewAudit) return <Navigate to="/" replace />;

  return (
    <div className="portal">
      <AppHeader />
      <main className="page">
        <div className="page-title">
          <h1>Data log</h1>
          <div className="actions"><button className="btn" onClick={load}>↻ Refresh</button></div>
        </div>
        <p className="sub" style={{ marginTop: -8, marginBottom: 16 }}>
          Every change is written here automatically by the database. Open an entry to see what changed and exactly where it is stored.
        </p>
        <div className="card">
          <div className="filters">
            <input type="search" placeholder="Search action, email, field, ID…" value={q} onChange={e => setQ(e.target.value)} />
            <select value={location} onChange={e => setParam('in', e.target.value)} aria-label="Where">
              <option value="">Everywhere</option>
              {LOCATIONS.map(([k, label]) => <option key={k} value={k}>{label} ({k})</option>)}
            </select>
            {can.isGlobal && (
              <select value={company} onChange={e => setParam('company', e.target.value)} aria-label="Company">
                <option value="">All companies</option>
                {companies.map(c => <option key={c.company_id} value={c.company_id}>{c.name}</option>)}
              </select>
            )}
            <label className="audit-toggle"><input type="checkbox" checked={signIns} onChange={e => setSignIns(e.target.checked)} /> Show sign-ins</label>
            {record && <button className="btn small" onClick={() => setParam('record', '')}>Record {record.slice(0, 8)}… ×</button>}
          </div>
          {!entries ? <p className="empty">Loading…</p> : <AuditEntries entries={shown} names={names} />}
        </div>
      </main>
    </div>
  );
}
