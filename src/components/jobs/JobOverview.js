// One page per job: status & actions, compliance checklist, allocation,
// field evidence, and an audit timeline with notes / requests for information.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../relationship/supabaseConfig';
import { useAuth } from '../../contexts/AuthProvider';
import { useFormData } from '../../contexts/FormDataContext';
import { LoadInstallation, wizardPath } from '../homeScreen/LoadInstallation';
import AppHeader from '../layout/AppHeader';
import EvidencePanel from './EvidencePanel';
import { readinessChecklist } from '../../utils/readiness';
import { STATUS_BY_VALUE, statusLabel, availableActions, isEditable, formatDate } from '../../utils/jobStatus';
import { buildAssignmentFormPdf, downloadBytes } from '../../forms/assignmentFormPdf';
import '../../styles/portal.css';

export function useJob(id) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { formData, updateFormData, resetFormData } = useFormData();
  const [job, setJob] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);

  const loadEvidence = useCallback(async () => {
    const { data } = await supabase.from('job_evidence').select('*').eq('installation_id', id).order('captured_at');
    setEvidence(data || []);
  }, [id]);

  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from('job_events')
      .select('*')
      .eq('installation_id', id)
      .order('created_at', { ascending: false });
    setEvents(data || []);
  }, [id]);

  const loadJob = useCallback(async () => {
    const { data, error: err } = await supabase.from('installation_overview').select('*').eq('installation_id', id).maybeSingle();
    if (err || !data) {
      setError(err?.message || 'Job not found, or you do not have access to it.');
      return;
    }
    setJob(data);
  }, [id]);

  const reloadAll = useCallback(async () => {
    resetFormData();
    try {
      await LoadInstallation(id, updateFormData, signOut, navigate);
    } catch (e) {
      setError(e.message);
      return;
    }
    await Promise.all([loadJob(), loadEvidence(), loadEvents()]);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  return { job, formData, evidence, events, error, reloadAll, loadJob, loadEvidence, loadEvents };
}

export default function JobOverview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { job, formData, evidence, events, error, reloadAll, loadJob, loadEvidence, loadEvents } = useJob(id);

  const [pending, setPending] = useState(null); // action awaiting a message
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [team, setTeam] = useState([]);
  const [exporting, setExporting] = useState(false);

  const isAdmin = !!(profile?.is_global_admin || (profile?.is_admin && job && profile.company_id === job.company_id));
  const checklist = useMemo(() => readinessChecklist(formData, evidence), [formData, evidence]);
  const editable = job ? isEditable(job.status, isAdmin) : false;

  useEffect(() => {
    if (!job || !isAdmin) return;
    supabase
      .from('profiles')
      .select('user_id, name, email, active')
      .eq('company_id', job.company_id)
      .eq('active', true)
      .order('name')
      .then(({ data }) => setTeam(data || []));
  }, [job, isAdmin]);

  if (error) {
    return (
      <div className="portal">
        <AppHeader />
        <main className="page"><div className="banner danger">{error}</div><Link className="btn" to="/">Back to jobs</Link></main>
      </div>
    );
  }
  if (!job) {
    return <div className="portal"><AppHeader /><main className="page"><p className="empty">Loading job…</p></main></div>;
  }

  const exportPdf = async (jobRow = job) => {
    setExporting(true);
    try {
      const bytes = await buildAssignmentFormPdf({ job: jobRow, formData, evidence });
      downloadBytes(bytes, `${jobRow.job_ref}-VEEC-assignment-form.pdf`);
    } catch (e) {
      console.error(e);
      alert('Could not create the PDF: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  const runAction = async (action, msg) => {
    setBusy(true);
    const { error: err } = await supabase.rpc('fn_set_job_status', { _installation: id, _status: action.to, _message: msg || null });
    setBusy(false);
    if (err) return alert(err.message);
    setPending(null);
    setMessage('');
    await Promise.all([loadJob(), loadEvents()]);
    if (action.to === 'submitted') exportPdf({ ...job, status: 'submitted' });
  };

  const onAction = action => {
    if (action.requiresReady && !checklist.ready) {
      const go = window.confirm(
        `${checklist.total - checklist.done} compliance item(s) are still outstanding.\n\n` +
          (isAdmin ? 'Continue anyway?' : 'Please complete them before sending for review.')
      );
      if (!go || !isAdmin) return;
    }
    if (action.needsMessage) {
      setPending(action);
      return;
    }
    runAction(action);
  };

  const revert = async () => {
    if (!window.confirm('Undo the last status change on this job? This is recorded in the audit trail.')) return;
    setBusy(true);
    const { error: err } = await supabase.rpc('fn_revert_job_status', { _installation: id, _message: null });
    setBusy(false);
    if (err) return alert(err.message);
    await Promise.all([loadJob(), loadEvents()]);
  };

  const assign = async userId => {
    const { error: err } = await supabase.rpc('fn_assign_job', { _installation: id, _assignee: userId || null });
    if (err) return alert(err.message);
    await Promise.all([loadJob(), loadEvents()]);
  };

  const addNote = async () => {
    if (!note.trim()) return;
    const { error: err } = await supabase.from('job_events').insert({ installation_id: id, event_type: 'note', message: note.trim(), actor: user.id });
    if (err) return alert(err.message);
    setNote('');
    loadEvents();
  };

  const deleteJob = async () => {
    if (!window.confirm(`Delete ${job.job_ref}? This permanently removes the draft and its customer/premises drafts.`)) return;
    const { error: err } = await supabase.rpc('fn_delete_installation', { _installation: id });
    if (err) return alert(err.message);
    navigate('/');
  };

  const tone = STATUS_BY_VALUE[job.status]?.tone;
  const actions = availableActions(job.status, isAdmin);
  const groups = [...new Set(checklist.items.map(i => i.group))];
  const actorName = uid => team.find(t => t.user_id === uid)?.name || (uid === user.id ? 'You' : null);

  return (
    <div className="portal">
      <AppHeader />
      <main className="page">
        <p style={{ margin: '0 0 8px' }}><Link to="/" className="sub">← All jobs</Link></p>
        <div className="page-title">
          <h1 className="mono" style={{ fontSize: '1.3rem' }}>{job.job_ref}</h1>
          <span className={`pill ${tone}`}>{statusLabel(job.status)}</span>
          <div className="actions">
            <button className="btn" onClick={() => exportPdf()} disabled={exporting}>{exporting ? 'Creating PDF…' : '📄 Export assignment form'}</button>
            <Link className="btn" to={`/jobs/${id}/field`}>📱 Field mode</Link>
            <Link className="btn" to={wizardPath(job)}>{editable ? 'Edit job form' : 'View job form'}</Link>
            {['draft', 'cancelled'].includes(job.status) && (isAdmin || job.user_id === user.id) && (
              <button className="btn danger" onClick={deleteJob}>Delete</button>
            )}
          </div>
        </div>

        {job.status === 'rfi' && job.last_rfi_message && (
          <div className="banner warn"><b>Information requested:</b> {job.last_rfi_message}</div>
        )}
        {!editable && <div className="banner info">This job has been submitted and is locked. An admin can still make corrections.</div>}

        <div className="grid-2">
          <div>
            <section className="card">
              <h2>Job details</h2>
              <dl className="facts">
                <div><dt>Customer</dt><dd>{job.customer_name || '—'}</dd></div>
                <div><dt>Phone / email</dt><dd>{[job.customer_phone, job.customer_email].filter(Boolean).join(' · ') || '—'}</dd></div>
                <div><dt>Installation address</dt><dd>{job.full_address || '—'}</dd></div>
                <div><dt>Activity</dt><dd>{(job.activity_type || '').replace('activity-', 'Activity ')} · {job.premises_type || '—'}</dd></div>
                <div><dt>Installation date</dt><dd>{formatDate(job.installation_date)}</dd></div>
                <div><dt>Products</dt><dd>{(formData.installedProducts || []).filter(p => p.brand || p.model).map(p => `${p.brand} ${p.model}${p.serialNo ? ` (S/N ${p.serialNo})` : ''}`).join(', ') || '—'}</dd></div>
                {profile?.is_global_admin && <div><dt>Company</dt><dd>{job.company_name}</dd></div>}
                <div><dt>Created</dt><dd>{formatDate(job.created_at, true)}{job.created_by_name ? ` by ${job.created_by_name}` : ''}</dd></div>
              </dl>
            </section>

            <section className="card">
              <h2>Photos &amp; signatures</h2>
              <EvidencePanel installationId={id} evidence={evidence} editable={editable} onChanged={() => { loadEvidence(); loadEvents(); loadJob(); }} />
            </section>

            <section className="card">
              <h2>Activity</h2>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <textarea className="input" rows={2} placeholder="Add a note for the team…" value={note} onChange={e => setNote(e.target.value)} />
                <button className="btn" onClick={addNote} disabled={!note.trim()}>Add</button>
              </div>
              <ul className="timeline">
                {events.map(ev => (
                  <li key={ev.event_id} className={ev.to_status === 'rfi' ? 'rfi' : ev.event_type}>
                    <div className="when">{formatDate(ev.created_at, true)}{actorName(ev.actor) ? ` · ${actorName(ev.actor)}` : ''}</div>
                    <div>
                      {ev.event_type === 'status_change'
                        ? <>Status: {statusLabel(ev.from_status)} → <b>{statusLabel(ev.to_status)}</b></>
                        : ev.event_type === 'note' ? <b>Note</b> : ev.event_type === 'created' ? 'Job created' : null}
                    </div>
                    {ev.message && ev.event_type !== 'created' && <div className="msg">{ev.message}</div>}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div>
            <section className="card">
              <h2>Next step</h2>
              {actions.length === 0 && <p className="sub">No actions available.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {actions.map(a => (
                  <button key={a.to + a.label} className={`btn ${a.kind}`} disabled={busy} onClick={() => onAction(a)}>
                    {a.label}
                  </button>
                ))}
              </div>
              {isAdmin && job.status !== 'draft' && events.some(e => e.event_type === 'status_change') && (
                <div className="demo-note">
                  <button className="btn small" disabled={busy} onClick={revert}>↩ Revert last status change</button>
                  <div style={{ marginTop: 4 }}>Admins only · for corrections and demos · logged in the activity trail.</div>
                </div>
              )}
              {pending && (
                <div style={{ marginTop: 12 }}>
                  <textarea className="input" rows={3} autoFocus
                    placeholder={pending.to === 'rfi' ? 'What information is needed?' : 'Reason (optional)'}
                    value={message} onChange={e => setMessage(e.target.value)} />
                  <div className="capture-row" style={{ marginTop: 6 }}>
                    <button className="btn small ghost" onClick={() => setPending(null)}>Cancel</button>
                    <button className={`btn small ${pending.kind === 'danger' ? 'danger' : 'primary'}`}
                      disabled={busy || (pending.to === 'rfi' && !message.trim())}
                      onClick={() => runAction(pending, message)}>
                      {pending.label}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="card">
              <h2>Compliance checklist</h2>
              <div className="sub">{checklist.done} of {checklist.total} complete</div>
              <div className="progress"><span style={{ width: `${(checklist.done / checklist.total) * 100}%` }} /></div>
              {groups.map(g => (
                <div key={g} className="check-group">
                  <h3>{g}</h3>
                  {checklist.items.filter(i => i.group === g).map(i => (
                    <div key={i.label} className={`check ${i.ok ? 'ok' : 'no'}`}>
                      <span className="dot">{i.ok ? '✓' : ''}</span>
                      <span>{i.label}</span>
                    </div>
                  ))}
                </div>
              ))}
            </section>

            <section className="card">
              <h2>Allocated installer</h2>
              {isAdmin ? (
                <select className="input" style={{ width: '100%' }} value={job.assigned_to || ''} onChange={e => assign(e.target.value)}>
                  <option value="">Unassigned</option>
                  {team.map(t => <option key={t.user_id} value={t.user_id}>{t.name || t.email}</option>)}
                </select>
              ) : (
                <p>{job.assigned_to_name || 'Unassigned'}</p>
              )}
              <button className="btn small ghost" style={{ marginTop: 8 }} onClick={reloadAll}>↻ Refresh</button>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
