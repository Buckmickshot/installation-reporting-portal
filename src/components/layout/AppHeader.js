import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthProvider';
import { BRAND } from '../../config/brand';
import { permissions, ROLE_LABEL } from '../../utils/roles';
import '../../styles/portal.css';

export default function AppHeader() {
  const { profile, company, signOut } = useAuth();
  const navigate = useNavigate();
  const can = permissions(profile);
  const role = ROLE_LABEL[can.role] || '';

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
        <NavLink to="/" end>{can.isWorker ? 'My jobs' : 'Jobs'}</NavLink>
        {can.manageTeam && <NavLink to="/team">{can.isGlobal ? 'Team & companies' : 'Team'}</NavLink>}
        {can.viewAudit && <NavLink to="/activity">Data log</NavLink>}
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
