// src/components/Authentication/ProtectedRoutes.js
import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthProvider'

export default function ProtectedRoute() {
  const { user, loading, company, profile } = useAuth()
  const location = useLocation()

  if (loading) return <p style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#5b6878' }}>Loading…</p>
  if (!user || !profile || !company || profile.active === false || company.active === false) {
    // come back to the page they asked for (e.g. the field app) after signing in
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}
