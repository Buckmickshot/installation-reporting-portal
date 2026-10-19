import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const options = {
  auth: { persistSession: true, autoRefreshToken: true },
  db: { schema: 'snapshot' },
};

// The auth redirect (e.g. a password-reset link) arrives as a URL fragment. Capture it
// before supabase-js consumes and clears it, so the callback page knows what kind of link it was.
export const initialAuthFragment = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, options);

/**
 * A throw-away client that never stores a session. Used when an admin creates
 * a user with auth.signUp, so the admin's own session is not replaced by the
 * new user's.
 */
export function createEphemeralClient() {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    ...options,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'ephemeral-signup' },
  });
}
