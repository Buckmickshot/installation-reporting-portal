import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthProvider';
import { supabase, createEphemeralClient } from '../../relationship/supabaseConfig';
import { FaPencilAlt } from 'react-icons/fa';
import './SettingsScreen.css';
import AppHeader from '../layout/AppHeader';
import '../../styles/portal.css';

export default function SettingsScreen() {
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [expandedCompanyId, setExpandedCompanyId] = useState(null);
  const [companyUsers, setCompanyUsers] = useState({});
  const [newCompany, setNewCompany] = useState({ name: '', address: '' });
  const [newUser, setNewUser] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    is_admin: false,
    is_global_admin: false,
  });
  const [modalState, setModalState] = useState({ companyId: null, mode: null, previousVersionId: null });
  const [editCompany, setEditCompany] = useState({ name: '', address: '' });
  const [editingUser, setEditingUser]   = useState(null);     // user_id being edited
  const [editForm,    setEditForm]      = useState({
    name: '', email: '', phone: '', is_admin: false
  });

  const isGlobalAdmin = profile?.is_global_admin;
  const isCompanyAdmin = profile?.is_admin;

  const openUserEditor = userObj => {
    setEditingUser(userObj.user_id);
    setEditForm({
      name:  userObj.name  ?? '',
      email: userObj.email ?? '',
      phone: userObj.phone ?? '',
      is_admin: userObj.is_admin
    });
  };
  
  const saveUserEdits = async companyId => {
    const { data: updatedUser, error } = await supabase
      .from('profiles')
      .update({
        name:  editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        // only global admins may change is_admin / is_global_admin
        ...((isGlobalAdmin || isCompanyAdmin) && editingUser !== user.id && { is_admin: editForm.is_admin })
      })
      .eq('user_id', editingUser)
      .select()
      .single();
  
    if (error) return alert('Update failed: ' + error.message);

    setCompanyUsers(prev => ({
      ...prev,
      [companyId]: prev[companyId].map(u =>
        u.user_id === updatedUser.user_id ? updatedUser : u
      ),
    }));
  
    setEditingUser(null);
    fetchUsersForCompany(companyId, true);    // refresh list
  };
  
  const fetchCompanies = async () => {
    const { data: companyData, error: companyError } = await supabase
      .from('current_company_versions')
      .select('company_id, company_version_id, name, address, created_at, company_active')
      .order('created_at', { ascending: false });
    if (!companyError) setCompanies(companyData);
  };

  useEffect(() => {
    if (!user) return;
    const fetchInitialData = async () => {
      const { data: prof, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (!profileError) setProfile(prof);
      await fetchCompanies();
    };
    fetchInitialData();
  }, [user]);

  const fetchUsersForCompany = async (companyId, force = false) => {
    if (companyUsers[companyId] && !force) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, name, email, phone, active, is_admin, is_global_admin, confirmed')
      .eq('company_id', companyId);
    if (!error) setCompanyUsers(prev => ({ ...prev, [companyId]: data }));
  };

  const handleResend = async email => {
    const { error } = await supabase.auth.resend(
      { type: 'signup', email },
      { redirectTo: `${window.location.origin}/auth/callback` },
    );
    if (error) alert(`Error: ${error.message}`)
      else alert(`Confirmation email resent to ${email}`)
    }

  const toggleCompanyActive = async (companyId, currentStatus) => {
    if (companyId === profile.company_id) return alert("Cannot deactivate own company");
    const { error } = await supabase
      .from('companies')
      .update({ active: !currentStatus })
      .eq('company_id', companyId);
    if (!error) fetchCompanies();
  };

  const toggleUserActive = async (userId, currentStatus, companyId) => {
    if (userId === user.id) return alert("Cannot deactivate yourself");
    const { error } = await supabase
      .from('profiles')
      .update({ active: !currentStatus })
      .eq('user_id', userId);
    if (!error) fetchUsersForCompany(companyId, true);
    else alert(error.message);
  };

  const handleCreateCompany = async () => {
    if (!newCompany.name || !newCompany.address) return alert("Fill in all fields");
    const { error } = await supabase.rpc('create_new_company', {
      input_name: newCompany.name,
      input_address: newCompany.address,
    });
    if (error) return alert("Error creating company: " + error.message);
    setNewCompany({ name: '', address: '' });
    await fetchCompanies();
  };

  const handleCreateUser = async (companyId) => {
    if (!newUser.email || !newUser.password || !newUser.name || !newUser.phone)
      return alert('Fill in all fields');
  
    // use a session-less client so the admin stays logged in
    const { data, error } = await createEphemeralClient().auth.signUp({
      email: newUser.email,
      password: newUser.password,
      // ⬇️ keep ONLY what you need for JWT / RLS
      options: {
        data: {
          company_id: companyId,
          is_admin:       newUser.is_admin,
          is_global_admin:newUser.is_global_admin,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error || !data?.user)
      return alert("Auth error: " + (error?.message ?? 'unknown'));
  
    // 1️⃣  create the profile row right away (confirmed = false)
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert({
        user_id: data.user.id,
        company_id: companyId,
        name: newUser.name,
        phone: newUser.phone,
        email: newUser.email,
        is_admin: newUser.is_admin,
        is_global_admin: newUser.is_global_admin,
        active: true,
        confirmed: false,      // ⬅️ becomes true in AuthCallback after the click
      }, { onConflict: 'user_id' });
  
    if (upsertError)
      return alert("Profile creation failed: " + upsertError.message);
  
    alert(data.session
      ? 'User created. They can log in now.'
      : 'User invited. They must confirm their email before activation.');
    fetchUsersForCompany(companyId, true);
    setNewUser({ name: '', phone: '', email: '', password: '', is_admin: false, is_global_admin: false });
    setModalState({ companyId: null, mode: null, previousVersionId: null });
  };

  const handleUpdateCompany = async () => {
    if (!editCompany.name || !editCompany.address) return alert("Fill in all fields");
    const { error } = await supabase
      .from('company_versions')
      .insert([{ company_id: modalState.companyId, name: editCompany.name, address: editCompany.address, previous_version_id: modalState.previousVersionId }]);
    if (error) return alert("Error updating company: " + error.message);
    setModalState({ companyId: null, mode: null, previousVersionId: null });
    await fetchCompanies();
  };

  const handleSendReset = async (email) => {
    if (!email) return alert("No email found for this user");
  
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,  // 🔑
    });
    if (error) return alert("Error sending reset email: " + error.message);
  
    alert("Password reset email sent to " + email);
  };


  return (
    <div className="portal">
    <AppHeader />
    <div className="settings-screen">
      <div className="settings-header">
        <h1>{isGlobalAdmin || isCompanyAdmin ? 'Team & companies' : 'My account'}</h1>
      </div>

      {isGlobalAdmin && (
        <div className="global-admin-panel">
          <h2>Company Panel</h2>
          <div className="new-company-form">
            <input placeholder="Company Name" value={newCompany.name} onChange={e => setNewCompany({ ...newCompany, name: e.target.value })} />
            <input placeholder="Company Address" value={newCompany.address} onChange={e => setNewCompany({ ...newCompany, address: e.target.value })} />
            <button onClick={handleCreateCompany}>Create Company</button>
          </div>
        </div>
      )}

      <h3>{isGlobalAdmin ? 'All Companies' : 'Your Company Users'}</h3>
      <ul className="company-list">
        {companies.map(c => (
          <li key={c.company_id} className="company-list-item">
            <div className="company-row">
              <button onClick={() => { fetchUsersForCompany(c.company_id); setExpandedCompanyId(expandedCompanyId === c.company_id ? null : c.company_id); }}>
                {expandedCompanyId === c.company_id ? '▾' : '▸'}
              </button>
              <div className="company-info">
                <strong>{c.name}</strong> — {c.address} — {c.company_active ? 'Active' : 'Inactive'}
              </div>
              <div className="company-actions">
                {(isGlobalAdmin || isCompanyAdmin) && (
                  <>
                    <button onClick={() => setModalState({ companyId: c.company_id, mode: 'user', previousVersionId: c.company_version_id })}>+ Add user</button>
                    <button title="Edit company" onClick={() => { setModalState({ companyId: c.company_id, mode: 'edit', previousVersionId: c.company_version_id }); setEditCompany({ name: c.name, address: c.address }); }}><FaPencilAlt /></button>
                  </>
                )}
                {isGlobalAdmin && c.company_id !== profile.company_id && (
                  <button onClick={() => toggleCompanyActive(c.company_id, c.company_active)}>{c.company_active ? 'Deactivate' : 'Activate'}</button>
                )}
              </div>
            </div>

            {expandedCompanyId === c.company_id && companyUsers[c.company_id] && (
              <ul className="user-list">
                {companyUsers[c.company_id].map(u => (
                  <li key={u.user_id} className="user-list-item">
                    {editingUser === u.user_id ? (
                      /* ───── edit mode ───── */
                      <>
                        <input value={editForm.name}  onChange={e => setEditForm({ ...editForm, name:e.target.value })}/>
                        <input value={editForm.email} onChange={e => setEditForm({ ...editForm, email:e.target.value })}/>
                        <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone:e.target.value })}/>
                        {(isCompanyAdmin || isGlobalAdmin) && editingUser !== user.id && (
                          <label>
                            <input type="checkbox"
                                    checked={editForm.is_admin}
                                    onChange={e => setEditForm({ ...editForm, is_admin:e.target.checked })}/>
                            Admin
                          </label>
                        )}
                        <button onClick={() => saveUserEdits(c.company_id)}>Save</button>
                        <button onClick={() => setEditingUser(null)}>Cancel</button>
                      </>
                    ) : (
                      /* ───── read-only row ───── */
                      <>
                        {u.name} — {u.email} — {u.phone} — {u.is_admin ? 'Admin' : 'User'}{u.is_global_admin ? ' (Global)' : ''} — {u.active ? 'Active' : 'Inactive'} - {u.confirmed ? 'Confirmed' : 'Unconfirmed'}
                    
                        {/* ✎ edit permission matrix */}
                        {(
                          (isGlobalAdmin && u.user_id !== user.id) ||           // global admin ≠ self
                          (isCompanyAdmin && u.user_id !== user.id) ||          // company admin ≠ self
                          (u.user_id === user.id)                               // regular user editing self
                        ) && (
                          <button onClick={() => openUserEditor(u)}>Edit</button>
                        )}
                      </>
                    )}
                    {!u.confirmed && (isGlobalAdmin || isCompanyAdmin) && (
                      <button onClick={() => handleResend(u.email)}>Resend Confirmation</button>
                    )}
                    {u.confirmed && (isGlobalAdmin || isCompanyAdmin || u.user_id === user.id) && (
                      <button onClick={() => handleSendReset(u.email)}>Reset Password</button>
                    )}
                    {(isGlobalAdmin || isCompanyAdmin) && u.user_id !== user.id && u.confirmed && (
                      <button onClick={() => toggleUserActive(u.user_id, u.active, c.company_id)}>{u.active ? 'Deactivate' : 'Activate'}</button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {modalState.companyId === c.company_id && (
              <div className="modal-overlay">
                <div className="modal-content">
                  {!modalState.mode ? (
                    <>  
                      <h3>Choose Action</h3>
                      <button onClick={() => setModalState({ ...modalState, mode: 'user' })}>Add User</button>
                      <button onClick={() => setModalState({ ...modalState, mode: 'edit' })}>Edit Company</button>
                      <button onClick={() => setModalState({ companyId: null, mode: null, previousVersionId: null })}>Cancel</button>
                    </>
                  ) : null}

                  {modalState.mode === 'user' && (
                    <>  
                      <h3>Add User to {c.name}</h3>
                        <input
                          placeholder="Full Name"
                          value={newUser.name}
                          onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                        />
                        <input
                          placeholder="Phone Number"
                          value={newUser.phone}
                          onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                        />
                        <input
                          placeholder="Email"
                          value={newUser.email}
                          onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                        />
                        <input
                          type="password"
                          placeholder="Password"
                          value={newUser.password}
                          onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                        />
                        <label><input type="checkbox" checked={newUser.is_admin} onChange={e => setNewUser({ ...newUser, is_admin: e.target.checked })} /> Admin</label>
                        {isGlobalAdmin && (
                          <label><input type="checkbox" checked={newUser.is_global_admin} onChange={e => setNewUser({ ...newUser, is_global_admin: e.target.checked })} /> Global Admin</label>
                        )}
                        <div className="modal-buttons">
                          <button onClick={() => handleCreateUser(c.company_id)}>Create User</button>
                          <button onClick={() => setModalState({ companyId: null, mode: null, previousVersionId: null })}>Cancel</button>
                        </div>
                    </>
                  )}

                  {modalState.mode === 'edit' && (
                    <>  
                      <h3>Edit Company</h3>
                      <input placeholder="Company Name" value={editCompany.name} onChange={e => setEditCompany({ ...editCompany, name: e.target.value })} />
                      <input placeholder="Company Address" value={editCompany.address} onChange={e => setEditCompany({ ...editCompany, address: e.target.value })} />
                      <div className="modal-buttons">
                        <button onClick={handleUpdateCompany}>Update</button>
                        <button onClick={() => setModalState({ companyId: null, mode: null, previousVersionId: null })}>Cancel</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

    </div>
    </div>
  );
}
