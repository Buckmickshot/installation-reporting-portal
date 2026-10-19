// The job form's frame: header (back to job, customer, save state, Save/Delete),
// a section list with progress, the current section, and a sticky Back / Next bar.
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFormData } from '../../contexts/FormDataContext';
import { useAuth } from '../../contexts/AuthProvider';
import { save } from '../../relationship/save';
import { supabase } from '../../relationship/supabaseConfig';
import { isEditable, statusLabel } from '../../utils/jobStatus';
import ConfirmModal from './ConfirmModal';
import './wizard.css';

export const SECTIONS = [
  { path: 'customer', label: 'Customer info', hint: 'Customer, address and building age' },
  { path: 'decommission', label: 'Decommission', hint: 'The old unit being replaced' },
  { path: 'benefit', label: 'Benefit & install', hint: 'New products and sizing' },
  { path: 'worker', label: 'Workers', hint: 'Licensed tradespeople' },
  { path: 'review', label: 'Review install', hint: 'Summary, benefit and install date' },
  { path: 'postInstall', label: 'Post install', hint: 'Certificates and handover' },
  { path: 'declaration', label: 'Declaration', hint: 'Accredited person and sign-off' },
];

const filled = v => v !== undefined && v !== null && `${v}`.trim() !== '';

/** 'done' | 'partial' | 'todo' for each section, from the answers so far. */
export function sectionStatus(fd) {
  const score = checks => {
    const n = checks.filter(Boolean).length;
    return n === checks.length ? 'done' : n > 0 ? 'partial' : 'todo';
  };
  const installed = (fd.installedProducts || []).filter(p => filled(p.brand) || filled(p.model));
  const decom = (fd.decommissionedProducts || []).filter(p => filled(p.decommissionScenario) || filled(p.brand) || filled(p.model));
  const coes = fd.COESRequired === true || decom.some(p => p.COESRequired === true);
  return {
    customer: score([filled(fd.firstName), filled(fd.surname), filled(fd.clientPhone), filled(fd.email), filled(fd.installationAddress), fd.buildingAgeCheck === true || fd.buildingAgeCheck === false]),
    decommission: decom.length ? score(decom.map(p => filled(p.decommissionScenario))) : 'todo',
    benefit: installed.length ? score(installed.flatMap(p => [filled(p.brand), filled(p.model), filled(p.productCategory)])) : 'todo',
    worker: score([filled(fd.licencedPlumberName), filled(fd.licencedPlumberLicenseNo), filled(fd.electricianName), filled(fd.electricianLicenseNo), filled(fd.refrigerantHandlerName), filled(fd.refrigerantHandlerLicenseNo)]),
    review: score([filled(fd.installationDate), filled(fd.typeOfBenefit), fd.installerTasksDone === true]),
    postInstall: score([fd.postInstallinfoGiven === true || fd.postInstallinfoGiven === 'yes',
      ...(coes ? [filled(fd.COESNo) || filled(fd.coesCertificateNumber)] : [])]),
    declaration: score([filled(fd.accredittedPerson)]),
  };
}

const Icon = {
  back: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>,
  next: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  tick: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>,
  bin: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>,
  alert: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></svg>,
};

