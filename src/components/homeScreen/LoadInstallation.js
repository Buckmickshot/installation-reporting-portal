// src/services/loadInstallation.js
import { supabase } from "../../relationship/supabaseConfig"
import { getScenarios } from "../constants/Decommissioning"
import { safeQuery } from "../Authentication/SafeQuery";

// else {
//   // 3) found → check most recent installation on this premises
//   const { data: latestInst, error: instErr } = await supabase
//     .from('installation')
//     .select('complete, updated_at')
//     .eq('premises_id', pid)
//     .order('updated_at', { ascending: false })
//     .limit(1)
//     .maybeSingle();
//   if (instErr) {
//     console.error('Installation lookup failed:', instErr);
//     return;
//   }
//   if (latestInst && !latestInst.complete) {
//     // still in-progress → block
//     setAddressConflict(true);
//     return;
//   }

//   // 4) load latest snapshot
//   const { data: hist, error: histErr } = await supabase
//     .from('installation_history')
//     .select('*')
//     .eq('premises_id', pid)
//     .eq('is_latest', true)
//     .single();
//   if (histErr && histErr.code !== 'PGRST116') {
//     console.error('History lookup failed:', histErr);
//   }

//   // 5) load all docs
//   const { data: docs, error: docsErr } = await supabase
//     .from('building_documents')
//     .select('file_url, file_name, doc_type, doc_date')
//     .eq('premises_id', pid);
//   if (docsErr) console.error('Docs lookup failed:', docsErr);

//   // shape into your formData
//   const buildingDates = {
//     certificateDateFiles: [], certificateDate: '',
//     inspectionDateFiles: [],  inspectionDate: '',
//     handoverDateFiles:   [],  handoverDate: '',
//     statutoryDecDateFiles: [], statutoryDecDate: ''
//   };
//   const statDecs = [];
//   (docs || []).forEach(({ file_url, file_name, doc_type, doc_date }) => {
//     const entry = { url: file_url, name: file_name };
//     switch (doc_type) {
//       case 'certificate':
//         buildingDates.certificateDateFiles.push(entry);
//         buildingDates.certificateDate = doc_date || '';
//         break;
//       case 'inspection':
//         buildingDates.inspectionDateFiles.push(entry);
//         buildingDates.inspectionDate = doc_date || '';
//         break;
//       case 'handover':
//         buildingDates.handoverDateFiles.push(entry);
//         buildingDates.handoverDate = doc_date || '';
//         break;
//       case 'statutory_declaration':
//         buildingDates.statutoryDecDateFiles.push(entry);
//         buildingDates.statutoryDecDate = doc_date || '';
//         break;
//       case 'previous_installation_evidence':
//         statDecs.push(entry);
//         break;
//     }
//   });

//   updateFormData({
//     ductedCount:        hist?.ducted_installed       ?? '',
//     ductedDecomCount:   hist?.ducted_decommissioned  ?? '',
//     nonDuctedCount:     hist?.non_ducted_installed   ?? '',
//     nonDuctedDecomCount:hist?.non_ducted_decommissioned ?? '',
//     buildingDates,
//     statutoryDeclarations: statDecs
//   });
// }

