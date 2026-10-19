import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthProvider';
import '../../styles/portal.css';

export default function AppHeader() {
  const { profile, company, signOut } = useAuth();
  const navigate = useNavigate();
  const role = profile?.is_global_admin ? 'Global admin' : profile?.is_admin ? 'Admin' : 'Staff';

  return (
    <header className="app-header">
      <div className="brand">
        {company?.name || 'VEU Portal'}
        <small>VEU installation reporting</small>
      </div>
      <nav>
        <NavLink to="/" end>Jobs</NavLink>
        <NavLink to="/security">Security</NavLink>
        <NavLink to="/settings">{profile?.is_admin || profile?.is_global_admin ? 'Team & companies' : 'My account'}</NavLink>
      </nav>
      <div className="spacer" />
      <div className="who">
        {profile?.name || profile?.email}
        <br />
        <span style={{ opacity: 0.7 }}>{role}</span>
      </div>
      <button
        className="btn small"
        onClick={async () => {
          await signOut();
          navigate('/login', { replace: true });
        }}
      >
        Log out
      </button>
    </header>
  );
}
