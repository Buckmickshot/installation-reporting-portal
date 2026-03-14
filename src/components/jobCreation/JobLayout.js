// src/components/jobCreation/JobLayout.js
import React from 'react';
import { Outlet } from 'react-router-dom';
import TopBarNavigator from './TopBarNavigator';
import { useEffect } from 'react';

function usePreventPageUnload(shouldPrevent = true) {
  useEffect(() => {
    if (!shouldPrevent) return

    const handler = (e) => {
      // Standard message is ignored by most modern browsers,
      // but returning any string triggers the prompt.
      e.preventDefault()
      e.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
    }
  }, [shouldPrevent])
}

export default function JobLayout() {
  usePreventPageUnload()
  return (
    <>
      <TopBarNavigator />
      <div className="job-layout-container">
        <Outlet />
      </div>
    </>
  );
}