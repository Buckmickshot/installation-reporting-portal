// Persists the whole job wizard to Supabase.
//
// Normalised tables hold the data other jobs reuse (customer, premises,
// building documents, prior-install history, decommissioned products,
// tradespeople). Everything else in the wizard (installed products, workers,
// review, post-install, declaration) is stored in installation.form_data so a
// resumed job comes back exactly as it was left.
import { supabase } from './supabaseConfig';
import { safeQuery } from '../components/Authentication/SafeQuery';
import { upsertPremises } from './upsertPremises';
import { uploadFile, persistFiles, safeName } from './storage';

/** formData keys that live in their own tables or are UI-only — not copied into form_data. */
const NOT_IN_FORM_DATA = new Set([
  'installationId', 'companyId', 'premisesId', 'consumerId', 'activityType', 'status', 'jobRef',
  'createdAt', 'updatedAt', 'invalidFields', 'dateErrors', 'installationLimitError',
  'firstName', 'surname', 'clientPhone', 'email', 'installationAddress', 'premisesType',
  'buildingAgeCheck', 'buildingDates', 'statutoryDeclarations',
  'ductedCount', 'ductedDecomCount', 'nonDuctedCount', 'nonDuctedDecomCount',
]);

const DOC_CONFIGS = [
  { filesKey: 'certificateDateFiles', dateKey: 'certificateDate', docType: 'certificate' },
  { filesKey: 'statutoryDecDateFiles', dateKey: 'statutoryDecDate', docType: 'statutory_declaration' },
  { filesKey: 'inspectionDateFiles', dateKey: 'inspectionDate', docType: 'inspection' },
  { filesKey: 'handoverDateFiles', dateKey: 'handoverDate', docType: 'handover' },
  { filesKey: 'statutoryDeclarations', dateKey: null, docType: 'previous_installation_evidence' },
];

const FOLDER = { previous_installation_evidence: 'building_install_total' };

const WORKER_DIRECTORIES = [
  { table: 'licenced_plumber', prefix: 'licencedPlumber', idCol: 'licence_number', idKey: 'LicenseNo' },
  { table: 'registered_plumber', prefix: 'registeredPlumber', idCol: 'registration_number', idKey: 'RegistrationNo' },
  { table: 'electrician', prefix: 'electrician', idCol: 'licence_number', idKey: 'LicenseNo' },
  { table: 'refrigerant_handler', prefix: 'refrigerantHandler', idCol: 'licence_number', idKey: 'LicenseNo' },
];

