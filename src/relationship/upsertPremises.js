// src/api/premises.ts
import { supabase } from '../relationship/supabaseConfig'
import { safeQuery } from '../components/Authentication/SafeQuery'

/**
 * Calls your SECURITY DEFINER fn_upsert_premises under the hood,
 * handling create/update/clone or reuse flows in one RPC.
 */
export async function upsertPremises({
  companyInput,
  activityType,
  installationId = null,
  fullAddress    = null,
  premisesType   = null,
  otherFields    = {},
  reuseExisting  = false,
  copyDocs       = false,
  signOut,
  navigate
}) {
  const { data, error } = await safeQuery(
    () => supabase.rpc('fn_upsert_premises', {
      _company_input:  companyInput,
      _activity_type:  activityType,
      _installation:   installationId,
      _full_address:   fullAddress,
      _premises_type:  premisesType,
      _other_fields:   otherFields,
      _reuse_existing: reuseExisting,
      _copy_building_docs:      copyDocs,
    }).single()
    ,{ signOut, navigate }
  )

  if (error) return
  return data
}
