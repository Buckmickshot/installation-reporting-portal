// Start a new job: (global admins) choose the company, then the activity and premises type.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../relationship/supabaseConfig';
import { useAuth } from '../../contexts/AuthProvider';
import { useFormData } from '../../contexts/FormDataContext';
import { safeQuery } from '../Authentication/SafeQuery';
import AppHeader from '../layout/AppHeader';
import '../../styles/portal.css';

const Icon = {
  aircon: (
    <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
      <rect x="4" y="10" width="40" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M10 20h28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M14 32c0 3-2 4-2 7M24 32c0 3-2 4-2 7M34 32c0 3-2 4-2 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  house: (
    <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
      <path d="M6 22 24 7l18 15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 19v21h26V19" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="20" y="28" width="8" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
      <rect x="9" y="6" width="22" height="36" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M31 18h9v24h-9" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M15 13h4M23 13h2M15 20h4M23 20h2M15 27h4M23 27h2M15 34h4M23 34h2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
};

const PREMISES = [
  { value: 'residential', label: 'Residential', icon: Icon.house, desc: 'Houses, units and apartments. Exports the ESC Activity 6 residential assignment form.' },
  { value: 'non-residential', label: 'Non-residential', icon: Icon.building, desc: 'Shops, offices and other business premises.' },
];

function Choice({ on, onClick, icon, title, desc, badge }) {
  return (
    <button type="button" className={`choice ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      {icon && <span className="choice-icon">{icon}</span>}
      <span className="choice-text">
        <b>{title}{badge && <span className="pill info" style={{ marginLeft: 8 }}>{badge}</span>}</b>
        {desc && <small>{desc}</small>}
      </span>
      <span className="choice-tick" aria-hidden="true">{on ? '✓' : ''}</span>
    </button>
  );
}

export default function NewJobPage() {
  const navigate = useNavigate();
  const { profile, company, signOut } = useAuth();
  const { resetFormData, updateFormData } = useFormData();
  const isGlobal = !!profile?.is_global_admin;
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(isGlobal ? '' : company?.company_id);
  const [premises, setPremises] = useState('residential');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!isGlobal) return;
    supabase.from('current_company_versions').select('company_id, name, address, company_active').eq('company_active', true).order('name')
      .then(({ data }) => setCompanies(data || []));
  }, [isGlobal]);

  const create = async () => {
    if (!companyId) return setErr('Choose which company this job is for.');
    setErr('');
    setBusy(true);
    resetFormData();
    const { data: row, error } = await safeQuery(
      () => supabase.rpc('fn_create_installation_with_premises', { _company: companyId, _activity_type: 'activity-6', _prem_type: premises }).single(),
      { signOut, navigate }
    );
    if (error || !row) {
      setBusy(false);
      return setErr(error?.message || 'Could not create the job.');
    }
    const { data: created } = await supabase.from('installation').select('job_number, status').eq('installation_id', row.installation_id).single();
    updateFormData({
      companyId,
      installationId: row.installation_id,
      premisesId: row.premises_id,
      activityType: 'activity-6',
      premisesType: premises,
      status: created?.status || 'draft',
      jobRef: created ? `VEU-${String(created.job_number).padStart(6, '0')}` : null,
    });
    navigate(`/create-job/activity-6/${premises}/customer?job=${row.installation_id}`);
  };

  const step = n => <span className="step-no">{n}</span>;
  let n = 1;

  return (
    <div className="portal">
      <AppHeader />
      <main className="page narrow">
        <nav className="crumbs"><Link to="/">Jobs</Link><span>/</span>New job</nav>
        <div className="page-title"><h1>New job</h1></div>

        {isGlobal && (
          <section className="card pick">
            <h2>{step(n++)}Company</h2>
            <p className="sub">Which installer company is this job for?</p>
            <div className="choice-grid">
              {companies.map(c => (
                <Choice key={c.company_id} on={companyId === c.company_id} onClick={() => setCompanyId(c.company_id)}
                  icon={<span className="co-avatar">{c.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>}
                  title={c.name} desc={c.address} />
              ))}
            </div>
          </section>
        )}

        <section className="card pick">
          <h2>{step(n++)}Activity</h2>
          <div className="choice-grid one">
            <Choice on icon={Icon.aircon} title="Activity 6 — High-efficiency air conditioner"
              desc="Install a high-efficiency space heating/cooling product, with or without decommissioning an existing unit." />
          </div>
        </section>

        <section className="card pick">
          <h2>{step(n++)}Premises type</h2>
          <div className="choice-grid">
            {PREMISES.map(p => (
              <Choice key={p.value} on={premises === p.value} onClick={() => setPremises(p.value)} icon={p.icon} title={p.label} desc={p.desc} />
            ))}
          </div>
        </section>

        {err && <div className="banner danger">{err}</div>}
        <div className="form-actions">
          <Link to="/" className="btn ghost">Cancel</Link>
          <button className="btn primary lg" onClick={create} disabled={busy || !companyId}>
            {busy ? 'Creating…' : 'Create job and add customer →'}
          </button>
        </div>
      </main>
    </div>
  );
}
