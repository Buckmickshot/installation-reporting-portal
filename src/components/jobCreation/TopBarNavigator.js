// src/components/jobCreation/TopBarNavigator.js
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import './TopBarNavigator.css';
import { FaSave, FaTrash } from 'react-icons/fa';
import { useFormData } from '../../contexts/FormDataContext';
import { save } from '../../relationship/save';
import { supabase } from '../../relationship/supabaseConfig';
import { useAuth } from '../../contexts/AuthProvider';
import { isEditable, statusLabel } from '../../utils/jobStatus';
import ConfirmModal from './ConfirmModal';

const TABS = [
  { path: 'customer', label: 'Customer Info' },
  { path: 'decommission', label: 'Decommission' },
  { path: 'benefit', label: 'Benefit & Install' },
  { path: 'worker', label: 'Workers' },
  { path: 'review', label: 'Review Install' },
  { path: 'postInstall', label: 'Post Install' },
  { path: 'declaration', label: 'Declaration' },
];

export default function TopBarNavigator() {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const { formData, resetFormData, updateFormData } = useFormData();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = !!(profile?.is_global_admin || profile?.is_admin);
  const status = formData.status || 'draft';
  const canEdit = isEditable(status, isAdmin);
  const canDelete = ['draft', 'cancelled'].includes(status);

  const doSave = async () => {
    const errorMessages = Object.entries(formData.invalidFields || {}).flatMap(([section, fields]) =>
      Object.entries(fields)
        .filter(([, msg]) => !!msg)
        .map(([field, msg]) => `• ${section} → ${field}: ${msg}`)
    );
    if (errorMessages.length > 0) {
      alert(`Please fix the following errors before saving:\n\n${errorMessages.join('\n')}`);
      return false;
    }
    setSaving(true);
    try {
      await save(formData, signOut, updateFormData, navigate);
      return true;
    } catch (err) {
      console.error('Save error:', err);
      alert(`Could not save: ${err.message}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setShowDeleteModal(false);
    if (formData.installationId) {
      const { error } = await supabase.rpc('fn_delete_installation', { _installation: formData.installationId });
      if (error) return alert(`Could not delete: ${error.message}`);
    }
    resetFormData();
    navigate('/');
  };

  const goOverview = async () => {
    if (canEdit && !(await doSave())) return;
    navigate(`/jobs/${formData.installationId}`);
  };

  return (
    <>
      <div className="topbar-nav">
        <div className="left-section">
          <button type="button" className="topbar-back" onClick={goOverview} title={canEdit ? 'Save and go back to the job' : 'Back to the job'}>
            <span aria-hidden="true">←</span>
            <span>
              <b>{formData.jobRef || 'Job'}</b>
              <small>{statusLabel(status)}{canEdit ? ' · saves on exit' : ''}</small>
            </span>
          </button>
        </div>

        <div className="nav-tabs">
          {TABS.map(tab => (
            <NavLink key={tab.path} to={{ pathname: tab.path, search: `?job=${formData.installationId}` }} className={({ isActive }) => (isActive ? 'nav-tab active' : 'nav-tab')}>
              {tab.label}
            </NavLink>
          ))}
        </div>

        <div className="right-section">
          {canEdit && (
            <FaSave
              className="icon save-icon"
              title={saving ? 'Saving…' : 'Save'}
              style={{ opacity: saving ? 0.5 : 1 }}
              onClick={async () => {
                if (!saving && (await doSave())) alert('Saved.');
              }}
            />
          )}
          {canDelete && <FaTrash className="icon delete-icon" title="Delete draft" onClick={() => setShowDeleteModal(true)} />}
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete this job?"
        message={
          <>
            <p>
              This permanently deletes the draft job and its customer, premises, decommissioning and evidence records.
              Documents shared with other jobs at the same premises are kept.
            </p>
            <p>This cannot be undone.</p>
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </>
  );
}
