import React, { useState, useMemo, useEffect } from 'react';
import '../JobScreen.css';
import Field from '../../../utils/Field';
import AddressField from '../../../utils/AddressField';
import RadioField from '../../../utils/RadioField';
import DateField from '../../../utils/DateField';
import { useFormData } from '../../../contexts/FormDataContext';
import CollapsibleSection from '../../../utils/CollapsibleSection';
import { FaExclamationTriangle } from 'react-icons/fa';
import LeftSideBar from '../LeftSideBar';
import RightSideBar from '../RightSideBar';
import { useSearch } from '../../../contexts/SearchContext';
import { sectionsConfig } from '../../../utils/SectionsConfig';
import FileUploadField from '../../../utils/FileUploadField';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../relationship/supabaseConfig';
import Modal from '../../../utils/Modal';
import { useAuth } from '../../../contexts/AuthProvider'
import { safeQuery } from '../../Authentication/SafeQuery';
import { upsertPremises } from '../../../relationship/upsertPremises';
import deleteAttachment from '../../../utils/DeleteAttachment'
import { useRef } from 'react';

const BUILDING_DATE_ERROR =
  'Building must be ≥ 2 years old to be eligible for VEEC installation. You cannot continue with this form.';

const DOCUMENT_DATE_MAP = {
  'Certificate of Occupancy (or Final Inspection Certificate)': 'certificateDate',
  'Final Inspection Notice / Practical Completion Certificate': 'inspectionDate',
  'Council-Issued Building Permit “Completion” Record': 'handoverDate',
  'Statutory Declaration + Supporting Evidence': 'statutoryDecDate',
};

const DOCUMENT_TYPES = Object.keys(DOCUMENT_DATE_MAP);