const ago = t => {
  if (!t) return '';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s} sec ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export default function WizardShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, profile } = useAuth();
  const { formData, resetFormData, updateFormData } = useFormData();
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [, tick] = useState(0);

  const isAdmin = !!(profile?.is_global_admin || profile?.is_admin);
  const status = formData.status || 'draft';
  const canEdit = isEditable(status, isAdmin);
  const canDelete = ['draft', 'cancelled'].includes(status);
  const current = SECTIONS.findIndex(s => location.pathname.endsWith('/' + s.path));
  const idx = current < 0 ? 0 : current;
  const states = useMemo(() => sectionStatus(formData), [formData]);
  const doneCount = SECTIONS.filter(s => states[s.path] === 'done').length;
  const errors = Object.entries(formData.invalidFields || {}).flatMap(([section, fields]) =>
    Object.entries(fields).filter(([, m]) => !!m).map(([field, m]) => ({ section, field, m })));

  // typing, ticking or choosing anything in the form marks it as unsaved
  const markDirty = e => {
    if (e.target.closest?.('.wz-drawer')) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) setDirty(true);
  };
  useEffect(() => {
    const t = setInterval(() => tick(x => x + 1), 15000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [idx]);

  const doSave = async ({ quiet = false } = {}) => {
    if (!canEdit) return true;
    if (errors.length) {
      if (!quiet) alert(`Please fix these first:\n\n${errors.map(e => `• ${e.field}: ${e.m}`).join('\n')}`);
      return quiet; // moving between sections is still allowed
    }
    setSaving(true);
    try {
      await save(formData, signOut, updateFormData, navigate);
      setSavedAt(Date.now());
      setDirty(false);
      return true;
    } catch (err) {
      alert(`Could not save: ${err.message}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const go = async path => {
    if (dirty && !(await doSave({ quiet: true }))) return;
    navigate({ pathname: path, search: `?job=${formData.installationId}` });
  };
  const backToJob = async () => {
    if (dirty && !(await doSave())) return;
    navigate(`/jobs/${formData.installationId}`);
  };
  const confirmDelete = async () => {
    setShowDelete(false);
    if (formData.installationId) {
      const { error } = await supabase.rpc('fn_delete_installation', { _installation: formData.installationId });
      if (error) return alert(`Could not delete: ${error.message}`);
    }
    resetFormData();
    navigate('/');
  };

  const name = [formData.firstName, formData.surname].filter(Boolean).join(' ') || 'New customer';
  const meta = [formData.installationAddress, 'Activity 6', formData.premisesType === 'non-residential' ? 'Non-residential' : 'Residential']
    .filter(Boolean).join(' · ');
  const prev = SECTIONS[idx - 1];
  const next = SECTIONS[idx + 1];

  return (
    <div className="wz">
      <header className="wz-head">
        <div className="wz-head-in">
          <button type="button" className="wz-back" onClick={backToJob} title={canEdit ? 'Save and return to the job' : 'Return to the job'}>
            {Icon.back}<span className="wz-ref">{formData.jobRef || 'Job'}</span>
          </button>
          <div className="wz-who">
            <b>{name}</b>
            <span>{meta}</span>
          </div>
          <span className={`wz-saved ${dirty ? 'dirty' : ''}`} aria-live="polite">
            {!canEdit ? `${statusLabel(status)} · read only`
              : saving ? 'Saving…'
              : dirty ? 'Unsaved changes'
              : savedAt ? <>{Icon.tick} Saved {ago(savedAt)}</>
              : <>{Icon.tick} All changes saved</>}
          </span>
          {canEdit && canDelete && (
            <button type="button" className="wz-delete" onClick={() => setShowDelete(true)}>{Icon.bin}Delete</button>
          )}
          {canEdit && <button type="button" className="wz-save" onClick={() => doSave()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>}
        </div>
      </header>

      <div className="wz-body">
        <nav className="wz-nav" aria-label="Job form sections">
          <div className="wz-nav-top">
            <b>Job form</b>
            <span className="wz-bar"><span style={{ width: `${(doneCount / SECTIONS.length) * 100}%` }} /></span>
            <span className="wz-muted">{doneCount} of {SECTIONS.length} sections complete</span>
          </div>
          <ol>
            {SECTIONS.map((s, i) => {
              const st = states[s.path];
              const on = i === idx;
              return (
                <li key={s.path}>
                  <button type="button" className={`wz-step ${on ? 'on' : ''}`} aria-current={on ? 'step' : undefined} onClick={() => go(s.path)}>
                    <span className={`wz-dot ${st}`}>{st === 'done' ? Icon.tick : i + 1}</span>
                    <span className="wz-step-label">{s.label}</span>
                    <span className={`wz-step-state ${st}`}>{st === 'done' ? 'Complete' : st === 'partial' ? 'In progress' : 'Not started'}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <main className="wz-main">
          <div className="wz-title">
            <span className="wz-muted">Section {idx + 1} of {SECTIONS.length}</span>
            <h1>{SECTIONS[idx].label}</h1>
          </div>
          {errors.length > 0 && (
            <div className="wz-alert" role="alert">
              {Icon.alert}
              <div>
                <b>{errors.length} field{errors.length === 1 ? ' needs' : 's need'} fixing</b>
                <ul>{errors.map(e => <li key={e.section + e.field}>{e.field}: {e.m}</li>)}</ul>
              </div>
            </div>
          )}
          {!canEdit && <div className="wz-note">This job is {statusLabel(status).toLowerCase()}, so the form is read only.</div>}
          <div className="wz-content" onInput={markDirty} onChange={markDirty}>{children}</div>
        </main>
      </div>

      <footer className="wz-foot">
        <div className="wz-foot-in">
          {prev
            ? <button type="button" className="wz-btn" onClick={() => go(prev.path)}>{Icon.back}{prev.label}</button>
            : <button type="button" className="wz-btn" onClick={backToJob}>{Icon.back}Back to job</button>}
          <span className="wz-muted wz-foot-hint">{canEdit ? 'You can move between sections — changes save as you go.' : ''}</span>
          {next
            ? <button type="button" className="wz-btn primary" onClick={() => go(next.path)}>Next: {next.label}{Icon.next}</button>
            : <button type="button" className="wz-btn primary" onClick={backToJob}>Finish and review job{Icon.next}</button>}
        </div>
      </footer>

      <ConfirmModal
        isOpen={showDelete}
        title="Delete this job?"
        message={<><p>This permanently deletes the draft job and its customer, premises, decommissioning and evidence records.</p><p>This cannot be undone.</p></>}
        onConfirm={confirmDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
