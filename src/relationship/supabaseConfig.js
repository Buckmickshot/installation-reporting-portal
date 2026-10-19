import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const options = {
  auth: { persistSession: true, autoRefreshToken: true },
  db: { schema: 'snapshot' },
};

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