async function sha256Hex(file) {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function unwrap({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message || error}`);
  return data;
}

async function saveBuildingDocuments({ formData, installationId, premisesId, ctx }) {
  const dates = formData.buildingDates ?? {};
  const nextDates = { ...dates };
  let nextStatDecs = formData.statutoryDeclarations;
  let statDecDocId = null;

  for (const { filesKey, dateKey, docType } of DOC_CONFIGS) {
    const attachments = dates[filesKey] ?? formData[filesKey] ?? [];
    if (attachments.length === 0) continue;
    const dateISO = dateKey ? dates[dateKey] : null;
    if (dateKey && !dateISO) continue; // a document date is mandatory for building-age evidence

    const stored = [];
    for (const a of attachments) {
      let url;
      let name;
      let hash = null;
      if (a instanceof File) {
        const folder = FOLDER[docType] || 'building_age';
        ({ url } = await uploadFile(`${folder}/${premisesId}/${docType}/${safeName(a.name)}`, a));
        name = a.name;
        hash = await sha256Hex(a);
      } else {
        url = typeof a === 'string' ? a : a.url;
        name = typeof a === 'string' ? url.split('/').pop() : a.name || url.split('/').pop();
      }
      const docId = unwrap(
        await safeQuery(
          () =>
            supabase.rpc('fn_attach_building_document', {
              _installation: installationId,
              _doc_type: docType,
              _file_url: url,
              _file_name: name,
              _doc_date: dateISO,
              _content_hash: hash,
            }),
          ctx
        ),
        'Attaching document'
      );
      stored.push({ url, name, id: docId });
      if (docType === 'statutory_declaration') statDecDocId = docId;
    }
    if (filesKey === 'statutoryDeclarations') nextStatDecs = stored;
    else nextDates[filesKey] = stored;
  }
  return { buildingDates: nextDates, statutoryDeclarations: nextStatDecs, statDecDocId };
}

async function saveWorkerDirectory(formData) {
  for (const w of WORKER_DIRECTORIES) {
    const name = formData[`${w.prefix}Name`]?.trim();
    const licence = formData[`${w.prefix}${w.idKey}`]?.trim();
    if (!name || !licence) continue;
    const { data: existing } = await supabase.from(w.table).select(w.idCol).eq(w.idCol, licence).limit(1);
    if (existing?.length) continue;
    await supabase.from(w.table).insert({
      name,
      company_name: formData[`${w.prefix}CompanyName`] || null,
      company_address: formData[`${w.prefix}CompanyAddress`] || null,
      phone_number: formData[`${w.prefix}Phone`] || null,
      [w.idCol]: licence,
    });
  }
}

/**
 * Saves the wizard. Resolves on success, throws an Error with a readable
 * message on failure. Uploaded files are written back into form state.
 */
export async function save(formData, signOut, updateFormData, navigate) {
  const ctx = { signOut, navigate };
  if (!formData.installationId) throw new Error('No job is open');

  const inst = unwrap(
    await supabase
      .from('installation')
      .select('installation_id, consumer_id, premises_id, status')
      .eq('installation_id', formData.installationId)
      .single(),
    'Loading job'
  );
  const installationId = inst.installation_id;

  /* customer */
  unwrap(
    await safeQuery(
      () =>
        supabase.rpc('fn_set_consumer_details', {
          _installation: installationId,
          _first_name: formData.firstName || null,
          _last_name: formData.surname || null,
          _phone_number: formData.clientPhone || null,
          _email_address: formData.email || null,
          _source_consumer: null,
        }),
      ctx
    ),
    'Saving customer'
  );

  /* premises */
  const prem = await upsertPremises({
    companyInput: formData.companyId,
    activityType: formData.activityType,
    installationId,
    fullAddress: formData.installationAddress || null,
    premisesType: formData.premisesType,
    otherFields: { building_age_check: formData.buildingAgeCheck },
    reuseExisting: false,
    signOut,
    navigate,
  });
  if (!prem?.premises_id) throw new Error('Saving premises failed');
  const premisesId = prem.premises_id;

  /* building-age + previous-install documents */
  const docs = await saveBuildingDocuments({ formData, installationId, premisesId, ctx });

  /* prior installation totals */
  const histPayload = {
    premises_id: premisesId,
    installation_id: installationId,
    ducted_installed: Number(formData.ductedCount) || 0,
    ducted_decommissioned: Number(formData.ductedDecomCount) || 0,
    non_ducted_installed: Number(formData.nonDuctedCount) || 0,
    non_ducted_decommissioned: Number(formData.nonDuctedDecomCount) || 0,
    statutory_declaration_id: docs.statDecDocId,
    statutory_declaration_type: null, // recalculated by trigger
  };
  const { data: latestRow } = await supabase
    .from('installation_history')
    .select('installation_history_id')
    .eq('installation_id', installationId)
    .eq('is_latest', true)
    .maybeSingle();
  unwrap(
    latestRow
      ? await supabase.from('installation_history').update(histPayload).eq('installation_history_id', latestRow.installation_history_id)
      : await supabase.from('installation_history').insert({ ...histPayload, is_latest: true }),
    'Saving installation history'
  );

  /* decommissioned products */
  unwrap(await supabase.from('decommissioning').delete().eq('installation_id', installationId), 'Clearing decommissioning');
  const decomRows = (formData.decommissionedProducts || [])
    .filter(p => p.decommissionScenario || p.brand || p.model)
    .map(p => ({
      installation_id: installationId,
      decom_scenario: p.decommissionScenario || null,
      brand: p.brand || null,
      model: p.model || null,
      COES_required: p.COESRequired ?? null,
      VBA_required: p.VBARequired ?? null,
    }));
  if (decomRows.length) {
    unwrap(await supabase.from('decommissioning').insert(decomRows), 'Saving decommissioned products');
  }

  /* everything else → form_data (files uploaded first) */
  const rest = Object.fromEntries(Object.entries(formData).filter(([k]) => !NOT_IN_FORM_DATA.has(k)));
  const formDataJson = await persistFiles(rest, `jobs/${installationId}/files`);
  unwrap(
    await supabase
      .from('installation')
      .update({
        form_data: formDataJson,
        installation_date: formData.installationDate || null,
      })
      .eq('installation_id', installationId),
    'Saving job details'
  );

  await saveWorkerDirectory(formData).catch(err => console.warn('worker directory not updated', err));

  updateFormData({
    premisesId,
    buildingDates: docs.buildingDates,
    statutoryDeclarations: docs.statutoryDeclarations,
    ...formDataJson,
  });
}
