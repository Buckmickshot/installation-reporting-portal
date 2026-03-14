/**
 * safeQuery
 * ----------
 * Wrap any Supabase call (or chain of calls) with consistent error handling.
 *
 * Usage:
 *   const { data, error } = await safeQuery(
 *     () => supabase.from('installation').select('*'),
 *     { signOut, navigate }
 *   );
 *
 * If an error is returned, the function has already shown an alert
 * (and possibly signed the user out); callers can usually just `return`.
 */
export async function safeQuery(queryFn, { signOut, navigate, on403 } = {}) {
  try {
    const { data, error, status } = await queryFn();

    /* 1) Network / client-side error (no HTTP status) */
    if (error && !status) {
      console.error('Network/client error:', error);
      alert('Network problem. Check your connection and try again.');
      return { data: null, error };
    }

    /* 2) Expired or invalid JWT */
    if (status === 401) {
      alert('Your session has expired. Please log in again.');
      if (signOut) await signOut();
      if (navigate) navigate('/login', { replace: true });
      return { data: null, error };
    }

    /* 3) RLS / permission denied */
    if (status === 403) {
      alert('You no longer have permission to perform this action.');
      if (on403) on403();
      if (signOut) await signOut();
      if (navigate) navigate('/login', { replace: true });
      return { data: null, error };
    }

    /* 4) Resource not found */
    if (status === 404) {
      console.error('Resource not found:', error);
      alert('Required data is missing. Please contact support.');
      return { data: null, error };
    }

    /* 5) Server / SQL error */
    if (status && status >= 500) {
      console.error('Server error:', error);
      alert('Server error. Please try again later.');
      return { data: null, error };
    }

    /* 6) Success (or benign 204) */
    return { data, error: null };
  } catch (err) {
    /* 7) Unexpected runtime error */
    console.error('Unexpected error:', err);
    alert('Unexpected error. Please try again.');
    return { data: null, error: err };
  }
}
