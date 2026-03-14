// src/components/HomeScreen.js
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFormData } from '../../contexts/FormDataContext'
import { supabase } from '../../relationship/supabaseConfig'
import { LoadInstallation } from './LoadInstallation'
import { useAuth } from '../../contexts/AuthProvider'
import { safeQuery } from '../Authentication/SafeQuery'
import './HomeScreen.css'

export default function HomeScreen() {
  const navigate = useNavigate()
  const { user, profile, company, signOut } = useAuth()
  const { updateFormData, resetFormData } = useFormData()

  const [jobsLoading, setJobsLoading] = useState(false)
  const [companies, setCompanies] = useState([])
  const [installationsByCompany, setInstallationsByCompany] = useState({})
  const [expandedCompanyId, setExpandedCompanyId] = useState(null)
  const [targetCompanyId, setTargetCompanyId]      = useState(null);

  const isGlobalAdmin = profile?.is_global_admin

  useEffect(() => {
    if (!user) return;
  
    const fetchData = async () => {
      setJobsLoading(true);
  
      try {
        if (isGlobalAdmin) {
          /* 📋 company list only */
          const { data, error } = await safeQuery(
            () =>
              supabase
                .from('current_company_versions')
                .select('company_id, name, address, company_active')
                .order('name'),
            { signOut, navigate }
          );
          
          if (error) return;
          setCompanies(data)

        } else {
          /* 🗂  installations for my company */
          const { data, error } = await safeQuery(
            () =>
              supabase
                .from('installation')
                .select('installation_id, company_id, created_at, updated_at, complete, user_id')
                .order('created_at', { ascending: false }),
            { signOut, navigate }
          );

          if (!error) {
            // rows are already RLS-filtered → all belong to my company
            setInstallationsByCompany({ [company.company_id]: data });
          } else {
            return;
          }
        }
      } finally {
        setJobsLoading(false);
      }
    };
    fetchData();

    const onFocus = () => fetchData();
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [user, isGlobalAdmin]);

  const fetchInstallationsForCompany = async cid => {
    const { data, error } = await safeQuery(
      () =>
        supabase
          .from('installation')
          .select('installation_id, company_id, created_at, updated_at, complete, user_id')
          .eq('company_id', cid)                            // 🔑
          .order('created_at', { ascending: false }),
      { signOut, navigate }
    );

    if (!error) {
      setInstallationsByCompany(prev => ({ ...prev, [cid]: data }));
    } else {
      return
    }
  }

  const handleResume = async installation_id => {
    try {
      resetFormData()
      await LoadInstallation(installation_id, updateFormData, signOut, navigate)
      navigate('/create-job/full')
    } catch (err) {
      console.error('Error resuming job:', err)
      alert('Could not resume that job.')
    }
  }

  const handleStart = async (forcedCid = null) => {
    resetFormData()
    const targetCid = forcedCid ?? (isGlobalAdmin ? targetCompanyId : company.company_id);

    updateFormData({ companyId: targetCid })

    navigate('/choose-installation-type')
  }

  return (
    <div className="home-screen">
      <div className="topbar">
        <h1 className="topbar-title">Kyle and Friends</h1>

        <button
          className="settings-button"
          onClick={() => navigate('/settings')}
          style={{ marginRight: 'auto', marginLeft: '0.5rem' }}
        >
          ⚙️
        </button>

        <button
          className="create-job-button"
          onClick={() => handleStart()}
          disabled={isGlobalAdmin && !targetCompanyId}   // ← inactive until a company picked
        >
          Create Job
        </button>
      </div>

      {jobsLoading ? (
        <p>Loading jobs…</p>
      ) : isGlobalAdmin ? (
        <ul className="company-list">
          {companies.map(c => (
            <li key={c.company_id}>
              <div className="company-row">
                <button
                  onClick={() => {
                    const newId = expandedCompanyId === c.company_id ? null : c.company_id
                    setExpandedCompanyId(newId)
                    setTargetCompanyId(newId);
                    if (newId && !installationsByCompany[newId]) {
                      fetchInstallationsForCompany(newId)
                    }
                  }}
                >
                  {expandedCompanyId === c.company_id ? '▾' : '▸'}
                </button>
                <strong>{c.name} — {c.address} - {c.company_id} - {c.company_active ? 'Active' : 'Inactive'}</strong>
                {/* new button, visible only when company is active */}
                {c.company_active && (
                  <button
                    style={{ marginLeft: '1rem' }}
                    onClick={() => {
                      setTargetCompanyId(c.company_id);
                      handleStart();              // uses current targetCompanyId
                    }}
                  >
                    ＋ Create Job
                  </button>
                )}
              </div>
              {expandedCompanyId === c.company_id && installationsByCompany[c.company_id] && (
                <ul className="job-list">
                  {installationsByCompany[c.company_id].map(job => (
                    <li key={job.installation_id}>
                      <div>
                        <strong>
                          Created: {new Date(job.created_at).toLocaleDateString()}
                        </strong>{' '}
                        <em>
                          Last saved: {new Date(job.updated_at).toLocaleDateString()}
                        </em>{' '}
                        <em>
                          installation Id: {job.installation_id}
                        </em>{' '}
                        <em>status: {job.complete ? 'Complete' : 'In progress'}</em>{' '}
                      </div>
                      <button onClick={() => handleResume(job.installation_id)}>
                        Resume
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="job-list">
          {(installationsByCompany[company.company_id] || []).map(job => (
            <li key={job.installation_id}>
              <div>
                <strong>
                  Created: {new Date(job.created_at).toLocaleDateString()}
                </strong>{' '}
                <em>
                  Last saved: {new Date(job.updated_at).toLocaleDateString()}
                </em>{' '}
                <em>
                <em>status: {job.complete ? 'Complete' : 'In progress'}</em>
                </em>{' '}
              </div>
              <button onClick={() => handleResume(job.installation_id)}>
                Resume
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}