// src/components/jobCreation/JobLayout.js
import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import TopBarNavigator from './TopBarNavigator';
import { useFormData } from '../../contexts/FormDataContext';

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
  const { formData } = useFormData();
  usePreventPageUnload(Boolean(formData.installationId));

  // Form state lives in memory; after a page refresh there is no job loaded.
  if (!formData.installationId) return <Navigate to="/" replace />;

  return (
    <>
      <TopBarNavigator />
      <div className="job-layout-container">
        <Outlet />
      </div>
    </>
  );
}
