// src/services/saveDataWeb.js
import { supabase } from "./supabaseConfig"
import { safeQuery } from '../components/Authentication/SafeQuery'
import { upsertPremises } from "./upsertPremises";

async function sha256Hex(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function uploadAndAttach({
  file, docType, dateISO,
  installationId, premisesId,
  signOut, navigate
}) {
  const folder = folderMap[docType] || 'building_age';
  const path = `${folder}/${premisesId}/${docType}/${file.name}`;

  const { error: upErr } = await supabase
    .storage.from('uploads')
    .upload(path, file, { upsert: true });
  if (upErr) throw upErr;

  const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
  const publicURL = urlData.publicUrl;
  const contentHash = await sha256Hex(file);

  const { data: docId, error: rpcErr } = await safeQuery(
    () => supabase.rpc('fn_attach_building_document', {
      _installation: installationId,
      _doc_type: docType,
      _file_url: publicURL,
      _file_name: file.name,
      _doc_date: dateISO,
      _content_hash: contentHash
    }),
    { signOut, navigate }
  );
  if (rpcErr) throw rpcErr;

  return { docId, publicURL, contentHash };
}

const docConfigs = [
  { filesKey: 'certificateDateFiles', dateKey: 'certificateDate', docType: 'certificate' },
  { filesKey: 'statutoryDecDateFiles', dateKey: 'statutoryDecDate', docType: 'statutory_declaration' },
  { filesKey: 'inspectionDateFiles', dateKey: 'inspectionDate', docType: 'inspection' },
  { filesKey: 'handoverDateFiles', dateKey: 'handoverDate', docType: 'handover' },
  { filesKey: 'statutoryDeclarations', dateKey: null, docType: 'previous_installation_evidence' },
];

const folderMap = {
  // all these go under uploads/building_age/…
  certificate: "building_age",
  inspection: "building_age",
  handover: "building_age",
  statutory_declaration: "building_age",
  previous_installation_evidence: "building_install_total",
};

export async function save(formData, signOut, updateFormData, navigate) {
  const handleFilesSelected = (type, filesArray) => {
    updateFormData({
      buildingDates: {
        ...formData.buildingDates,
        [type]: filesArray
      }
    });
  };

  try {
    /* ───────────────── fetch current installation row ───────────────── */
    const { data: installationData, error: fetchErr } = await supabase
      .from('installation')
      .select('installation_id, consumer_id, premises_id, complete')
      .eq('installation_id', formData.installationId)
      .single();

    if (fetchErr || !installationData) throw fetchErr;
    const installationId = installationData.installation_id;

    /* ------------------ Consumer ------------------ */
    let consumerId = installationData.consumer_id

    // 1️⃣ If we don’t yet have a draft row, create one.
    if (!consumerId) {
      const { data: cidRow, error: draftErr } = await safeQuery(
        () => supabase
          .rpc('fn_create_consumer_draft', { _installation: installationId })
          .single(),
        { signOut, navigate }
      )
      if (draftErr || !cidRow) {
        console.error('Could not create consumer draft:', draftErr)
        throw new Error('Could not save consumer')
      }
      consumerId = cidRow
      // fn_create_consumer_draft already wires installation.consumer_id for you
    }

    // 2️⃣ Push your form values (or “copy‐from” another finished consumer)
    const { error: setErr } = await safeQuery(
      () => supabase.rpc('fn_set_consumer_details', {
        _installation: installationId,
        _first_name: formData.firstName,
        _last_name: formData.surname,
        _phone_number: formData.clientPhone,
        _email_address: formData.email,
        _source_consumer: null   // or the uuid to “copy‐from” if you want reuse
      }),
      { signOut, navigate }
    )
    if (setErr) {
      console.error('Could not set consumer details:', setErr)
      throw new Error('Could not save consumer')
    }

    /* ------------------ Premises ------------------ */
    const res = await upsertPremises({
      companyInput: formData.companyId,
      activityType: formData.activityType,
      installationId,
      fullAddress: formData.installationAddress,
      premisesType: formData.premisesType,
      otherFields: { building_age_check: formData.buildingAgeCheck },
      reuseExisting: false,          // bool from modal
      signOut,
      navigate
    });
    if (!res || res.error) return;
    const premisesId = res.premises_id;

    /* ------------------ Building-Age + Previous-Install Docs ------------------ */
    let statDecDocId = null;

    for (const { filesKey, dateKey, docType } of docConfigs) {
      /* gather every attachment (File OR {url,name} OR raw string) */
      const srcDates = formData.buildingDates ?? {};
      const attachments =
        srcDates[filesKey] ?? formData[filesKey] ?? [];
      if (attachments.length === 0) continue;              // nothing to do

      const dateISO = dateKey ? srcDates[dateKey] : null;
      if (dateKey && !dateISO) continue;                   // date mandatory

      /* ONE pass over every attachment */
      for (const a of attachments) {
        let docId;

        if (a instanceof File) {
          // new upload → Storage + RPC
          const { docId: upId, publicURL } = await uploadAndAttach({
            file: a, docType, dateISO,
            installationId, premisesId,
            signOut, navigate
          });
          docId = upId;

          const currentFiles = srcDates[filesKey] ?? formData[filesKey] ?? [];
          const idx = currentFiles.findIndex(
            f => f instanceof File && f.name === a.name && f.size === a.size
          );
          const next = [...currentFiles];
          if (idx >= 0) next[idx] = { url: publicURL, name: a.name, id: docId };
          else next.push({ url: publicURL, name: a.name, id: docId });
          handleFilesSelected(filesKey, next);
        } else {
          // already‑stored URL → just RPC
          const url = typeof a === 'string' ? a : a.url;
          const name = typeof a === 'string' ? url.split('/').pop()
            : (a.name || url.split('/').pop());

          const { data, error: rpcErr } = await safeQuery(
            () => supabase.rpc("fn_attach_building_document", {
              _installation: installationId,
              _doc_type: docType,
              _file_url: url,
              _file_name: name,
              _doc_date: dateISO,
              _content_hash: null                 // URL‑only path
            }),
            { signOut, navigate }
          );
          if (rpcErr) throw rpcErr;
          docId = data;
        }

        if (docType === "statutory_declaration")
          statDecDocId = docId;                  // remember for history row
      }
    }

    /* ------------------ Building Install Limits ------------------ */
    const { data: latestRow } = await supabase
      .from('installation_history')
      .select('installation_history_id')
      .eq('installation_id', installationId)
      .eq('is_latest', true)
      .maybeSingle();

    const histPayload = {
      premises_id: premisesId,           // ← explicit both paths
      installation_id: installationId,       // FK
      ducted_installed: Number(formData.ductedCount) || 0,
      ducted_decommissioned: Number(formData.ductedDecomCount) || 0,
      non_ducted_installed: Number(formData.nonDuctedCount) || 0,
      non_ducted_decommissioned: Number(formData.nonDuctedDecomCount) || 0,
      statutory_declaration_id: statDecDocId
      /* statutory_declaration_type left NULL → trigger 02 recalculates */
    };

    if (latestRow) {
      await supabase
        .from('installation_history')
        .update({ ...histPayload, statutory_declaration_type: null })
        .eq('installation_history_id', latestRow.installation_history_id);
    } else {
      await supabase
        .from('installation_history')
        .insert({ ...histPayload, is_latest: true });
    }

    /* ------------------ Decommissioned Products ------------------ */
    const { error: delErr } = await supabase
      .from('decommissioning')
      .delete()
      .eq('installation_id', installationId);
    if (delErr) throw delErr;

    // 2️⃣ build new rows from formData
    const decomRows = formData.decommissionedProducts.map(prod => ({
      installation_id: installationId,
      decom_scenario: prod.decommissionScenario,   // update key if you renamed it
      brand: prod.brand,
      model: prod.model,
      COES_required: prod.COESRequired ?? null,  // keep existing N/A vs yes/no
      VBA_required: prod.VBARequired ?? null,
    }));

    // 3️⃣ insert and grab the new IDs
    const { error: decErr } = await supabase
      .from('decommissioning')
      .insert(decomRows)
      .select('decom_id');
    if (decErr) throw decErr;
  } catch (err) {
    console.error('Unexpected error in saveDataWeb:', err)
  }
}