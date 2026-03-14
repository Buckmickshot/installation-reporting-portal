import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../relationship/supabaseConfig'

// …unchanged imports…
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const params         = new URLSearchParams(window.location.hash.slice(1));
      const access_token   = params.get('access_token');
      const refresh_token  = params.get('refresh_token');
      const type           = params.get('type');

      if (!access_token || !refresh_token) return navigate('/login');

      const { error: sessErr } = await supabase.auth.setSession({ access_token, refresh_token });
      if (sessErr) return navigate('/login');

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return navigate('/login');

      /* redirect */
      navigate(type === 'recovery' ? '/reset-password' : '/');
    })();
  }, []);

  return <p>Completing login…</p>;
}