export default function CustomerScreen() {
  const navigate = useNavigate();
  const { signOut } = useAuth()
  const { formData, updateFormData, resetFormData, updateInvalidFields } = useFormData();
  const { setEntity, setFilters } = useSearch();
  const isRes = formData.premisesType === 'residential';
  const [showHistory, setShowHistory] = useState(false)
  const [historyList, setHistoryList] = useState([])
  const [addressConflict, setAddressConflict] = useState(false);
  const [pendingReuse, setPendingReuse] = useState(null);
  const didMountRef = useRef(false);
  const [conflictingInstalls, setConflictingInstalls] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [loadingHist, setLoadingHist] = useState(false);

  // ─── compute all the caps ─────────────────────────────────────────
  const ductedMax = isRes ? 1 : 5;
  const ductedDecomMax = isRes ? 1 : 3;
  const nonDuctedMax = isRes ? 5 : 10;
  const nonDuctedDecomMax = isRes ? 2 : 7;

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const formKeyToSection = useMemo(() => {
    const map = {};
    Object.entries(sectionsConfig).forEach(([section, cfg]) => {
      Object.keys(cfg.fields).forEach(key => {
        map[key] = section;
      });
    });
    return map;
  }, []);

  async function loadFullHistory() {
    if (!formData.premisesId) return;
    setLoadingHist(true);

    // 1) get all finished installs for this premises
    const { data: finishedInstalls, error: finErr } = await safeQuery(
      () => supabase
        .from('installation')
        .select('installation_id')
        .eq('premises_id', formData.premisesId)
        .eq('complete', true),
      { signOut, navigate }
    );
    if (finErr) { console.error(finErr); setLoadingHist(false); return; }

    const ids = (finishedInstalls ?? []).map(r => r.installation_id);
    if (!ids.length) { setHistoryList([]); setLoadingHist(false); return; }

    // 2) pull all history rows for those installs
    const { data: hist, error: histErr } = await safeQuery(
      () => supabase
        .from('installation_history')
        .select('installation_history_id, created_at, ducted_installed, ducted_decommissioned, non_ducted_installed, non_ducted_decommissioned, statutory_declaration_type, installation_id')
        .in('installation_id', ids)
        .order('created_at', { ascending: false }),
      { signOut, navigate }
    );
    if (histErr) { console.error(histErr); setLoadingHist(false); return; }

    setHistoryList(hist || []);
    setLoadingHist(false);
  }

  const showReuseModal = async (
    premisesId,
    address,
    type
  ) => {
    // fetch docs + history in parallel, bail on any error
    const [docsRes, histRes] = await Promise.all([
      safeQuery(
        () => supabase
          .from('building_documents')
          .select('building_documents_id, file_url, file_name, doc_type, doc_date')
          .eq('premises_id', premisesId),
        { signOut, navigate }
      ),
      safeQuery(
        () => supabase
          .from('installation_history')
          .select('ducted_installed, ducted_decommissioned, non_ducted_installed, non_ducted_decommissioned')
          .eq('premises_id', premisesId)
          .eq('is_latest', true)
          .maybeSingle(),
        { signOut, navigate }
      )
    ]);
    if (docsRes.error || histRes.error) return;

    setPendingReuse({
      premisesId,
      address,
      type,
      docs: docsRes.data ?? [],
      history: histRes.data ?? {}
    });
  };

  const handleSelect = async (rec) => {
    const installationId = formData.installationId
    // 0️⃣ re-fetch the current installation row to get the up-to-date consumer_id
    if (rec.consumer_id) {
      const { data: inst, error: instErr } = await safeQuery(
        () => supabase
          .from('installation')
          .select('consumer_id')
          .eq('installation_id', installationId)
          .single(),
        { signOut, navigate }
      )
      if (instErr) {
        console.error('Could not fetch installation:', instErr)
        return
      }
      let consumerId = inst.consumer_id

      // 1️⃣ ensure a draft exists
      if (!consumerId) {
        const { data: cid, error: draftErr } = await safeQuery(
          () => supabase
            .rpc('fn_create_consumer_draft', { _installation: installationId })
            .single(),
          { signOut, navigate }
        )
        if (draftErr || !cid) {
          console.error('Could not create consumer draft:', draftErr)
          return
        }
        consumerId = cid
        updateFormData({ consumerId })
      }

      // 2️⃣ copy the finished customer into your draft
      const { error: copyErr } = await safeQuery(
        () => supabase.rpc('fn_set_consumer_details', {
          _installation: installationId,
          _first_name: null,
          _last_name: null,
          _phone_number: null,
          _email_address: null,
          _source_consumer: rec.consumer_id
        }),
        { signOut, navigate }
      )
      if (copyErr) {
        console.error('Could not copy customer data:', copyErr)
        return
      }

      updateFormData({
        consumerId,
        firstName: rec.first_name,
        surname: rec.last_name,
        clientPhone: rec.phone_number,
        email: rec.email_address
      })
    } else if (rec.premises_id) {
      await showReuseModal(
        rec.premises_id,
        rec.full_address || formData.installationAddress,
        rec.premises_type
      );
    }
  }

  const confirmReuse = async () => {
    const { address, type, docs, history } = pendingReuse;

    // 1️⃣ re-link the installation to the chosen premises
    const res = await upsertPremises({
      companyInput: formData.companyId,
      activityType: formData.activityType,
      installationId: formData.installationId,
      fullAddress: pendingReuse.address,
      premisesType: pendingReuse.type,
      otherFields: {},          // optional
      reuseExisting: true,        // ← triggers your “2a” / “5a” branches
      signOut,
      navigate
    })

    if (!res) return
    const { premises_id } = res

    // 2️⃣ hydrate formData with all the fetched values
    updateFormData({
      premisesId: premises_id,
      installationAddress: address,
      premisesType: type,
      ductedCount: history.ducted_installed ?? '',
      ductedDecomCount: history.ducted_decommissioned ?? '',
      nonDuctedCount: history.non_ducted_installed ?? '',
      nonDuctedDecomCount: history.non_ducted_decommissioned ?? '',
      buildingDates: docs.reduce((acc, d) => {
        const mapFiles = {
          certificate: 'certificateDateFiles',
          inspection: 'inspectionDateFiles',
          handover: 'handoverDateFiles',
          statutory_declaration: 'statutoryDecDateFiles',
          previous_installation_evidence: 'statutoryDeclarations'
        };
        const mapDates = {
          certificate: 'certificateDate',
          inspection: 'inspectionDate',
          handover: 'handoverDate',
          statutory_declaration: 'statutoryDecDate'
        };
        const filesKey = mapFiles[d.doc_type];
        if (!acc[filesKey]) acc[filesKey] = [];
        acc[filesKey].push({ url: d.file_url, name: d.file_name });
        const dateKey = mapDates[d.doc_type];
        if (dateKey) acc[dateKey] = d.doc_date;
        return acc;
      }, {})
    });

    const copyingEverything =
      selectedDocs.size === pendingReuse.docs.length &&
      selectedDocs.size > 0;                   // at least one file ticked

    if (copyingEverything) {
      await safeQuery(
        () => supabase.rpc('fn_link_latest_docs_for_premises', {
          _installation: formData.installationId,
          _premises: premises_id         // from upsert result
        }),
        { signOut, navigate }
      );
    } else if (selectedDocs.size > 0) {
      await Promise.all(
        [...selectedDocs].map(docId =>
          safeQuery(
            () => supabase.rpc('fn_link_existing_doc', {
              _installation: formData.installationId,
              _doc_id: docId
            }),
            { signOut, navigate }
          )
        )
      );
    }

    // Close the modal
    setSelectedDocs(new Set());
    setPendingReuse(null);
  };

  const handleFilesSelected = (type, filesArray) => {
    updateFormData({
      buildingDates: {
        ...formData.buildingDates,
        [type]: filesArray
      }
    });
  };

  const handleDocDateChange = (type, isoDate) => {
    const dt = isoDate ? new Date(isoDate) : null;
    let error = '';
    if (dt && dt > twoYearsAgo) {
      error = 'Date must be at least two years ago';
    }
    updateFormData({
      buildingDates: {
        ...formData.buildingDates,
        [type]: isoDate
      },
      dateErrors: {
        ...formData.dateErrors,
        [type]: error
      }
    });
  };

  const handleChange = (key, value) => {
    updateFormData({ [key]: value });
    const section = formKeyToSection[key];
    if (!section) return;
    const cfg = sectionsConfig[section];
    setEntity(cfg.table);
    setFilters(prev => ({ ...prev, [cfg.fields[key]]: value }));
  };

  useEffect(() => {
    if (formData.buildingAgeCheck === false) {
      updateInvalidFields("Client Details", "Is building older than 2 years?", BUILDING_DATE_ERROR);
    } else {
      updateInvalidFields("Client Details", "Is building older than 2 years?", null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the listed fields change
  }, [formData.buildingAgeCheck]);

  useEffect(() => {
    const {
      premisesType,
      ductedCount,
      ductedDecomCount,
      nonDuctedCount,
      nonDuctedDecomCount
    } = formData;

    const isRes = premisesType === 'residential';

    const ductedTotal = Number(ductedCount || 0);
    const ductedDecom = Number(ductedDecomCount || 0);
    const nonDuctedTotal = Number(nonDuctedCount || 0);
    const nonDuctedDecom = Number(nonDuctedDecomCount || 0);

    // ─── Ducted Validation ────────────────────────────────
    if (isRes) {
      const errors = [];

      if (ductedTotal > 1) {
        errors.push('Exceeded ducted total: max 1 allowed for residential premises');
      }

      if (ductedDecom > 1) {
        errors.push('Too many decommissioned units: max 1 allowed');
      }

      updateInvalidFields(
        'Previous Installations',
        'Ducted total',
        errors.length > 0 ? errors.join('\n') : null
      );
    } else {
      const errors = [];

      if (ductedTotal > 5) {
        errors.push('Non-residential limit: max 5 ducted installs allowed');
      }

      if (ductedDecom > 3) {
        errors.push('Too many decommissioned ducted installs: max 3 allowed');
      }

      updateInvalidFields(
        'Previous Installations',
        'Ducted total',
        errors.length > 0 ? errors.join('\n') : null
      );
    }

    // ─── Non-Ducted Validation ────────────────────────────────
    if (isRes) {
      const errors = [];

      if (nonDuctedTotal > 5) {
        errors.push('Exceeded non‑ducted total: max 5 allowed for residential premises');
      }

      if (nonDuctedDecom > 2) {
        errors.push('Too many decommissioned units: max 2 allowed');
      }

      updateInvalidFields(
        'Previous Installations',
        'Non‑ducted total',
        errors.length > 0 ? errors.join('\n') : null
      );
    }
    else {
      const errors = [];

      if (nonDuctedTotal > 10) {
        errors.push('Exceeded non‑ducted total: max 10 allowed for non-residential premises');
      }

      if (nonDuctedDecom > 7) {
        errors.push('Too many decommissioned non‑ducted installs: max 7 allowed');
      }

      updateInvalidFields(
        'Previous Installations',
        'Non‑ducted total',
        errors.length > 0 ? errors.join('\n') : null
      );
    }
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the listed fields change
    [
      formData.premisesType,
      formData.ductedCount,
      formData.ductedDecomCount,
      formData.nonDuctedCount,
      formData.nonDuctedDecomCount
    ]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;   // skip the very first render
      return;
    }

    const reconcileAddress = async () => {
      const addr = formData.installationAddress?.trim();
      if (!addr) return;

      let selfPremisesId = formData.premisesId;
      if (!selfPremisesId) {
        const { data: instRow, error: instErr } = await safeQuery(
          () => supabase
            .from('installation')
            .select('premises_id')
            .eq('installation_id', formData.installationId)
            .single(),
          { signOut, navigate }
        );
        if (instErr) return;          // bail on error
        selfPremisesId = instRow?.premises_id ?? null;

        // optional: cache it back into formData so future renders have it
        if (selfPremisesId) {
          updateFormData({ premisesId: selfPremisesId });
        }
      }

      setAddressConflict(false);

      // 1) Any draft‐premises?
      const { data: rawDrafts, error: dErr } = await safeQuery(
        () => supabase
          .from('premises')
          .select('premises_id')
          .eq('company_id', formData.companyId)
          .ilike('full_address', addr)
          .eq('premises_type', formData.premisesType)
          .eq('is_draft', true)
          .neq('premises_id', selfPremisesId || '00000000-0000-0000-0000-000000000000'),
        { signOut, navigate }
      );
      if (dErr) return;
      const draftPrems = rawDrafts ?? [];
      if (draftPrems.length > 0) {
        // fetch the conflicting installation(s)
        const { data: installs = [], error: iErr } = await safeQuery(
          () => supabase
            .from('installation')
            .select('installation_id, updated_at, complete')
            .in('premises_id', draftPrems.map(p => p.premises_id))
            .eq('complete', false)
            .neq('installation_id', formData.installationId),
          { signOut, navigate }
        );
        if (!iErr) {
          setConflictingInstalls(installs);
        }
        setAddressConflict(true);
        return;
      }

      // 2) All finished premises
      const { data: rawFinished, error: fErr } = await safeQuery(
        () => supabase
          .from('premises')
          .select('premises_id, created_at')
          .eq('company_id', formData.companyId)
          .ilike('full_address', addr)
          .eq('premises_type', formData.premisesType)
          .eq('is_draft', false)
          .neq('premises_id', selfPremisesId || '00000000-0000-0000-0000-000000000000'),
        { signOut, navigate }
      );
      if (fErr) return;
      const finishedPrems = rawFinished ?? [];

      if (finishedPrems.length > 0) {
        // only ever reuse the *first* match (or let the user choose)
        const first = finishedPrems[0];
        await showReuseModal(first.premises_id, addr, formData.premisesType);
        return;                     // ← stop normal processing
      }

      // 4) No conflicts → clear block
      setAddressConflict(false);
    };

    reconcileAddress();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the listed fields change
  }, [formData.installationAddress]);

  const handleAddressSelected = address => {
    updateFormData({ installationAddress: address });
  };

  const isClientInvalid = [
    'firstName', 'surname', 'clientPhone', 'email', 'installationAddress',
  ].some(f => !formData[f]);

  const ductedError = formData.invalidFields?.['Previous Installations']?.['Ducted total'];
  const nonDuctedError = formData.invalidFields?.['Previous Installations']?.['Non‑ducted total'];

  return (
    <div className="create-job-content">
      <LeftSideBar
        sectionMap={{
          'Client Details': [
            'First Name', 'Surname', 'Phone', 'Email', 'Installation Address', 'Building Age',
          ],
          'Attachments': [
            'Certificate of Occupancy', 'Final Inspection Notice', 'Council-Issued Building Permit', 'Statutory Declaration'
          ],
          'Previous Installations': [
            'Ducted total',
            'Ducted decom',
            'Non‑ducted total',
            'Non‑ducted decom',
          ],
        }}
      />

      <div className="create-job-form">
        <CollapsibleSection
          id="client-details"
          title="Client Details"
          required={isClientInvalid}
        >
          <Field label="First Name" value={formData.firstName} onChange={v => handleChange('firstName', v)} section="Client Details" />
          <Field label="Surname" value={formData.surname} onChange={v => handleChange('surname', v)} section="Client Details" />
          <Field label="Phone" value={formData.clientPhone} onChange={v => handleChange('clientPhone', v)} section="Client Details" />
          <Field label="Email" value={formData.email} onChange={v => handleChange('email', v)} section="Client Details" />
          <AddressField label="Installation Address" value={formData.installationAddress} onChange={handleAddressSelected} section="Client Details" verified={!!formData.installationAddress} />
          {addressConflict && (
            <div className="warning-note">
              <FaExclamationTriangle className="warning-icon" />
              <p className="warning-text">{"There’s an active, incomplete installation at this address. Please finish or cancel it before proceeding."}</p>
              <button
                className="exit-button"
                onClick={() => {
                  resetFormData();
                  navigate('/');
                }}
              >Exit Form
              </button>

              <Modal onClose={() => setAddressConflict(false)}>
                <h2>Conflicting Installation</h2>
                <ul>
                  {conflictingInstalls.map(inst => (
                    <li key={inst.installation_id} style={{ marginBottom: '1rem' }}>
                      <p><strong>Job ID:</strong> {inst.installation_id}</p>
                      <p>
                        <strong>Last updated:</strong>{' '}
                        {new Date(inst.updated_at).toLocaleString('en-AU', {
                          timeZone: 'Australia/Melbourne',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </p>
                      <button
                        onClick={() => {
                          setAddressConflict(false);
                          navigate(`/jobs/${inst.installation_id}`);
                        }}
                      >
                        Open This Job
                      </button>
                    </li>
                  ))}
                </ul>
                <button onClick={() => setAddressConflict(false)}>Close</button>
              </Modal>
            </div>
          )}

          <RadioField
            label="Is building older than 2 years?"
            name="buildingAgeCheck"
            options={[{ label: 'Yes', value: true }, { label: 'No', value: false }]}
            selectedValue={formData.buildingAgeCheck}
            onChange={v => handleChange('buildingAgeCheck', v)}
            layout="horizontal"
          />

          {formData.buildingAgeCheck === false && (
            <div className="warning-note">
              <FaExclamationTriangle className="warning-icon" />
              <p className="warning-text">{BUILDING_DATE_ERROR}</p>
              <button
                className="exit-button"
                onClick={() => {
                  resetFormData();
                  navigate('/');
                }}
              >Exit Form
              </button>
            </div>
          )}

          {formData.buildingAgeCheck === true && (
            <CollapsibleSection id="attachments" title="Attachments" defaultOpen>
              {DOCUMENT_TYPES.map(docTitle => {
                const dateKey = DOCUMENT_DATE_MAP[docTitle];
                const fileKey = `${dateKey}Files`;
                const error = formData.dateErrors?.[dateKey] || '';
                const isTooRecent = error === 'Date must be at least two years ago';

                return (
                  <CollapsibleSection
                    key={dateKey}
                    id={`doc-${dateKey}`}
                    title={<span style={{ fontSize: '1rem' }}>{docTitle}</span>}
                    defaultOpen={false}
                  >
                    <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#666', margin: '0 0 0.75rem' }}>
                      Upload one or more documents or pictures. Be sure it is clear.
                    </p>

                    <FileUploadField
                      attachments={formData.buildingDates[fileKey] || []}
                      onFilesSelected={files => handleFilesSelected(fileKey, files)}
                      onDelete={async (idx, item) => {
                        // item is { url, name, id } – id only present for server‑side docs
                        if (item.id) {
                          try {
                            await deleteAttachment({
                              installationId: formData.installationId,
                              docId: item.id,
                              signOut,
                              navigate,
                            });
                          } catch (err) {
                            console.error('Could not unlink attachment:', err);
                            return;                 // abort optimistic UI update
                          }
                        }

                        // remove from local state
                        const next = [...(formData.buildingDates[fileKey] || [])];
                        next.splice(idx, 1);
                        handleFilesSelected(fileKey, next);
                      }}
                      accept=".pdf,image/*"
                      multiple
                    />

                    <DateField
                      label="Completion Date"
                      value={formData.buildingDates?.[dateKey] || ''}
                      onChange={iso => handleDocDateChange(dateKey, iso)}
                      section="Client Details"
                      fieldName={`${docTitle} Completion Date`}
                      error={formData.dateErrors?.[dateKey]}
                    />

                    {isTooRecent && (
                      <div className="warning-note" style={{ marginTop: '0.5rem' }}>
                        <FaExclamationTriangle className="warning-icon" />
                        <p className="warning-text">
                          {BUILDING_DATE_ERROR}
                        </p>
                        <button
                          className="exit-button"
                          onClick={() => {
                            resetFormData();
                            navigate('/');
                          }}
                          style={{ marginTop: '0.5rem' }}
                        >
                          Exit Form
                        </button>
                      </div>
                    )}
                  </CollapsibleSection>
                );
              })}
            </CollapsibleSection>
          )}

          <CollapsibleSection id="prev-installs" title="Previous Installations" defaultOpen>
            <p>If the premises has not worked with us before, the totals are default 0.
              Else, the values are autofilled from address typed above.
              You can either confirm these totals are correct by not changing them, or modify them.
              Both require statutory declaration or other relevant evidence
            </p>
            <button
              onClick={async () => {
                await loadFullHistory();
                setShowHistory(true);
              }}
              className="view-history-button"
            >
              View Full Installation History
            </button>

            {showHistory && (
              <Modal onClose={() => setShowHistory(false)}>
                <h2>Installation History for this Premises</h2>

                {loadingHist ? (
                  <p>Loading…</p>
                ) : historyList.length === 0 ? (
                  <p>No history found for this premises.</p>
                ) : (
                  <ul>
                    {historyList.map(entry => {
                      const melbDate = new Date(entry.created_at).toLocaleString('en-AU', {
                        timeZone: 'Australia/Melbourne',
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: false,
                        timeZoneName: 'short',
                      });
                      return (
                        <li key={entry.installation_history_id} style={{ marginBottom: '1rem' }}>
                          <div style={{ fontWeight: 'bold' }}>{melbDate}</div>
                          <div style={{ paddingLeft: '1rem' }}>
                            Ducted Installs: {entry.ducted_installed} ({entry.ducted_decommissioned} decommissioned)
                          </div>
                          <div style={{ paddingLeft: '1rem' }}>
                            Non‑Ducted Installs: {entry.non_ducted_installed} ({entry.non_ducted_decommissioned} decommissioned)
                          </div>
                          <div style={{ paddingLeft: '1rem' }}>
                            Statutory Declaration: {entry.statutory_declaration_type}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Modal>
            )}


            <Field
              label="Total ducted products ever installed"
              type="number"
              min="0"
              max={ductedMax}
              value={formData.ductedCount}
              onChange={v => updateFormData({ ductedCount: v })}
            />
            <Field
              label="Of those, how many were decommissioning (removed)?"
              type="number"
              min="0"
              max={Math.min(ductedDecomMax, Number(formData.ductedCount))}
              value={formData.ductedDecomCount}
              onChange={v => updateFormData({ ductedDecomCount: v })}
            />

            <Field
              label="Total non‑ducted products ever installed"
              type="number"
              min="0"
              max={nonDuctedMax}
              value={formData.nonDuctedCount}
              onChange={v => updateFormData({ nonDuctedCount: v })}
            />
            <Field
              label="Of those, how many were decommissioning (removed)?"
              type="number"
              min="0"
              max={Math.min(nonDuctedDecomMax, Number(formData.nonDuctedCount))}
              value={formData.nonDuctedDecomCount}
              onChange={v => updateFormData({ nonDuctedDecomCount: v })}
            />

            <CollapsibleSection
              id="stat-declarations"
              title={<span style={{ fontSize: '1rem' }}>{"Statutory Declarations"}</span>}
              defaultOpen={false}
            >
              <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#666', margin: '0 0 0.75rem' }}>
                Please upload any documents from the customer that confirms the prior installation totals above.
                (e.g. previous invoices, existing service records, or photographic proof of existing units.)
              </p>

              <FileUploadField
                attachments={formData.statutoryDeclarations || []}
                onFilesSelected={files =>
                  updateFormData({
                    statutoryDeclarations: [
                      ...files,
                    ],
                  })
                }
                accept=".pdf,image/*"
                multiple
              />
            </CollapsibleSection>

            {ductedError && (
              <div className="warning-note">
                <FaExclamationTriangle className="warning-icon" />
                <p className="warning-text" style={{ whiteSpace: 'pre-line' }}>
                  {ductedError}
                </p>
                <button
                  className="exit-button"
                  onClick={() => {
                    resetFormData();
                    navigate('/');
                  }}
                >
                  Exit Form
                </button>
              </div>
            )}

            {nonDuctedError && (
              <div className="warning-note">
                <FaExclamationTriangle className="warning-icon" />
                <p className="warning-text" style={{ whiteSpace: 'pre-line' }}>
                  {nonDuctedError}
                </p>
                <button
                  className="exit-button"
                  onClick={() => {
                    resetFormData();
                    navigate('/');
                  }}
                >
                  Exit Form
                </button>
              </div>
            )}
          </CollapsibleSection>
        </CollapsibleSection>
      </div>

      <RightSideBar
        sections={{
          'Client Details': 'consumer_details',
          'Premises': 'premises',
        }}
        onSelect={handleSelect}
      />

      {/* ── Reuse Confirmation Modal ── */}
      {pendingReuse && (
        <Modal onClose={() => setPendingReuse(null)}>
          <h2>Reuse existing premises?</h2>
          <p><strong>Address:</strong> {pendingReuse.address}</p>
          <p><strong>Type:</strong> {pendingReuse.type}</p>

          <h4>Building Documents</h4>
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={selectedDocs.size === pendingReuse.docs.length}
              indeterminate={
                selectedDocs.size > 0 &&
                selectedDocs.size < pendingReuse.docs.length   // ↔ React 18 supports this
              }
              onChange={e => {
                if (e.target.checked) {
                  // add every doc id
                  setSelectedDocs(new Set(pendingReuse.docs.map(d => d.building_documents_id)));
                } else {
                  setSelectedDocs(new Set());                  // clear them all
                }
              }}
              style={{ marginRight: 6 }}
            />
            Select all
          </label>
          <ul>
            {pendingReuse.docs.map(d => (
              <li key={d.building_documents_id}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedDocs.has(d.building_documents_id)}
                    onChange={e => {
                      const next = new Set(selectedDocs);
                      if (e.target.checked) next.add(d.building_documents_id);
                      else next.delete(d.building_documents_id);
                      setSelectedDocs(next);
                    }}
                    style={{ marginRight: 6 }}
                  />
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                    {d.file_name}
                  </a>&nbsp;({d.doc_type}, {d.doc_date})
                </label>
              </li>
            ))}
          </ul>

          <h4>Installation History</h4>
          <ul>
            <li>Ducted Installed: {pendingReuse.history.ducted_installed} ({pendingReuse.history.ducted_decommissioned} removed)</li>
            <li>Non-Ducted Installed: {pendingReuse.history.non_ducted_installed} ({pendingReuse.history.non_ducted_decommissioned} removed)</li>
          </ul>

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <button onClick={() => setPendingReuse(null)} style={{ marginRight: 8 }}>
              Cancel
            </button>
            <button onClick={confirmReuse}>
              Confirm Reuse
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
