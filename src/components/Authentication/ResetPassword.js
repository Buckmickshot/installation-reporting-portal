import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../relationship/supabaseConfig';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const navigate = useNavigate();

  const handleReset = async () => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      alert('Error updating password: ' + error.message);
      return;
    }

    alert('Password updated successfully! Please log in with your new password.');

    // clear the session so the user re-authenticates
    await supabase.auth.signOut();

    // redirect to the login page
    navigate('/login', { replace: true });
  };

  return (
    <div>
      <h2>Reset Password</h2>
      <input
        type="password"
        value={newPassword}
        placeholder="New password"
        onChange={e => setNewPassword(e.target.value)}
      />
      <button onClick={handleReset} disabled={!newPassword}>
        Set Password
      </button>
    </div>
  );
}
