import React, { useState } from 'react';
import '../JobScreen.css';
import Field from '../../../utils/Field';
import AddressField from '../../../utils/AddressField';
import { useFormData } from '../../../contexts/FormDataContext';
import { useSearch } from '../../../contexts/SearchContext';
import RightSideBar from '../RightSideBar';
import { sectionsConfig } from '../../../utils/SectionsConfig';
import { getScenarios } from '../../constants/Decommissioning';

export default function WorkerScreen() {
    const { formData, updateFormData } = useFormData();
    const { setEntity, setFilters } = useSearch();
    const [activeSection, setActiveSection] = useState(null);

    const { decommissionedProducts = [], installedProducts = [] } = formData;
    const workerTasks = {
      plumber: [],
      electrician: [],
      refrigerantHandler: []
    };

    decommissionedProducts.forEach((prod, idx) => {
      // assume prod.requirements keys match registryMap roles
      if (prod.decommissionScenario) {
        const sc = getScenarios(formData.premisesType === 'residential')
                     .find(s => s.id === prod.decommissionScenario) || {};
        const req = sc.requirements || {};
        if (req.plumber)               workerTasks.plumber.push(`Decommission #${idx+1}`);
        if (req.electrician)           workerTasks.electrician.push(`Decommission #${idx+1}`);
        if (req.refrigerantHandler)    workerTasks.refrigerantHandler.push(`Decommission #${idx+1}`);
      }
    });

    // ▶︎ map each form-field key to the corresponding sectionsConfig key
    const registryMap = {
        licencedPlumberName:    'Licenced Plumber',
        registeredPlumberName:  'Registered Plumber',
        electricianName:        'Electrician',
        refrigerantHandlerName: 'Refrigerant Handler',
      };
      
      const handleFieldChange = (key, value) => {
        updateFormData({ [key]: value });
      
        const sectionKey = registryMap[key];
        if (sectionKey) {
          const cfg = sectionsConfig[sectionKey];
          setEntity(cfg.table);
          setFilters({ [cfg.fields[key]]: value });
          setActiveSection(sectionKey);
        }
      };
      
      const handleUseRecord = (title, rec) => {
        const cfg = sectionsConfig[title]        // now title is e.g. 'Licenced Plumber'
        const patch = {}
        Object.entries(cfg.fields).forEach(([formKey, col]) => {
          patch[formKey] = rec[col] ?? ''
        })
        updateFormData(patch)
        setActiveSection(null)
      }
  
    return (
      <div className="job-layout-container">
        <div className="create-job-content">
          <div className="create-job-form">
  
            {/* ─── Licenced Plumber ───────────────────────── */}
            <h2 className="section-header">
              Licenced Plumber Details
              {/* you can keep your asterisk-logic here */}
            </h2>
              {workerTasks.plumber.length > 0 && (
                <p className="assignment-line">
                  <strong>Assigned Tasks:</strong>{' '}
                  {workerTasks.plumber.join(', ')}
                </p>
              )}
            <Field
              label="Name"
              value={formData.licencedPlumberName}
              onChange={v => handleFieldChange('licencedPlumberName', v)}
            />
            <Field
              label="Company Name"
              value={formData.licencedPlumberCompanyName}
              onChange={v => handleFieldChange('licencedPlumberCompanyName', v)}
            />
            <AddressField
              label="Company Address"
              value={formData.licencedPlumberCompanyAddress}
              onChange={val => updateFormData({ licencedPlumberCompanyAddress: val })}
            />
            <Field
              label="Phone"
              value={formData.licencedPlumberPhone}
              onChange={v => handleFieldChange('licencedPlumberPhone', v)}
            />
            <Field
              label="License No"
              value={formData.licencedPlumberLicenseNo}
              onChange={v => handleFieldChange('licencedPlumberLicenseNo', v)}
            />
  
            {/* ─── Registered Plumber ─────────────────────── */}
            <h2 className="section-header">Registered Plumber Details</h2>
            <Field
              label="Name"
              value={formData.registeredPlumberName}
              onChange={v => handleFieldChange('registeredPlumberName', v)}
            />
            <Field
              label="Company Name"
              value={formData.registeredPlumberCompanyName}
              onChange={v => handleFieldChange('registeredPlumberCompanyName', v)}
            />
            <AddressField
              label="Company Address"
              value={formData.registeredPlumberCompanyAddress}
              onChange={val => updateFormData({ registeredPlumberCompanyAddress: val })}
            />
            <Field
              label="Phone"
              value={formData.registeredPlumberPhone}
              onChange={v => handleFieldChange('registeredPlumberPhone', v)}
            />
            <Field
              label="Registration No"
              value={formData.registeredPlumberRegistrationNo}
              onChange={v => handleFieldChange('registeredPlumberRegistrationNo', v)}
            />
  
            {/* ─── Electrician ───────────────────────────── */}
            <h2 className="section-header">Electrician Details</h2>
              {workerTasks.electrician.length > 0 && (
                <p className="assignment-line">
                  <strong>Assigned Tasks:</strong>{' '}
                  {workerTasks.electrician.join(', ')}
                </p>
              )}
            <Field
              label="Name"
              value={formData.electricianName}
              onChange={v => handleFieldChange('electricianName', v)}
            />
            <Field
              label="Company Name"
              value={formData.electricianCompanyName}
              onChange={v => handleFieldChange('electricianCompanyName', v)}
            />
            <AddressField
              label="Company Address"
              value={formData.electricianCompanyAddress}
              onChange={val => updateFormData({ electricianCompanyAddress: val })}
            />
            <Field
              label="Phone"
              value={formData.electricianPhone}
              onChange={v => handleFieldChange('electricianPhone', v)}
            />
            <Field
              label="License No"
              value={formData.electricianLicenseNo}
              onChange={v => handleFieldChange('electricianLicenseNo', v)}
            />
  
            {/* ─── Refrigerant Handler ───────────────────── */}
            <h2 className="section-header">Refrigerant Handler Details</h2>
              {workerTasks.refrigerantHandler.length > 0 && (
                <p className="assignment-line">
                  <strong>Assigned Tasks:</strong>{' '}
                  {workerTasks.refrigerantHandler.join(', ')}
                </p>
              )}
            <Field
              label="Name"
              value={formData.refrigerantHandlerName}
              onChange={v => handleFieldChange('refrigerantHandlerName', v)}
            />
            <Field
              label="Company Name"
              value={formData.refrigerantHandlerCompanyName}
              onChange={v => handleFieldChange('refrigerantHandlerCompanyName', v)}
            />
            <AddressField
              label="Company Address"
              value={formData.refrigerantHandlerCompanyAddress}
              onChange={val => updateFormData({ refrigerantHandlerCompanyAddress: val })}
            />
            <Field
              label="Phone"
              value={formData.refrigerantHandlerPhone}
              onChange={v => handleFieldChange('refrigerantHandlerPhone', v)}
            />
            <Field
              label="License No"
              value={formData.refrigerantHandlerLicenseNo}
              onChange={v => handleFieldChange('refrigerantHandlerLicenseNo', v)}
            />
          </div>
        </div>
  
     {activeSection && (
       <RightSideBar
         sections={{ [activeSection]: sectionsConfig[activeSection].table }}
         // RightSideBar will call onSelect(rec)
         onSelect={(rec) => handleUseRecord(activeSection, rec)}
       />
     )}
      </div>
    );
  }