// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FormDataProvider } from './contexts/FormDataContext';
import { SearchProvider }   from './contexts/SearchContext';
import { AuthProvider } from './contexts/AuthProvider';

import LoginPage                  from './components/Authentication/LoginPage';
import ProtectedRoute             from './components/Authentication/ProtectedRoutes';
import JobLayout                  from './components/jobCreation/JobLayout';
import NewJobPage from './components/jobCreation/NewJobPage';
import HomeScreen                 from './components/homeScreen/HomeScreen';
import CustomerScreen             from './components/jobCreation/Activity_6/CustomerScreen';
import BenefitInstallationScreen  from './components/jobCreation/Activity_6/BenefitIntallationScreen';
import DecommissionScreen         from './components/jobCreation/Activity_6/DecommissionScreen';
import ReviewInstallScreen              from './components/jobCreation/Activity_6/ReviewInstallScreen';
import DeclarationScreen          from './components/jobCreation/Activity_6/DeclarationScreen';
import PostInstallScreen          from './components/jobCreation/Activity_6/PostInstallScreen';
import WorkerScreen from './components/jobCreation/Activity_6/WorkerScreen';
import TeamPage from './components/team/TeamPage';
import AuthCallback from './components/Authentication/AuthCallback';
import ResetPassword from './components/Authentication/ResetPassword';
import JobOverview from './components/jobs/JobOverview';
import FieldApp from './field/FieldApp';
import { useParams } from 'react-router-dom';
import AccountSettings from './components/settings/AccountSettings';
import ForgotPassword from './components/Authentication/ForgotPassword';
import ActivityLog from './components/activity/ActivityLog';
import { useAuth } from './contexts/AuthProvider';
import { permissions } from './utils/roles';
import { Outlet } from 'react-router-dom';

/** Pages workers can't use (job creation, job form, admin pages). */
function NotForWorkers() {
  const { profile } = useAuth();
  return permissions(profile).isWorker ? <Navigate to="/" replace /> : <Outlet />;
}

function FieldRedirect() {
  const { id } = useParams();
  return <Navigate to={`/app/jobs/${id}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <FormDataProvider>
        <SearchProvider>
          <BrowserRouter basename={process.env.PUBLIC_URL || undefined}>
            <Routes>

              {/* public routes */}
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              {/* protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<HomeScreen />} />
                <Route path="/settings" element={<AccountSettings />} />
                <Route path="/activity" element={<ActivityLog />} />
                <Route path="/jobs/:id" element={<JobOverview />} />
                <Route path="/jobs/:id/field" element={<FieldRedirect />} />
                <Route path="/app/*" element={<FieldApp />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/security" element={<Navigate to="/settings" replace />} />

                {/* not for workers: creating jobs and editing the job form */}
                <Route element={<NotForWorkers />}>
                  <Route path="/new-job" element={<NewJobPage />} />
                  <Route path="/choose-installation-type" element={<Navigate to="/new-job" replace />} />
                  <Route path="/create-job/:workType/:premiseType?" element={<JobLayout />}>
                    <Route index               element={<Navigate to="customer" replace />} />
                    <Route path="customer"     element={<CustomerScreen />} />
                    <Route path="decommission" element={<DecommissionScreen />} />
                    <Route path="benefit"      element={<BenefitInstallationScreen />} />
                    <Route path="worker"       element={<WorkerScreen />} />
                    <Route path="review"       element={<ReviewInstallScreen />} />
                    <Route path="declaration"  element={<DeclarationScreen />} />
                    <Route path="postInstall"  element={<PostInstallScreen />} />
                  </Route>
                </Route>
              </Route>

              {/* catch‑all: redirect unknown URLs */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </SearchProvider>
      </FormDataProvider>
    </AuthProvider>
  )
}