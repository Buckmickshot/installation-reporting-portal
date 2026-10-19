import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthProvider';
import { BRAND } from '../../config/brand';
import '../../styles/portal.css';

export default function AppHeader() {
  const { profile, company, signOut } = useAuth();
  const navigate = useNavigate();
  const role = profile?.is_global_admin ? 'Global admin' : profile?.is_admin ? 'Admin' : 'Staff';

  return (
    <header className="app-header">
      <Link to="/" className="brand" title="Go to the jobs dashboard">
        <span className="brand-mark" aria-hidden="true">AR</span>
        <span>
          {BRAND.name}
          <small>{company?.name && company.name !== BRAND.name ? company.name : BRAND.tagline}</small>
        </span>
      </Link>
      <nav>
        <NavLink to="/" end>Jobs</NavLink>
        {(profile?.is_admin || profile?.is_global_admin) && <NavLink to="/team">{profile?.is_global_admin ? 'Team & companies' : 'Team'}</NavLink>}
        <NavLink to="/settings">Settings</NavLink>
        <a href={`${process.env.PUBLIC_URL || ''}/app`} target="_blank" rel="noreferrer" title="The installer app for phones">Field app ↗</a>
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
