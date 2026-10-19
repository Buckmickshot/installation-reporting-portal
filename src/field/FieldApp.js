// ASAP Field — the installer app. Mobile-first, installable to the home screen.
// Installers see the jobs allocated to them, capture the Activity 6 photo evidence,
// serial numbers, install details and signatures on site, then send the job for review.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../relationship/supabaseConfig';
import { useAuth } from '../contexts/AuthProvider';
import { addEvidence } from '../components/jobs/EvidencePanel';
import SignaturePad from '../components/jobs/SignaturePad';
import { statusLabel, STATUS_BY_VALUE, formatDate } from '../utils/jobStatus';
import { compressImage } from './photo';
import { CONSUMER_DECLARATION, INSTALLER_DECLARATION } from '../forms/a6Text';
import { BRAND } from '../config/brand';
import './field.css';

const TODO = ['draft', 'rfi'];
const filled = v => v !== undefined && v !== null && `${v}`.trim() !== '';
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
const initials = n => (n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

/** What has to be captured on site for this job. */
function fieldSteps(fd, evidence) {
  const kinds = evidence.reduce((m, e) => ({ ...m, [e.kind]: (m[e.kind] || 0) + 1 }), {});
  const decom = (fd.decommissionedProducts || []).filter(p => filled(p.decommissionScenario) || filled(p.brand) || filled(p.model));
  const installed = (fd.installedProducts || []).filter(p => filled(p.brand) || filled(p.model));
  const needCoes = fd.COESRequired === true || decom.some(p => p.COESRequired === true);
  const photo = (kind, label, hint) => ({ type: 'photo', kind, label, hint, done: (kinds[kind] || 0) > 0, count: kinds[kind] || 0 });

  const steps = [];
  if (decom.length) {
    steps.push({ id: 'old', title: 'Old unit', subtitle: 'Before you remove anything', items: [
      photo('old_unit', 'Old unit in place', 'Show the whole unit where it is installed'),
      photo('old_unit_nameplate', 'Old unit nameplate', 'Brand, model and serial must be readable'),
    ] });
    steps.push({ id: 'removal', title: 'Removal', subtitle: 'Decommissioning evidence', items: [
      photo('decommissioned_unit', 'Removed / decommissioned unit', 'Unit removed, or rendered inoperable'),
    ] });
  }
  steps.push({ id: 'new', title: 'New unit', subtitle: 'After installation', items: [
    photo('new_indoor_unit', 'Indoor unit installed'),
    photo('new_outdoor_unit', 'Outdoor unit installed'),
    photo('new_unit_nameplate', 'New unit nameplate / serial', 'Serial number must be readable'),
    ...installed.map(p => ({ type: 'serial', index: (fd.installedProducts || []).indexOf(p), label: `Serial number — ${[p.brand, p.model].filter(Boolean).join(' ')}`, done: filled(p.serialNo) })),
  ] });
  steps.push({ id: 'details', title: 'Install details', subtitle: 'Date and compliance numbers', items: [
    { type: 'text', key: 'installationDate', label: 'Date of installation', input: 'date', done: filled(fd.installationDate) },
    { type: 'text', key: 'refrigerantHandlerLicenseNo', label: 'Refrigerant handling licence no. (ARC)', done: filled(fd.refrigerantHandlerLicenseNo) },
    ...(needCoes ? [{ type: 'text', key: 'COESNo', label: 'Certificate of Electrical Safety no.', done: filled(fd.COESNo) }] : []),
    { type: 'check', key: 'postInstallinfoGiven', label: 'Customer shown how to use the new unit and given the manual', done: fd.postInstallinfoGiven === true || fd.postInstallinfoGiven === 'yes' },
  ] });
  steps.push({ id: 'signoff', title: 'Sign-off', subtitle: 'Customer and installer signatures', items: [
    { type: 'signature', kind: 'customer_signature', label: 'Customer signature', done: !!kinds.customer_signature },
    { type: 'signature', kind: 'installer_signature', label: 'Installer signature', done: !!kinds.installer_signature },
  ] });
  steps.forEach(s => { s.done = s.items.filter(i => i.done).length; s.total = s.items.length; });
  const done = steps.reduce((a, s) => a + s.done, 0);
  const total = steps.reduce((a, s) => a + s.total, 0);
  return { steps, done, total, complete: done === total };
}

function useFieldJob(id) {
  const [state, setState] = useState({ job: null, fd: null, evidence: [], error: null });
  const load = useCallback(async () => {
    const [ov, inst, ev] = await Promise.all([
      supabase.from('installation_overview').select('*').eq('installation_id', id).maybeSingle(),
      supabase.from('installation').select('form_data, installation_date').eq('installation_id', id).maybeSingle(),
      supabase.from('job_evidence').select('*').eq('installation_id', id).order('captured_at'),
    ]);
    if (ov.error || !ov.data) return setState(s => ({ ...s, error: 'This job could not be found, or you don’t have access to it.' }));
    const fd = { ...(inst.data?.form_data || {}) };
    if (!fd.installationDate && inst.data?.installation_date) fd.installationDate = inst.data.installation_date;
    setState({ job: ov.data, fd, evidence: ev.data || [], error: null });
  }, [id]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setFd: fd => setState(s => ({ ...s, fd })) };
}

/* ---------- shell ---------- */

function useAppManifest() {
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    const theme = document.querySelector('meta[name="theme-color"]');
    const prev = [link?.getAttribute('href'), theme?.getAttribute('content'), document.title];
    link?.setAttribute('href', `${process.env.PUBLIC_URL || ''}/field-manifest.json`);
    theme?.setAttribute('content', '#1e2f40');
    document.title = 'ASAP Field';
    return () => {
      if (prev[0]) link?.setAttribute('href', prev[0]);
      if (prev[1]) theme?.setAttribute('content', prev[1]);
      document.title = prev[2];
    };
  }, []);
}

