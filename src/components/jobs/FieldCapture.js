// Mobile-first page for installers on site: shot list with one-tap camera
// capture (timestamp + GPS recorded), serial numbers, install date and signatures.
import React, { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../relationship/supabaseConfig';
import { useAuth } from '../../contexts/AuthProvider';
import { useJob } from './JobOverview';
import EvidencePanel, { addEvidence } from './EvidencePanel';
import { readinessChecklist } from '../../utils/readiness';
import { statusLabel, STATUS_BY_VALUE, isEditable } from '../../utils/jobStatus';
import '../../styles/portal.css';

const SHOTS = [
  { kind: 'old_unit', label: 'Old unit before removal', whenDecom: true },
  { kind: 'old_unit_nameplate', label: 'Old unit nameplate', whenDecom: true },
  { kind: 'decommissioned_unit', label: 'Removed / decommissioned unit', whenDecom: true },
  { kind: 'new_indoor_unit', label: 'New indoor unit installed' },
  { kind: 'new_outdoor_unit', label: 'New outdoor unit installed' },
  { kind: 'new_unit_nameplate', label: 'New unit nameplate / serial' },
];

function ShotRow({ shot, count, installationId, onDone, disabled }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="field-shot">
      <div>
        <div className="name">{shot.label}</div>
        {count > 0 ? <div className="count">✓ {count} photo{count > 1 ? 's' : ''}</div> : <div className="sub">Not taken</div>}
      </div>
      <button className={`btn ${count ? '' : 'primary'}`} disabled={busy || disabled} onClick={() => ref.current?.click()}>
        {busy ? 'Saving…' : count ? 'Add another' : '📷 Take photo'}
      </button>
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden
        onChange={async e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          try { await addEvidence({ installationId, kind: shot.kind, file: f }); onDone(); }
          catch (err) { alert('Upload failed: ' + err.message); }
          finally { setBusy(false); }
        }} />
    </div>
  );
}

export default function FieldCapture() {
  const { id } = useParams();
  const { profile } = useAuth();
  const { job, formData, evidence, error, reloadAll, loadEvidence } = useJob(id);
  const [savingDetails, setSavingDetails] = useState(false);
  const [serials, setSerials] = useState(null);
  const [installDate, setInstallDate] = useState(null);

  const checklist = useMemo(() => readinessChecklist(formData, evidence), [formData, evidence]);
  const counts = useMemo(() => evidence.reduce((m, e) => ({ ...m, [e.kind]: (m[e.kind] || 0) + 1 }), {}), [evidence]);

  if (error) return <div className="portal field-page"><main className="page"><div className="banner danger">{error}</div></main></div>;
  if (!job) return <div className="portal field-page"><main className="page"><p className="empty">Loading…</p></main></div>;

  const isAdmin = !!(profile?.is_global_admin || (profile?.is_admin && profile.company_id === job.company_id));
  const editable = isEditable(job.status, isAdmin);
  const products = (formData.installedProducts || []).map((p, i) => ({ ...p, i })).filter(p => p.brand || p.model);
  const hasDecom = (formData.decommissionedProducts || []).some(p => p.decommissionScenario || p.brand || p.model);
  const serialValues = serials ?? Object.fromEntries(products.map(p => [p.i, p.serialNo || '']));
  const dateValue = installDate ?? (formData.installationDate || '');

  const saveDetails = async () => {
    setSavingDetails(true);
    const { data: row, error: err } = await supabase.from('installation').select('form_data').eq('installation_id', id).single();
    if (err) { setSavingDetails(false); return alert(err.message); }
    const fd = { ...(row.form_data || {}) };
    fd.installedProducts = (fd.installedProducts || formData.installedProducts || []).map((p, i) =>
      serialValues[i] !== undefined ? { ...p, serialNo: serialValues[i] } : p
    );
    fd.installationDate = dateValue || null;
    const { error: upErr } = await supabase.from('installation')
      .update({ form_data: fd, installation_date: dateValue || null }).eq('installation_id', id);
    setSavingDetails(false);
    if (upErr) return alert(upErr.message);
    setSerials(null);
    setInstallDate(null);
    reloadAll();
  };

  return (
    <div className="portal field-page">
      <header className="app-header">
        <Link to={`/jobs/${id}`} className="btn small">← Job</Link>
        <div className="brand">{job.job_ref}<small>{job.customer_name || 'No customer'}</small></div>
        <div className="spacer" />
        <span className={`pill ${STATUS_BY_VALUE[job.status]?.tone}`}>{statusLabel(job.status)}</span>
      </header>
      <main className="page">
        <section className="card">
          <div><b>{job.full_address || 'No address yet'}</b></div>
          <div className="capture-row" style={{ marginTop: 8, marginBottom: 0 }}>
            {job.full_address && <a className="btn small" href={`https://maps.google.com/?q=${encodeURIComponent(job.full_address)}`} target="_blank" rel="noreferrer">🧭 Directions</a>}
            {job.customer_phone && <a className="btn small" href={`tel:${job.customer_phone.replace(/\s/g, '')}`}>📞 Call customer</a>}
          </div>
          <div className="sub" style={{ marginTop: 10 }}>Compliance: {checklist.done}/{checklist.total} items done</div>
          <div className="progress"><span style={{ width: `${(checklist.done / checklist.total) * 100}%` }} /></div>
          {!editable && <div className="banner info" style={{ margin: 0 }}>This job is locked — it has been submitted.</div>}
        </section>

        <section className="card">
          <h2>Shot list</h2>
          {SHOTS.filter(s => !s.whenDecom || hasDecom).map(s => (
            <ShotRow key={s.kind} shot={s} count={counts[s.kind] || 0} installationId={id} disabled={!editable}
              onDone={loadEvidence} />
          ))}
        </section>

        <section className="card">
          <h2>Install details</h2>
          <label className="sub" htmlFor="install-date">Installation date</label>
          <input id="install-date" type="date" className="input" style={{ width: '100%', marginBottom: 10 }}
            value={dateValue} disabled={!editable} onChange={e => setInstallDate(e.target.value)} />
          {products.length === 0 && <p className="sub">Add products in the job form first, then record serial numbers here.</p>}
          {products.map(p => (
            <div key={p.i} style={{ marginBottom: 10 }}>
              <label className="sub" htmlFor={`sn-${p.i}`}>Serial no. — {p.brand} {p.model}</label>
              <input id={`sn-${p.i}`} className="input" style={{ width: '100%' }} value={serialValues[p.i] ?? ''} disabled={!editable}
                onChange={e => setSerials({ ...serialValues, [p.i]: e.target.value })} />
            </div>
          ))}
          <button className="btn primary" disabled={!editable || savingDetails || (serials === null && installDate === null)} onClick={saveDetails}>
            {savingDetails ? 'Saving…' : 'Save details'}
          </button>
        </section>

        <section className="card">
          <h2>Signatures &amp; all evidence</h2>
          <EvidencePanel installationId={id} evidence={evidence} editable={editable} onChanged={loadEvidence} compact />
        </section>
      </main>
    </div>
  );
}
