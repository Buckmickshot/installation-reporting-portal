// Compliance checklist for a VEU Activity 6 job. Computed from the wizard's
// form state plus the field evidence captured for the job. A job can only be
// sent for review / submitted when every required item passes.

const filled = v => v !== undefined && v !== null && `${v}`.trim() !== '';

export function readinessChecklist(formData = {}, evidence = []) {
  const kinds = new Set(evidence.map(e => e.kind));
  const installed = (formData.installedProducts || []).filter(p => filled(p.brand) || filled(p.model));
  const decom = (formData.decommissionedProducts || []).filter(
    p => filled(p.decommissionScenario) || filled(p.brand) || filled(p.model)
  );
  const bd = formData.buildingDates || {};
  const hasBuildingDoc = ['certificate', 'inspection', 'handover', 'statutoryDec'].some(
    k => (bd[`${k}DateFiles`] || []).length > 0 && filled(bd[`${k}Date`])
  );
  const anyCOES = formData.COESRequired === true || decom.some(p => p.COESRequired === true);
  const anyVBA = formData.VBARequired === true || decom.some(p => p.VBARequired === true);

  const items = [
    // Customer & premises
    { group: 'Customer & premises', label: 'Customer name, phone and email', ok: ['firstName', 'surname', 'clientPhone', 'email'].every(k => filled(formData[k])) },
    { group: 'Customer & premises', label: 'Installation address', ok: filled(formData.installationAddress) },
    { group: 'Customer & premises', label: 'Building is 2+ years old, with dated evidence', ok: formData.buildingAgeCheck === true && hasBuildingDoc },

    // Products
    { group: 'Products', label: 'At least one new product recorded', ok: installed.length > 0 },
    { group: 'Products', label: 'Every new product has a registry category', ok: installed.length > 0 && installed.every(p => filled(p.productCategory)) },
    { group: 'Products', label: 'Every new product has a serial number', ok: installed.length > 0 && installed.every(p => filled(p.serialNo)) },
    { group: 'Products', label: 'Each removed product has a decommissioning scenario', ok: decom.every(p => filled(p.decommissionScenario)) },

    // Tradespeople
    { group: 'Tradespeople', label: 'Licensed plumber name and licence', ok: filled(formData.licencedPlumberName) && filled(formData.licencedPlumberLicenseNo) },
    { group: 'Tradespeople', label: 'Electrician name and licence', ok: filled(formData.electricianName) && filled(formData.electricianLicenseNo) },
    { group: 'Tradespeople', label: 'Refrigerant handler name and licence', ok: filled(formData.refrigerantHandlerName) && filled(formData.refrigerantHandlerLicenseNo) },
    ...(anyCOES ? [{ group: 'Tradespeople', label: 'Certificate of Electrical Safety number', ok: filled(formData.COESNo) || filled(formData.coesCertificateNumber) }] : []),
    ...(anyVBA ? [{ group: 'Tradespeople', label: 'VBA compliance certificate number', ok: filled(formData.VBAComplianceCertificateNo) || filled(formData.vbaCertificateNumber) }] : []),

    // Install & evidence
    { group: 'Install evidence', label: 'Installation date', ok: filled(formData.installationDate) },
    { group: 'Install evidence', label: 'Photo of the new unit installed', ok: kinds.has('new_indoor_unit') || kinds.has('new_outdoor_unit') },
    { group: 'Install evidence', label: 'Photo of the new unit nameplate / serial', ok: kinds.has('new_unit_nameplate') },
    ...(decom.length ? [{ group: 'Install evidence', label: 'Photo of the old / removed unit', ok: kinds.has('old_unit') || kinds.has('decommissioned_unit') }] : []),
    { group: 'Install evidence', label: 'Customer signature', ok: kinds.has('customer_signature') },
    { group: 'Install evidence', label: 'Installer signature', ok: kinds.has('installer_signature') },
  ];

  const done = items.filter(i => i.ok).length;
  return { items, done, total: items.length, ready: done === items.length };
}
