// src/components/jobCreation/JobLayout.js
import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import WizardShell from './WizardShell';
import { useFormData } from '../../contexts/FormDataContext';
import { useAuth } from '../../contexts/AuthProvider';
import { LoadInstallation } from '../homeScreen/LoadInstallation';

function usePreventPageUnload(shouldPrevent = true) {
  useEffect(() => {
    if (!shouldPrevent) return;
    const handler = e => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldPrevent]);
}

export default function JobLayout() {
  const { formData, updateFormData, resetFormData } = useFormData();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const jobParam = params.get('job');
  const [state, setState] = useState('idle'); // idle | loading | failed
  usePreventPageUnload(Boolean(formData.installationId));

  // after a refresh the form state is gone — reload it from the ?job= id in the URL
  useEffect(() => {
    if (formData.installationId || !jobParam || state !== 'idle') return;
    setState('loading');
    resetFormData();
    LoadInstallation(jobParam, updateFormData, signOut, navigate)
      .then(() => setState('idle'))
      .catch(() => setState('failed'));
  }, [formData.installationId, jobParam, state, resetFormData, updateFormData, signOut, navigate]);

  if (!formData.installationId) {
    if (jobParam && state !== 'failed') return <p style={{ padding: 24 }}>Loading job…</p>;
    return <Navigate to="/" replace />;
  }

  return (
    <WizardShell>
      <Outlet />
    </WizardShell>
  );
}
