// Jobs dashboard: pipeline counts, search/filter, allocation view and CSV export.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../relationship/supabaseConfig';
import { useAuth } from '../../contexts/AuthProvider';
import { useFormData } from '../../contexts/FormDataContext';
import { safeQuery } from '../Authentication/SafeQuery';
import AppHeader from '../layout/AppHeader';
import { STATUSES, STATUS_BY_VALUE, statusLabel, formatDate } from '../../utils/jobStatus';
import { toCsv, downloadCsv } from '../../utils/csv';
import '../../styles/portal.css';

const OPEN_STATUSES = ['draft', 'rfi', 'ready_for_review', 'submitted', 'approved'];

export default function HomeScreen() {
  const navigate = useNavigate();
  const { user, profile, company, signOut } = useAuth();
  const { updateFormData, resetFormData } = useFormData();
  const isGlobal = !!profile?.is_global_admin;

  const [jobs, setJobs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('open');
  const [query, setQuery] = useState('');
  const [assignee, setAssignee] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [newJobCompany, setNewJobCompany] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [jobsRes, coRes] = await Promise.all([
      safeQuery(
        () => supabase.from('installation_overview').select('*').order('updated_at', { ascending: false }).limit(1000),
        { signOut, navigate }
      ),
      isGlobal
        ? supabase.from('current_company_versions').select('company_id, name, company_active').order('name')
        : Promise.resolve({ data: [] }),
    ]);
    if (!jobsRes.error) setJobs(jobsRes.data || []);
    setCompanies(coRes.data || []);
    setLoading(false);
  }, [isGlobal, signOut, navigate]);

  useEffect(() => {
    if (!user) return;
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, load]);

  const scoped = useMemo(
    () => (companyFilter === 'all' ? jobs : jobs.filter(j => j.company_id === companyFilter)),
    [jobs, companyFilter]
  );

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map(s => [s.value, 0]));
    scoped.forEach(j => (c[j.status] = (c[j.status] || 0) + 1));
    c.open = scoped.filter(j => OPEN_STATUSES.includes(j.status)).length;
    return c;
  }, [scoped]);

  const assignees = useMemo(() => {
    const m = new Map();
    scoped.forEach(j => j.assigned_to && m.set(j.assigned_to, j.assigned_to_name || 'Unnamed'));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [scoped]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter(j => {
      if (status === 'open' && !OPEN_STATUSES.includes(j.status)) return false;
      if (status !== 'open' && status !== 'all' && j.status !== status) return false;
      if (assignee === 'me' && j.assigned_to !== user.id && j.user_id !== user.id) return false;
      if (assignee === 'none' && j.assigned_to) return false;
      if (!['all', 'me', 'none'].includes(assignee) && j.assigned_to !== assignee) return false;
      if (!q) return true;
      return [j.job_ref, j.customer_name, j.full_address, j.customer_phone, j.customer_email, j.company_name]
        .filter(Boolean)
        .some(v => v.toLowerCase().includes(q));
    });
  }, [scoped, status, assignee, query, user]);

  const startJob = () => {
    const cid = isGlobal ? newJobCompany : company?.company_id;
    if (!cid) return alert('Choose which company this job is for.');
    resetFormData();
    updateFormData({ companyId: cid });
    navigate('/choose-installation-type');
  };

  const exportCsv = () => {
    const csv = toCsv(visible, [
      { key: 'job_ref', label: 'Job ref' },
      ...(isGlobal ? [{ key: 'company_name', label: 'Company' }] : []),
      { label: 'Status', get: r => statusLabel(r.status) },
      { key: 'activity_type', label: 'Activity' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'customer_phone', label: 'Phone' },
      { key: 'customer_email', label: 'Email' },
      { key: 'full_address', label: 'Installation address' },
      { key: 'premises_type', label: 'Premises type' },
      { key: 'installation_date', label: 'Installation date' },
      { key: 'product_count', label: 'Products' },
      { key: 'evidence_count', label: 'Evidence items' },
      { key: 'assigned_to_name', label: 'Assigned to' },
      { key: 'created_by_name', label: 'Created by' },
      { label: 'Created', get: r => r.created_at?.slice(0, 10) },
      { label: 'Submitted', get: r => r.submitted_at?.slice(0, 10) },
      { label: 'Approved', get: r => r.approved_at?.slice(0, 10) },
    ]);
    downloadCsv(`veu-jobs-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const tiles = [
    { value: 'open', label: 'Open jobs' },
    { value: 'draft', label: 'Drafts' },
    { value: 'rfi', label: 'Info requested' },
    { value: 'ready_for_review', label: 'Ready for review' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'approved', label: 'Approved' },
    { value: 'paid', label: 'Paid' },
  ];

  return (
    <div className="portal">
      <AppHeader />
      <main className="page">
        <div className="page-title">
          <h1>Jobs</h1>
          <div className="actions">
            {isGlobal && (
              <select className="input" value={newJobCompany} onChange={e => setNewJobCompany(e.target.value)} aria-label="Company for new job">
                <option value="">New job for…</option>
                {companies.filter(c => c.company_active).map(c => (
                  <option key={c.company_id} value={c.company_id}>{c.name}</option>
                ))}
              </select>
            )}
            <button className="btn" onClick={exportCsv} disabled={!visible.length}>Export CSV</button>
            <button className="btn primary" onClick={startJob} disabled={isGlobal && !newJobCompany}>+ New job</button>
          </div>
        </div>

        <div className="kpis">
          {tiles.map(t => (
            <button key={t.value} className={`kpi ${status === t.value ? 'active' : ''}`} onClick={() => setStatus(t.value)}>
              <div className="n">{counts[t.value] ?? 0}</div>
              <div className="l">{t.label}</div>
            </button>
          ))}
        </div>

        <div className="card">
          <div className="filters">
            <input type="search" placeholder="Search job ref, customer, address, phone…" value={query} onChange={e => setQuery(e.target.value)} />
            <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
              <option value="open">All open</option>
              <option value="all">Everything</option>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={assignee} onChange={e => setAssignee(e.target.value)} aria-label="Assigned to">
              <option value="all">Anyone</option>
              <option value="me">Mine (created or assigned)</option>
              <option value="none">Unassigned</option>
              {assignees.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            {isGlobal && (
              <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} aria-label="Company">
                <option value="all">All companies</option>
                {companies.map(c => <option key={c.company_id} value={c.company_id}>{c.name}</option>)}
              </select>
            )}
          </div>

          {loading ? (
            <p className="empty">Loading jobs…</p>
          ) : visible.length === 0 ? (
            <p className="empty">{jobs.length ? 'No jobs match these filters.' : 'No jobs yet — create the first one.'}</p>
          ) : (
            <div className="table-wrap">
              <table className="jobs">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Customer &amp; address</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Evidence</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(j => (
                    <tr key={j.installation_id} className="row" onClick={() => navigate(`/jobs/${j.installation_id}`)}>
                      <td>
                        <div className="mono">{j.job_ref}</div>
                        <div className="sub">{isGlobal ? j.company_name : (j.premises_type || '').replace('-', ' ')}</div>
                      </td>
                      <td>
                        <div>{j.customer_name || <span className="sub">No customer yet</span>}</div>
                        <div className="sub">{j.full_address || 'No address yet'}</div>
                      </td>
                      <td>
                        <span className={`pill ${STATUS_BY_VALUE[j.status]?.tone}`}>{statusLabel(j.status)}</span>
                        {j.status === 'rfi' && j.last_rfi_message && <div className="sub" style={{ maxWidth: 220 }}>“{j.last_rfi_message}”</div>}
                      </td>
                      <td>{j.assigned_to_name || <span className="sub">—</span>}</td>
                      <td className="sub">{j.product_count} product{j.product_count === 1 ? '' : 's'} · {j.evidence_count} item{j.evidence_count === 1 ? '' : 's'}</td>
                      <td className="sub">{formatDate(j.updated_at, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
