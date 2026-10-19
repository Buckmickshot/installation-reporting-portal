// Loads a saved job back into the wizard's form state.
import { supabase } from '../../relationship/supabaseConfig';
import { getScenarios } from '../constants/Decommissioning';
import { safeQuery } from '../Authentication/SafeQuery';

const DOC_SLOTS = {
  certificate: ['certificateDateFiles', 'certificateDate'],
  inspection: ['inspectionDateFiles', 'inspectionDate'],
  handover: ['handoverDateFiles', 'handoverDate'],
  statutory_declaration: ['statutoryDecDateFiles', 'statutoryDecDate'],
};

/** Returns the installation row (or null if it could not be loaded). */
export async function LoadInstallation(installationId, updateFormData, signOut, navigate) {
  const ctx = { signOut, navigate };
  const res = await safeQuery(
    () => supabase.from('installation').select('*').eq('installation_id', installationId).single(),
    ctx
  );
  if (res.error || !res.data) throw new Error('Job could not be loaded');
  const row = res.data;
  const overview = { job_ref: `VEU-${String(row.job_number ?? '').padStart(6, '0')}` };

  const [consRes, premRes, docsRes, histRes, decomRes] = await Promise.all([
    row.consumer_id
      ? supabase.from('consumer_details').select('*').eq('consumer_id', row.consumer_id).maybeSingle()
      : { data: null },
    row.premises_id
      ? supabase.from('premises').select('*').eq('premises_id', row.premises_id).maybeSingle()
      : { data: null },
    // only the documents linked to *this* job (unlinked ones were removed by the user)
    supabase
      .from('installation_documents')
      .select('building_documents(building_documents_id, file_url, file_name, doc_type, doc_date)')
      .eq('installation_id', installationId),
    row.premises_id
      ? supabase
          .from('installation_history')
          .select('ducted_installed, ducted_decommissioned, non_ducted_installed, non_ducted_decommissioned')
          .eq('premises_id', row.premises_id)
          .eq('is_latest', true)
          .maybeSingle()
      : { data: null },
    supabase.from('decommissioning').select('*').eq('installation_id', installationId),
  ]);

  const fatal = [consRes, premRes, docsRes, histRes, decomRes].find(r => r?.error && r.error.code !== 'PGRST116');
  if (fatal) throw new Error(fatal.error.message);

  const cons = consRes.data;
  const prem = premRes.data;
  const hist = histRes.data;
  const docs = (docsRes.data || []).map(r => r.building_documents).filter(Boolean);
  const saved = row.form_data || {};

  const buildingDates = {
    certificateDateFiles: [], certificateDate: '',
    inspectionDateFiles: [], inspectionDate: '',
    handoverDateFiles: [], handoverDate: '',
    statutoryDecDateFiles: [], statutoryDecDate: '',
  };
  const statutoryDeclarations = [];
  for (const d of docs) {
    const entry = { url: d.file_url, name: d.file_name, id: d.building_documents_id };
    if (d.doc_type === 'previous_installation_evidence') {
      statutoryDeclarations.push(entry);
    } else if (DOC_SLOTS[d.doc_type]) {
      const [filesKey, dateKey] = DOC_SLOTS[d.doc_type];
      buildingDates[filesKey].push(entry);
      buildingDates[dateKey] = d.doc_date || '';
    }
  }

  const isResidential = prem?.premises_type === 'residential';
  // form_data holds the full decommission entries; fall back to table rows for older jobs
  const decommissionedProducts =
    saved.decommissionedProducts?.length
      ? saved.decommissionedProducts
      : (decomRes.data || []).map(r => {
          const sc = getScenarios(isResidential).find(s => s.id === r.decom_scenario) || { notes: [] };
          const obj = { decommissionScenario: r.decom_scenario, brand: r.brand, model: r.model };
          if (sc.notes.includes(16)) obj.COESRequired = r.COES_required;
          if (sc.notes.includes(17)) obj.VBARequired = r.VBA_required;
          return obj;
        });

  updateFormData({
    ...saved,
    installationId: row.installation_id,
    companyId: row.company_id,
    activityType: row.activity_type,
    premisesId: row.premises_id,
    consumerId: row.consumer_id,
    status: row.status,
    jobRef: overview.job_ref || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    firstName: cons?.first_name || '',
    surname: cons?.last_name || '',
    clientPhone: cons?.phone_number || '',
    email: cons?.email_address || '',
    installationAddress: prem?.full_address || '',
    premisesType: prem?.premises_type || null,
    buildingAgeCheck: prem?.building_age_check ?? null,
    buildingDates,
    statutoryDeclarations,
    ductedCount: String(hist?.ducted_installed ?? 0),
    ductedDecomCount: String(hist?.ducted_decommissioned ?? 0),
    nonDuctedCount: String(hist?.non_ducted_installed ?? 0),
    nonDuctedDecomCount: String(hist?.non_ducted_decommissioned ?? 0),
    decommissionedProducts: decommissionedProducts.length
      ? decommissionedProducts
      : [{ decommissionScenario: '', brand: '', model: '' }],
  });

  return row;
}

/** Path of the wizard for a job, e.g. /create-job/activity-6/residential */
export function wizardPath(job) {
  const activity = job.activity_type || 'activity-6';
  const base = job.premises_type ? `/create-job/${activity}/${job.premises_type}` : `/create-job/${activity}`;
  return `${base}/customer?job=${job.installation_id}`;
}