export async function LoadInstallation(installationId, updateFormData, signOut, navigate) {
  /* ------------------ Installation ------------------ */
  const { data: inst, error: instErr } = await safeQuery(
    () => supabase
      .from("installation")
      .select("*")
      .eq("installation_id", installationId)
      .single(),
    { signOut, navigate }
  );

  if (instErr || !inst) {
    console.error("Installation load failed:", instErr);
    return;
  }
  
  updateFormData({
    installationId:          inst.installation_id,
    activityType:            inst.activity_type,
    companyId:               inst.company_id,
  })

  /* 2) Parallel fetches ------------------------------------------------ */
  const [
    consRes,
    premRes,
    docsRes,
    histRes,
    decomRes
  ] = await Promise.all([
    inst.consumer_id
      ? safeQuery(
          () => supabase
                .from("consumer_details")
                .select("*")
                .eq("consumer_id", inst.consumer_id)
                .single(),
          { signOut, navigate }
        )
      : { data: null, error: null },

    inst.premises_id
      ? safeQuery(
          () => supabase
                .from("premises")
                .select("*")
                .eq("premises_id", inst.premises_id)
                .single(),
          { signOut, navigate }
        )
      : { data: null, error: null },

    inst.premises_id
      ? safeQuery(
          () => supabase
                .from("building_documents")
                .select("file_url,file_name,doc_type,doc_date,building_documents_id")
                .eq("premises_id", inst.premises_id),
          { signOut, navigate }
        )
      : { data: [], error: null },
    
    inst.premises_id
      ? safeQuery(
          () => supabase
                .from("installation_history")
                .select("ducted_installed,ducted_decommissioned,non_ducted_installed,non_ducted_decommissioned")
                .eq("premises_id", inst.premises_id)
                .eq("is_latest", true)
                .maybeSingle(),
          { signOut, navigate }
        )
      : { data: [], error: null },

    safeQuery(
      () => supabase
            .from("decommissioning")
            .select("*")
            .eq("installation_id", installationId),
      { signOut, navigate }
    ),
  ]);

  // Hard errors (ignore PGRST116 = no row)
  const fatal = [consRes, premRes, docsRes, histRes, decomRes]
    .find(r => r?.error && r.error.code !== "PGRST116");
  if (fatal) {
    console.error("LoadInstallation fatal:", fatal.error);
    return;
  }

  const cons = consRes?.data ?? null;
  const prem = premRes?.data ?? null;
  const docs = docsRes?.data ?? [];
  const rows = decomRes?.data ?? [];
  const hist = histRes?.data ?? null;

  /* ------------------ Consumer_details ------------------ */
  if (cons) {
    updateFormData({
      firstName  : cons.first_name,
      surname    : cons.last_name,
      clientPhone: cons.phone_number,
      email      : cons.email_address,
    });
  }

  /* ------------------ Premises ------------------ */
  let isResidential = false;
  if (prem) {
    isResidential = prem.premises_type === "residential";
    updateFormData({
      installationAddress: prem.full_address,
      premisesType       : prem.premises_type,
      buildingAgeCheck   : prem.building_age_check,
    });
  }

  const buildingDates = {
    certificateDateFiles   : [],
    certificateDate        : "",
    inspectionDateFiles    : [],
    inspectionDate         : "",
    handoverDateFiles      : [],
    handoverDate           : "",
    statutoryDecDateFiles  : [],
    statutoryDecDate       : "",
  };
  const statutoryDeclarations = [];

  for (const { file_url, file_name, doc_type, doc_date, building_documents_id } of docs) {
    const entry = { url: file_url, name: file_name, id: building_documents_id };
    switch (doc_type) {
      case "certificate":
        buildingDates.certificateDateFiles.push(entry);
        buildingDates.certificateDate = doc_date || "";
        break;
      case "inspection":
        buildingDates.inspectionDateFiles.push(entry);
        buildingDates.inspectionDate = doc_date || "";
        break;
      case "handover":
        buildingDates.handoverDateFiles.push(entry);
        buildingDates.handoverDate = doc_date || "";
        break;
      case "statutory_declaration":
        buildingDates.statutoryDecDateFiles.push(entry);
        buildingDates.statutoryDecDate = doc_date || "";
        break;
      case "previous_installation_evidence":
        statutoryDeclarations.push(entry);
        break;
      default:
        // ignore unknown doc_type
        break;
    }
  }

  if (hist) {
    updateFormData({
      ductedCount        : hist.ducted_installed ?? "",
      ductedDecomCount   : hist.ducted_decommissioned ?? "",
      nonDuctedCount     : hist.non_ducted_installed ?? "",
      nonDuctedDecomCount: hist.non_ducted_decommissioned ?? "",
    });
  }

    /* 6) Decommissioning rows → form shape */
  const products = rows.map(r => {
    const sc  = getScenarios(isResidential).find(s => s.id === r.decom_scenario) || { notes: [] };
    const obj = {
      decommissionScenario: r.decom_scenario,
      brand              : r.brand,
      model              : r.model,
    };
    if (sc.notes.includes(16)) obj.COESRequired = r.COES_required;
    if (sc.notes.includes(17)) obj.VBARequired  = r.VBA_required;
    return obj;
  });

  /* 7) Final batch update ---------------------------------------------- */
  updateFormData({
    buildingDates,
    statutoryDeclarations,
    decommissionedProducts: products,
  });
}