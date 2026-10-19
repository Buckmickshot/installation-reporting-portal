// Team & companies: companies (global admins) and the people in each company.
// Global admins manage every company; company admins manage their own; staff never see this page.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { appUrl } from '../../config/env';
import { supabase } from '../../relationship/supabaseConfig';
import { useAuth } from '../../contexts/AuthProvider';
import AppHeader from '../layout/AppHeader';
import { Modal, MenuButton, Field, Toast } from '../ui/Modal';
import { PasswordInput, PasswordRules } from '../auth/AuthUi';
import { isEmail, isStrongPassword, generatePassword } from '../../utils/passwordPolicy';
import { isValidPhone } from '../../utils/Enforce';
import { formatDate } from '../../utils/jobStatus';
import '../../styles/portal.css';
import '../../styles/auth.css';

const ROLES = [
  { value: 'staff', label: 'Staff', hint: 'Create, edit and view jobs. Can change their own password and two-factor.' },
  { value: 'admin', label: 'Admin', hint: 'Everything staff can do, plus manage users and company details.' },
  { value: 'global_admin', label: 'Global admin', hint: 'Manages every company. ASAP Rebates staff only.' },
];
const roleOf = u => (u.is_global_admin ? 'global_admin' : u.is_admin ? 'admin' : 'staff');
const roleLabel = r => ROLES.find(x => x.value === r)?.label;
const initials = n => (n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const rpcError = e => (e?.message || 'Something went wrong').replace(/^.*?exception:\s*/i, '');

/* ---------- dialogs ---------- */

function CompanyDialog({ company, onClose, onSaved }) {
  const [name, setName] = useState(company?.name || '');
  const [address, setAddress] = useState(company?.address || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async e => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return setErr('Enter the company name and address.');
    setBusy(true);
    const { error } = company
      ? await supabase.from('company_versions').insert({ company_id: company.company_id, name: name.trim(), address: address.trim(), previous_version_id: company.company_version_id })
      : await supabase.rpc('create_new_company', { input_name: name.trim(), input_address: address.trim() });
    setBusy(false);
    if (error) return setErr(rpcError(error));
    onSaved(company ? 'Company details updated.' : `${name.trim()} created.`);
  };
  return (
    <Modal title={company ? 'Edit company' : 'New company'} onClose={onClose}>
      <form onSubmit={save} className="ui-form">
        {err && <div className="banner danger">{err}</div>}
        <Field label="Company name"><input className="input" value={name} onChange={e => setName(e.target.value)} autoFocus /></Field>
        <Field label="Business address"><input className="input" value={address} onChange={e => setAddress(e.target.value)} /></Field>
        <div className="ui-dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : company ? 'Save changes' : 'Create company'}</button>
        </div>
      </form>
    </Modal>
  );
}

function RoleSelect({ value, onChange, allowGlobal, disabled }) {
  return (
    <div className="role-options" role="radiogroup" aria-label="Role">
      {ROLES.filter(r => allowGlobal || r.value !== 'global_admin').map(r => (
        <label key={r.value} className={`role-option ${value === r.value ? 'on' : ''} ${disabled ? 'disabled' : ''}`}>
          <input type="radio" name="role" value={r.value} checked={value === r.value} disabled={disabled} onChange={() => onChange(r.value)} />
          <span><b>{r.label}</b><small>{r.hint}</small></span>
        </label>
      ))}
    </div>
  );
}

function AddUserDialog({ company, allowGlobal, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', role: 'staff', password: generatePassword() });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });

  const save = async e => {
    e.preventDefault();
    if (!f.name.trim()) return setErr('Enter their full name.');
    if (!isEmail(f.email)) return setErr('Enter a valid email address.');
    if (f.phone && !isValidPhone(f.phone)) return setErr('Enter a valid Australian phone number.');
    if (!isStrongPassword(f.password)) return setErr('The temporary password doesn’t meet the requirements.');
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: f.email.trim(), password: f.password, name: f.name.trim(), phone: f.phone.trim() || null,
        company_id: company.company_id, is_admin: f.role !== 'staff', is_global_admin: f.role === 'global_admin',
      },
    });
    setBusy(false);
    if (error || data?.error) {
      let msg = data?.error;
      try { msg = msg || (await error.context.json()).error; } catch { /* ignore */ }
      return setErr(msg || error?.message || 'Could not create the account.');
    }
    onSaved(`${f.name.trim()} added. Share the temporary password with them securely — they can change it in Settings.`, f);
  };

  return (
    <Modal title="Add user" subtitle={company.name} onClose={onClose} width={560}>
      <form onSubmit={save} className="ui-form">
        {err && <div className="banner danger">{err}</div>}
        <div className="ui-row">
          <Field label="Full name"><input className="input" value={f.name} onChange={set('name')} autoFocus /></Field>
          <Field label="Mobile (optional)"><input className="input" value={f.phone} onChange={set('phone')} placeholder="04xx xxx xxx" /></Field>
        </div>
        <Field label="Email address" hint="They sign in with this email."><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Role"><RoleSelect value={f.role} onChange={role => setF({ ...f, role })} allowGlobal={allowGlobal} /></Field>
        <div className="settings-form auth-like" style={{ maxWidth: 'none' }}>
          <PasswordInput label="Temporary password" value={f.password} onChange={set('password')} autoComplete="new-password"
            right={<button type="button" className="linklike" onClick={() => setF({ ...f, password: generatePassword() })}>Generate</button>} />
          <PasswordRules password={f.password} />
        </div>
        <div className="ui-dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Adding…' : 'Add user'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserDialog({ u, me, allowGlobal, onClose, onSaved }) {
  const self = u.user_id === me;
  const [f, setF] = useState({ name: u.name || '', email: u.email || '', phone: u.phone || '', role: roleOf(u), active: u.active });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });

  const save = async e => {
    e.preventDefault();
    if (!f.name.trim()) return setErr('Enter their full name.');
    if (!isEmail(f.email)) return setErr('Enter a valid email address.');
    if (f.phone && !isValidPhone(f.phone)) return setErr('Enter a valid Australian phone number.');
    setBusy(true);
    const { error } = await supabase.rpc('fn_admin_update_user', {
      _user: u.user_id, _name: f.name, _phone: f.phone, _email: f.email, _role: f.role, _active: f.active,
    });
    setBusy(false);
    if (error) return setErr(rpcError(error));
    onSaved(`${f.name.trim()} updated.`);
  };

  return (
    <Modal title="Edit user" subtitle={u.email} onClose={onClose} width={560}>
      <form onSubmit={save} className="ui-form">
        {err && <div className="banner danger">{err}</div>}
        <div className="ui-row">
          <Field label="Full name"><input className="input" value={f.name} onChange={set('name')} /></Field>
          <Field label="Mobile"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
        </div>
        <Field label="Email address" hint="Changing this changes the email they sign in with.">
          <input className="input" type="email" value={f.email} onChange={set('email')} />
        </Field>
        <Field label="Role" hint={self ? 'You can’t change your own role.' : undefined}>
          <RoleSelect value={f.role} onChange={role => setF({ ...f, role })} allowGlobal={allowGlobal} disabled={self} />
        </Field>
        <div className="ui-dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordDialog({ u, onClose, onSaved }) {
  const [pw, setPw] = useState(generatePassword());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async e => {
    e.preventDefault();
    if (!isStrongPassword(pw)) return setErr('The password doesn’t meet the requirements.');
    setBusy(true);
    const { error } = await supabase.rpc('fn_admin_set_password', { _user: u.user_id, _password: pw });
    setBusy(false);
    if (error) return setErr(rpcError(error));
    onSaved(`Password changed for ${u.name}. They’ve been signed out on all devices.`);
  };
  const sendLink = async () => {
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(u.email, { redirectTo: appUrl('/auth/callback') });
    setBusy(false);
    if (error) return setErr(error.status === 429 ? 'Too many emails sent recently. Set a password here instead.' : error.message);
    onSaved(`Password reset link sent to ${u.email}.`);
  };
  return (
    <Modal title="Reset password" subtitle={`${u.name} · ${u.email}`} onClose={onClose} width={520}>
      <form onSubmit={save} className="ui-form">
        {err && <div className="banner danger">{err}</div>}
        <p className="sub" style={{ margin: 0 }}>Set a new password and share it with them securely, or email them a reset link.</p>
        <div className="settings-form auth-like" style={{ maxWidth: 'none' }}>
          <PasswordInput label="New password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password"
            right={<button type="button" className="linklike" onClick={() => setPw(generatePassword())}>Generate</button>} />
          <PasswordRules password={pw} />
        </div>
        <div className="ui-dialog-actions spread">
          <button type="button" className="btn ghost" onClick={sendLink} disabled={busy}>Email a reset link instead</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Set password'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- company panel ---------- */

function CompanyPanel({ company, isGlobal, ownCompanyId, me, onCompanyChanged, toast }) {
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState('');
  const [dialog, setDialog] = useState(null); // { kind, user }

  const load = useCallback(async () => {
    setErr('');
    const { data, error } = await supabase.rpc('fn_company_users', { _company: company.company_id });
    if (error) return setErr(rpcError(error));
    setUsers(data || []);
  }, [company.company_id]);
  useEffect(() => { setUsers(null); load(); }, [load]);

  const done = msg => { setDialog(null); toast({ kind: 'good', text: msg }); load(); };

  const toggleActive = async u => {
    const verb = u.active ? 'Deactivate' : 'Reactivate';
    if (!window.confirm(u.active
      ? `Deactivate ${u.name}? They’ll be signed out and won’t be able to sign in. Their jobs are kept.`
      : `Reactivate ${u.name}? They’ll be able to sign in again.`)) return;
    const { error } = await supabase.rpc('fn_admin_update_user', {
      _user: u.user_id, _name: u.name, _phone: u.phone, _email: u.email, _role: roleOf(u), _active: !u.active,
    });
    if (error) return toast({ kind: 'bad', text: rpcError(error) });
    done(`${u.name} ${verb.toLowerCase()}d.`);
  };

  const resetMfa = async u => {
    if (!window.confirm(`Remove ${u.name}’s authenticator app? Use this if they’ve lost their phone. They can set it up again in Settings.`)) return;
    const { error } = await supabase.rpc('fn_admin_reset_mfa', { _user: u.user_id });
    if (error) return toast({ kind: 'bad', text: rpcError(error) });
    done(`Two-factor removed for ${u.name}.`);
  };

  const toggleCompany = async () => {
    if (!window.confirm(company.company_active
      ? `Deactivate ${company.name}? None of its users will be able to access any data.`
      : `Reactivate ${company.name}?`)) return;
    const { error } = await supabase.from('companies').update({ active: !company.company_active }).eq('company_id', company.company_id);
    if (error) return toast({ kind: 'bad', text: rpcError(error) });
    toast({ kind: 'good', text: `${company.name} ${company.company_active ? 'deactivated' : 'reactivated'}.` });
    onCompanyChanged();
  };

  const active = (users || []).filter(u => u.active).length;

  return (
    <section className="team-panel">
      <div className="team-panel-head">
        <div className="co-avatar lg">{initials(company.name)}</div>
        <div style={{ minWidth: 0 }}>
          <h2>{company.name}</h2>
          <div className="sub">{company.address || 'No address'}</div>
        </div>
        <div className="spacer" />
        <span className={`pill ${company.company_active ? 'good' : 'muted'}`}>{company.company_active ? 'Active' : 'Inactive'}</span>
        <MenuButton label="Company" items={[
          { label: 'Edit details', onClick: () => setDialog({ kind: 'company' }) },
          isGlobal && company.company_id !== ownCompanyId && {
            label: company.company_active ? 'Deactivate company' : 'Reactivate company', danger: company.company_active, onClick: toggleCompany,
          },
        ]} />
      </div>

      <div className="team-users-head">
        <h3>Users <span className="sub">{users ? `${active} active${users.length > active ? ` · ${users.length - active} inactive` : ''}` : ''}</span></h3>
        <button className="btn primary" onClick={() => setDialog({ kind: 'add' })}>+ Add user</button>
      </div>

      {err && <div className="banner danger">{err}</div>}
      {!users ? <p className="empty">Loading…</p> : users.length === 0 ? (
        <p className="empty">No users yet. Add the first person for this company.</p>
      ) : (
        <div className="table-wrap">
          <table className="users">
            <thead>
              <tr><th>Name</th><th>Role</th><th>Two-factor</th><th>Last sign-in</th><th>Status</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {users.map(u => {
                const self = u.user_id === me;
                const manageable = !self && (isGlobal || !u.is_global_admin);
                return (
                  <tr key={u.user_id} className={u.active ? '' : 'inactive'}>
                    <td>
                      <div className="user-cell">
                        <span className="avatar">{initials(u.name)}</span>
                        <div style={{ minWidth: 0 }}>
                          <div className="name">{u.name}{self && <span className="you">You</span>}</div>
                          <div className="sub">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`pill ${u.is_global_admin ? 'accent' : u.is_admin ? 'info' : 'neutral'}`}>{roleLabel(roleOf(u))}</span></td>
                    <td>{u.mfa_enabled ? <span className="pill good">On</span> : <span className="sub">Off</span>}</td>
                    <td className="sub">{u.last_sign_in_at ? formatDate(u.last_sign_in_at, true) : 'Never'}</td>
                    <td><span className={`pill ${u.active ? 'good' : 'muted'}`}>{u.active ? 'Active' : 'Inactive'}</span></td>
                    <td className="row-actions">
                      {manageable ? (
                        <MenuButton label="Manage" className="btn small" items={[
                          { label: 'Edit details & role', onClick: () => setDialog({ kind: 'edit', user: u }) },
                          { label: 'Reset password', onClick: () => setDialog({ kind: 'password', user: u }) },
                          u.mfa_enabled && { label: 'Remove two-factor', hint: 'If they’ve lost their phone', onClick: () => resetMfa(u) },
                          { label: u.active ? 'Deactivate' : 'Reactivate', danger: u.active, onClick: () => toggleActive(u) },
                        ]} />
                      ) : self ? (
                        <Link className="btn small ghost" to="/settings">Your settings</Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.kind === 'company' && <CompanyDialog company={company} onClose={() => setDialog(null)} onSaved={msg => { setDialog(null); toast({ kind: 'good', text: msg }); onCompanyChanged(); }} />}
      {dialog?.kind === 'add' && <AddUserDialog company={company} allowGlobal={isGlobal} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog?.kind === 'edit' && <EditUserDialog u={dialog.user} me={me} allowGlobal={isGlobal} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog?.kind === 'password' && <PasswordDialog u={dialog.user} onClose={() => setDialog(null)} onSaved={done} />}
    </section>
  );
}

/* ---------- page ---------- */

export default function TeamPage() {
  const { user, profile } = useAuth();
  const isGlobal = !!profile?.is_global_admin;
  const isAdmin = isGlobal || !!profile?.is_admin;
  const [companies, setCompanies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');
  const [newCompany, setNewCompany] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('current_company_versions')
      .select('company_id, company_version_id, name, address, company_active')
      .order('name');
    setCompanies(data || []);
  }, []);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);
  useEffect(() => {
    if (!selected && companies.length) setSelected(isGlobal ? companies[0].company_id : profile.company_id);
  }, [companies, selected, isGlobal, profile]);

  const list = useMemo(() => companies.filter(c => c.name.toLowerCase().includes(q.trim().toLowerCase())), [companies, q]);
  const current = companies.find(c => c.company_id === selected);

  if (profile && !isAdmin) return <Navigate to="/settings" replace />;

  return (
    <div className="portal">
      <AppHeader />
      <main className="page">
        <div className="page-title">
          <h1>{isGlobal ? 'Team & companies' : 'Team'}</h1>
          {isGlobal && <div className="actions"><button className="btn" onClick={() => setNewCompany(true)}>+ New company</button></div>}
        </div>

        <div className={isGlobal ? 'team-layout' : ''}>
          {isGlobal && (
            <aside className="co-list" aria-label="Companies">
              <input className="input" type="search" placeholder="Search companies" value={q} onChange={e => setQ(e.target.value)} />
              {list.map(c => (
                <button key={c.company_id} className={`co-item ${c.company_id === selected ? 'on' : ''}`} onClick={() => setSelected(c.company_id)}>
                  <span className="co-avatar">{initials(c.name)}</span>
                  <span className="co-text">
                    <b>{c.name}</b>
                    <small>{c.company_id === profile.company_id ? 'Your company' : c.company_active ? 'Active' : 'Inactive'}</small>
                  </span>
                </button>
              ))}
            </aside>
          )}
          {current
            ? <CompanyPanel key={current.company_id} company={current} isGlobal={isGlobal} ownCompanyId={profile.company_id} me={user.id} onCompanyChanged={load} toast={setToast} />
            : <p className="empty">Loading…</p>}
        </div>
      </main>
      {newCompany && <CompanyDialog onClose={() => setNewCompany(false)} onSaved={msg => { setNewCompany(false); setToast({ kind: 'good', text: msg }); load(); }} />}
      <Toast msg={toast} onDone={() => setToast(null)} />
    </div>
  );
}
