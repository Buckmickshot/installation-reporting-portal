import { supabase } from "../../relationship/supabaseConfig"

/**
 * Fetches the current user’s profile & company info and returns:
 * {
 *   company_id,
 *   is_admin,
 *   is_global_admin,
 *   profile_active,
 *   company_name,
 *   company_address,
 *   company_active
 * }
 */
export async function status() {
  // 1) get current session & user
  const {
    data: { session },
    error: sessionErr
  } = await supabase.auth.getSession()
  if (sessionErr) throw sessionErr

  const user = session?.user
  if (!user) throw new Error('Not authenticated')

  // 2) fetch profile row (including admin flags & active)
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('company_id, active, is_admin, is_global_admin')
    .eq('user_id', user.id)
    .single()
  if (profileErr) throw profileErr

  // 3) fetch company row (including name, address & active)
  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .select('active')
    .eq('company_id', profile.company_id)
    .single()
  if (companyErr) throw companyErr

  // 4) return combined info
  return {
    company_id:       profile.company_id,
    is_admin:         profile.is_admin,
    is_global_admin:  profile.is_global_admin,
    profile_active:   profile.active,
    company_active:   company.active
  }
}
