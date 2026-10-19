import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, initialAuthFragment } from '../../relationship/supabaseConfig';
import { AuthShell } from '../auth/AuthUi';

// Landing page for links in Supabase Auth emails (password reset, invitations).
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(initialAuthFragment || window.location.hash.slice(1));
    const type = params.get('type');
    const errorCode = params.get('error_code') || params.get('error');
    (async () => {
      if (errorCode) {
        const expired = /expired|otp/i.test(errorCode + (params.get('error_description') || ''));
        return navigate('/forgot-password', {
          replace: true,
          state: { error: expired ? 'That link has expired or has already been used. Request a new one below.' : 'That link is invalid. Request a new one below.' },
        });
      }
      // wait for supabase-js to finish turning the link into a session
      for (let i = 0; i < 20; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) break;
        await new Promise(r => setTimeout(r, 150));
      }
      navigate(type === 'recovery' ? '/reset-password' : '/', { replace: true });
    })();
  }, [navigate]);

  return <AuthShell><p className="auth-sub">Just a moment…</p></AuthShell>;
}
