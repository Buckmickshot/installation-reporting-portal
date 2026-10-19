// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FormDataProvider } from './contexts/FormDataContext';
import { SearchProvider }   from './contexts/SearchContext';
import { AuthProvider } from './contexts/AuthProvider';

import LoginPage                  from './components/Authentication/LoginPage';
import ProtectedRoute             from './components/Authentication/ProtectedRoutes';
import JobLayout                  from './components/jobCreation/JobLayout';
import InstallationTypeScreen     from './components/jobCreation/InstallationTypeScreen';
import HomeScreen                 from './components/homeScreen/HomeScreen';
import CustomerScreen             from './components/jobCreation/Activity_6/CustomerScreen';
import BenefitInstallationScreen  from './components/jobCreation/Activity_6/BenefitIntallationScreen';
import DecommissionScreen         from './components/jobCreation/Activity_6/DecommissionScreen';
import ReviewInstallScreen              from './components/jobCreation/Activity_6/ReviewInstallScreen';
import DeclarationScreen          from './components/jobCreation/Activity_6/DeclarationScreen';
import PostInstallScreen          from './components/jobCreation/Activity_6/PostInstallScreen';
import WorkerScreen from './components/jobCreation/Activity_6/WorkerScreen';
import SettingsScreen from './components/homeScreen/SettingsScreen';
import AuthCallback from './components/Authentication/AuthCallback';
import ResetPassword from './components/Authentication/ResetPassword';
import JobOverview from './components/jobs/JobOverview';
import FieldCapture from './components/jobs/FieldCapture';

export default function App() {
  return (
    <AuthProvider>
      <FormDataProvider>
        <SearchProvider>
          <BrowserRouter>
            <Routes>

              {/* public routes */}
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/login" element={<LoginPage />} />

              {/* protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<HomeScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
                <Route path="/choose-installation-type" element={<InstallationTypeScreen />} />
                <Route path="/jobs/:id" element={<JobOverview />} />
                <Route path="/jobs/:id/field" element={<FieldCapture />} />

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

              {/* catch‑all: redirect unknown URLs */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </SearchProvider>
      </FormDataProvider>
    </AuthProvider>
  )
}