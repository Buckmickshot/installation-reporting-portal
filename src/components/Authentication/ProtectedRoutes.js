// src/components/Authentication/ProtectedRoutes.js
import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthProvider'

export default function ProtectedRoute() {
  const { user, loading, company, profile } = useAuth()

  if (loading) return <p>Loading…</p>
  if (!user || !profile || !company || profile.active === false || company.active === false) return <Navigate to="/login" replace />

  // <-- this is critical
  return <Outlet />
}
