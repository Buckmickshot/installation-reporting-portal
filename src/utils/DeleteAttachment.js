// utils/deleteAttachment.ts
import { supabase } from '../relationship/supabaseConfig'
import { safeQuery } from '../components/Authentication/SafeQuery'

export default async  function deleteAttachment({
  installationId,
  docId,
  signOut,
  navigate
}) {
  /* 1️⃣ unlink from this installation */
  const { error } = await safeQuery(
    () => supabase
          .from('installation_documents')
          .delete()
          .eq('installation_id', installationId)
          .eq('building_documents_id', docId),
    { signOut, navigate }
  )

  if (error) throw error             // surfaces any RLS failure
}