function TopBar({ title, sub, back, right }) {
  return (
    <header className="f-top">
      {back ? <Link to={back} className="f-iconbtn" aria-label="Back">←</Link> : <span className="f-logo">AR</span>}
      <div className="f-top-title"><b>{title}</b>{sub && <small>{sub}</small>}</div>
      {right}
    </header>
  );
}

function AccountMenu() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <div className="f-account">
      <button className="f-avatar" onClick={() => setOpen(o => !o)} aria-label="Account">{initials(profile?.name)}</button>
      {open && (
        <div className="f-sheet-menu" onClick={() => setOpen(false)}>
          <div className="f-menu-card" onClick={e => e.stopPropagation()}>
            <b>{profile?.name}</b>
            <small>{profile?.email}</small>
            <a href={`${process.env.PUBLIC_URL || ''}/settings`} className="f-btn ghost">Password & two-factor</a>
            <button className="f-btn ghost" onClick={async () => { await signOut(); navigate('/login', { replace: true, state: { from: '/app' } }); }}>Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- job list ---------- */

function JobCard({ j }) {
  return (
    <Link to={`/app/jobs/${j.installation_id}`} className="f-card f-job">
      <div className="f-job-top">
        <span className={`f-pill ${STATUS_BY_VALUE[j.status]?.tone}`}>{statusLabel(j.status)}</span>
        <span className="f-mono">{j.job_ref}</span>
      </div>
      <b className="f-job-name">{j.customer_name || 'No customer yet'}</b>
      <div className="f-muted">{j.full_address || 'No address yet'}</div>
      {j.status === 'rfi' && j.last_rfi_message && <div className="f-rfi">Office: “{j.last_rfi_message}”</div>}
      <div className="f-job-meta">
        <span>{j.installation_date ? `Install ${formatDate(j.installation_date)}` : 'Install date not set'}</span>
        <span>{j.evidence_count} photo{j.evidence_count === 1 ? '' : 's'}/signatures</span>
      </div>
    </Link>
  );
}

function FieldHome() {
  const { user, profile } = useAuth();
  const isAdmin = !!(profile?.is_admin || profile?.is_global_admin);
  const [jobs, setJobs] = useState(null);
  const [tab, setTab] = useState('todo');
  const [scope, setScope] = useState('mine');

  const load = useCallback(async () => {
    const { data } = await supabase.from('installation_overview').select('*').neq('status', 'cancelled').order('updated_at', { ascending: false }).limit(300);
    setJobs(data || []);
  }, []);
  useEffect(() => {
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);

  const mine = useMemo(() => (jobs || []).filter(j => scope === 'all' || j.assigned_to === user.id || (!j.assigned_to && j.user_id === user.id)), [jobs, scope, user]);
  const shown = mine.filter(j => (tab === 'todo' ? TODO.includes(j.status) : !TODO.includes(j.status)));
  const todoCount = mine.filter(j => TODO.includes(j.status)).length;
  const hour = new Date().getHours();

  return (
    <>
      <TopBar title="ASAP Field" sub={profile?.name} right={<AccountMenu />} />
      <main className="f-main">
        <h1 className="f-hello">Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, {(profile?.name || '').split(' ')[0]}</h1>
        <p className="f-muted" style={{ marginTop: -6 }}>{todoCount ? `${todoCount} job${todoCount === 1 ? '' : 's'} to complete` : 'You’re all caught up.'}</p>

        <div className="f-seg" role="tablist">
          <button role="tab" aria-selected={tab === 'todo'} className={tab === 'todo' ? 'on' : ''} onClick={() => setTab('todo')}>To do</button>
          <button role="tab" aria-selected={tab === 'sent'} className={tab === 'sent' ? 'on' : ''} onClick={() => setTab('sent')}>Sent</button>
        </div>
        {isAdmin && (
          <label className="f-toggle">
            <input type="checkbox" checked={scope === 'all'} onChange={e => setScope(e.target.checked ? 'all' : 'mine')} />
            Show all company jobs
          </label>
        )}

        {!jobs ? <p className="f-muted">Loading jobs…</p> : shown.length === 0 ? (
          <div className="f-empty">
            <b>{tab === 'todo' ? 'No jobs to do' : 'Nothing sent yet'}</b>
            <span>{tab === 'todo' ? 'Jobs allocated to you by the office appear here.' : 'Jobs you send for review appear here.'}</span>
          </div>
        ) : shown.map(j => <JobCard key={j.installation_id} j={j} />)}
      </main>
    </>
  );
}

/* ---------- job capture ---------- */

function PhotoItem({ item, jobId, evidence, editable, onChange }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const photos = evidence.filter(e => e.kind === item.kind);
  const pick = async e => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try {
      for (const f of files) await addEvidence({ installationId: jobId, kind: item.kind, file: await compressImage(f) });
      await onChange();
    } catch (err) {
      alert('Upload failed — check your signal and try again.\n\n' + err.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async ev => {
    if (!window.confirm('Delete this photo?')) return;
    const { error } = await supabase.from('job_evidence').delete().eq('evidence_id', ev.evidence_id);
    if (error) return alert(error.message);
    onChange();
  };
  return (
    <div className={`f-item ${item.done ? 'done' : ''}`}>
      <div className="f-item-head">
        <span className="f-check" aria-hidden="true">{item.done ? '✓' : ''}</span>
        <div className="f-item-text"><b>{item.label}</b>{item.hint && <small>{item.hint}</small>}</div>
      </div>
      {photos.length > 0 && (
        <div className="f-thumbs">
          {photos.map(p => (
            <div key={p.evidence_id} className="f-thumb">
              <a href={p.file_url} target="_blank" rel="noreferrer"><img src={p.file_url} alt={item.label} loading="lazy" /></a>
              <small>{formatDate(p.captured_at, true)}{p.latitude != null ? ' · 📍' : ''}</small>
              {editable && <button className="f-thumb-x" onClick={() => remove(p)} aria-label="Delete photo">×</button>}
            </div>
          ))}
        </div>
      )}
      {editable && (
        <>
          <button className={`f-btn ${photos.length ? 'ghost' : 'primary'} block`} disabled={busy} onClick={() => ref.current?.click()}>
            {busy ? 'Uploading…' : photos.length ? '+ Add another photo' : '📷 Take photo'}
          </button>
          <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
        </>
      )}
    </div>
  );
}

function SignatureItem({ item, jobId, evidence, editable, defaultName, onChange }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName || '');
  const [busy, setBusy] = useState(false);
  const sig = evidence.filter(e => e.kind === item.kind).slice(-1)[0];
  const save = async blob => {
    if (!name.trim()) return alert('Enter the name of the person signing.');
    setBusy(true);
    try {
      await addEvidence({ installationId: jobId, kind: item.kind, file: new File([blob], `${item.kind}.png`, { type: 'image/png' }), note: name.trim() });
      setOpen(false);
      await onChange();
    } catch (err) {
      alert('Could not save the signature: ' + err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`f-item ${item.done ? 'done' : ''}`}>
      <div className="f-item-head">
        <span className="f-check" aria-hidden="true">{item.done ? '✓' : ''}</span>
        <div className="f-item-text"><b>{item.label}</b>{sig && <small>Signed by {sig.note || '—'} · {formatDate(sig.captured_at, true)}</small>}</div>
      </div>
      {sig && <img className="f-sig" src={sig.file_url} alt={item.label} />}
      {editable && !open && (
        <button className={`f-btn ${sig ? 'ghost' : 'primary'} block`} onClick={() => setOpen(true)}>{sig ? 'Sign again' : '✍️ Sign now'}</button>
      )}
      {open && (
        <div className="f-sign">
          <label className="f-label">Full name of person signing
            <input className="f-input" value={name} onChange={e => setName(e.target.value)} />
          </label>
          <details className="f-decl">
            <summary>{item.kind === 'customer_signature' ? 'Customer declaration' : 'Installer declaration'} — read before signing</summary>
            <ul>
              {(item.kind === 'customer_signature' ? CONSUMER_DECLARATION(BRAND.accreditedPerson) : INSTALLER_DECLARATION).map(t => Array.isArray(t)
                ? <li key={t[0]}>{t[0]}<ul>{t.slice(1).map(x => <li key={x}>{x}</li>)}</ul></li>
                : <li key={t}>{t}</li>)}
            </ul>
          </details>
          <p className="f-muted small">Signed and dated {formatDate(new Date())}.</p>
          <SignaturePad busy={busy} onSave={save} onCancel={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

function FieldInput({ item, fd, editable, onSave }) {
  const [v, setV] = useState(fd[item.key] ?? '');
  const [saved, setSaved] = useState(false);
  useEffect(() => setV(fd[item.key] ?? ''), [fd, item.key]);
  const commit = async val => {
    if ((fd[item.key] ?? '') === val) return;
    await onSave({ [item.key]: val });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  if (item.type === 'check') {
    const on = fd[item.key] === true || fd[item.key] === 'yes';
    return (
      <label className={`f-item f-checkrow ${item.done ? 'done' : ''}`}>
        <input type="checkbox" checked={on} disabled={!editable} onChange={e => onSave({ [item.key]: e.target.checked })} />
        <span>{item.label}</span>
      </label>
    );
  }
  return (
    <div className={`f-item ${item.done ? 'done' : ''}`}>
      <label className="f-label">
        <span className="f-label-row"><span className="f-check small" aria-hidden="true">{item.done ? '✓' : ''}</span>{item.label}{saved && <em>Saved</em>}</span>
        <div className="f-inline">
          <input className="f-input" type={item.input || 'text'} value={v} disabled={!editable}
            onChange={e => setV(e.target.value)} onBlur={e => commit(e.target.value.trim())} />
          {item.input === 'date' && editable && <button className="f-btn ghost" onClick={() => { setV(todayIso()); commit(todayIso()); }}>Today</button>}
        </div>
      </label>
    </div>
  );
}

function SerialInput({ item, fd, editable, onSave }) {
  const current = (fd.installedProducts || [])[item.index]?.serialNo || '';
  const [v, setV] = useState(current);
  useEffect(() => setV(current), [current]);
  const commit = async () => {
    if (v.trim() === current) return;
    const products = (fd.installedProducts || []).map((p, i) => (i === item.index ? { ...p, serialNo: v.trim() } : p));
    await onSave({ installedProducts: products });
  };
  return (
    <div className={`f-item ${item.done ? 'done' : ''}`}>
      <label className="f-label">
        <span className="f-label-row"><span className="f-check small" aria-hidden="true">{item.done ? '✓' : ''}</span>{item.label}</span>
        <input className="f-input f-mono" value={v} disabled={!editable} onChange={e => setV(e.target.value)} onBlur={commit} placeholder="As shown on the nameplate" />
      </label>
    </div>
  );
}

function FieldJob() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const { job, fd, evidence, error, reload, setFd } = useFieldJob(id);
  const [openStep, setOpenStep] = useState(null);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');

  const plan = useMemo(() => (fd ? fieldSteps(fd, evidence) : null), [fd, evidence]);
  useEffect(() => {
    if (plan && openStep === null) setOpenStep((plan.steps.find(s => s.done < s.total) || plan.steps[0]).id);
  }, [plan, openStep]);

  if (error) return <><TopBar title="Job" back="/app" /><main className="f-main"><div className="f-banner bad">{error}</div></main></>;
  if (!job || !plan) return <><TopBar title="Loading…" back="/app" /><main className="f-main"><p className="f-muted">Loading job…</p></main></>;

  const isAdmin = !!(profile?.is_global_admin || (profile?.is_admin && profile.company_id === job.company_id));
  const editable = isAdmin || ['draft', 'rfi', 'ready_for_review'].includes(job.status);
  const canSend = ['draft', 'rfi'].includes(job.status);

  const saveFd = async patch => {
    const { data: row, error: e1 } = await supabase.from('installation').select('form_data').eq('installation_id', id).single();
    if (e1) return alert(e1.message);
    const next = { ...(row.form_data || {}), ...patch };
    const update = { form_data: next };
    if ('installationDate' in patch) update.installation_date = patch.installationDate || null;
    const { error: e2 } = await supabase.from('installation').update(update).eq('installation_id', id);
    if (e2) return alert('Could not save: ' + e2.message);
    setFd({ ...fd, ...patch });
  };

  const send = async () => {
    if (!plan.complete && !window.confirm(`${plan.total - plan.done} item(s) are still missing. Send to the office anyway?`)) return;
    setSending(true);
    const { error: err } = await supabase.rpc('fn_set_job_status', { _installation: id, _status: 'ready_for_review', _message: note.trim() || 'Sent from ASAP Field' });
    setSending(false);
    if (err) return alert(err.message);
    setNote('');
    reload();
  };

  const customerName = [fd.firstName, fd.surname].filter(Boolean).join(' ') || job.customer_name || '';
  const pct = Math.round((plan.done / plan.total) * 100);

  return (
    <>
      <TopBar title={job.customer_name || job.job_ref} sub={job.job_ref} back="/app"
        right={<span className={`f-pill ${STATUS_BY_VALUE[job.status]?.tone}`}>{statusLabel(job.status)}</span>} />
      <main className="f-main has-bar">
        <section className="f-card">
          <div className="f-addr">{job.full_address || 'No address yet'}</div>
          <div className="f-actions">
            {job.full_address && <a className="f-btn ghost" href={`https://maps.google.com/?q=${encodeURIComponent(job.full_address)}`} target="_blank" rel="noreferrer">🧭 Directions</a>}
            {job.customer_phone && <a className="f-btn ghost" href={`tel:${job.customer_phone.replace(/\s/g, '')}`}>📞 Call</a>}
          </div>
          <div className="f-progress-row"><span>{plan.done} of {plan.total} done</span><span>{pct}%</span></div>
          <div className="f-progress"><span style={{ width: `${pct}%` }} /></div>
        </section>

        {job.status === 'rfi' && job.last_rfi_message && <div className="f-banner warn"><b>The office needs more information:</b> {job.last_rfi_message}</div>}
        {!editable && <div className="f-banner info">This job has been submitted and is locked.</div>}

        {plan.steps.map((s, idx) => (
          <section key={s.id} className={`f-step ${openStep === s.id ? 'open' : ''} ${s.done === s.total ? 'complete' : ''}`}>
            <button className="f-step-head" onClick={() => setOpenStep(openStep === s.id ? '' : s.id)} aria-expanded={openStep === s.id}>
              <span className="f-step-no">{s.done === s.total ? '✓' : idx + 1}</span>
              <span className="f-step-title"><b>{s.title}</b><small>{s.subtitle}</small></span>
              <span className="f-step-count">{s.done}/{s.total}</span>
            </button>
            {openStep === s.id && (
              <div className="f-step-body">
                {s.items.map(it => {
                  const key = `${it.type}-${it.kind || it.key || it.index}`;
                  if (it.type === 'photo') return <PhotoItem key={key} item={it} jobId={id} evidence={evidence} editable={editable} onChange={reload} />;
                  if (it.type === 'signature') return <SignatureItem key={key} item={it} jobId={id} evidence={evidence} editable={editable} onChange={reload}
                    defaultName={it.kind === 'customer_signature' ? customerName : profile?.name} />;
                  if (it.type === 'serial') return <SerialInput key={key} item={it} fd={fd} editable={editable} onSave={saveFd} />;
                  return <FieldInput key={key} item={it} fd={fd} editable={editable} onSave={saveFd} />;
                })}
                {idx < plan.steps.length - 1 && <button className="f-btn ghost block" onClick={() => setOpenStep(plan.steps[idx + 1].id)}>Next: {plan.steps[idx + 1].title} →</button>}
              </div>
            )}
          </section>
        ))}

        {canSend && (
          <section className="f-card">
            <label className="f-label">Note for the office (optional)
              <textarea className="f-input" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Anything they should know?" />
            </label>
          </section>
        )}
        {(fd.installedProducts || []).every(p => !filled(p.brand) && !filled(p.model)) && (
          <p className="f-muted small" style={{ textAlign: 'center' }}>No products on this job yet — the office adds them in the job form.</p>
        )}
      </main>

      <div className="f-bar">
        {canSend ? (
          <button className={`f-btn ${plan.complete ? 'primary' : 'dark'} block lg`} disabled={sending} onClick={send}>
            {sending ? 'Sending…' : plan.complete ? 'Send to office for review' : `Send to office (${plan.total - plan.done} missing)`}
          </button>
        ) : (
          <div className="f-bar-done">
            {job.status === 'ready_for_review' ? '✓ Sent to the office — you can still add photos' : `Status: ${statusLabel(job.status)}`}
          </div>
        )}
        {job.user_id !== user.id && job.assigned_to !== user.id && <small className="f-muted">Not allocated to you</small>}
      </div>
    </>
  );
}

export default function FieldApp() {
  useAppManifest();
  return (
    <div className="field-app">
      <Routes>
        <Route index element={<FieldHome />} />
        <Route path="jobs/:id" element={<FieldJob />} />
      </Routes>
    </div>
  );
}
