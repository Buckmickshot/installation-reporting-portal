import React, { useState } from 'react';
import '../JobScreen.css';
import Field from '../../../utils/Field';
import AddressField from '../../../utils/AddressField';
import { useFormData } from '../../../contexts/FormDataContext';

function DeclarationScreen() {
    const { formData, updateFormData } = useFormData();
  
    const handleChange = (key, value) => {
      updateFormData({ [key]: value });
    };
  
    const isSectionInvalid = (data, fields) => {
      return fields.some((field) => {
        const value = data[field];
        return value === '' || value === null || value === undefined;
      });
    };
  
    const isClientSectionInvalid = isSectionInvalid(formData, [
      'title', 'firstName', 'surname', 'clientPhone', 'email',
    ]);
  
    const isLicensedPlumberSectionInvalid = isSectionInvalid(formData, [
      'licensedPlumberName',
      'licensedPlumberCompanyName',
      'licensedPlumberCompanyAddress',
      'licensedPlumberPhone',
      'licensedPlumberLicenseNo',
      ...(formData.VBARequired === true ? ['VBAComplianceCertificateNo'] : []),
    ]);
  
    const isRegisteredPlumberSectionInvalid = isSectionInvalid(formData, [
      'registeredPlumberName',
      'registeredPlumberCompanyName',
      'registeredPlumberCompanyAddress',
      'registeredPlumberPhone',
      'registeredPlumberRegistrationNo',
    ]);
  
    const isElectricianSectionInvalid = isSectionInvalid(formData, [
      'electricianName',
      'electricianCompanyName',
      'electricianCompanyAddress',
      'electricianPhone',
      'electricianLicenseNo',
      ...(formData.COESRequired === true ? ['COESNo'] : []),
    ]);
  
    const isRefrigerantSectionInvalid = isSectionInvalid(formData, [
      'refrigerantHandlerName',
      'refrigerantHandlerCompanyName',
      'refrigerantHandlerCompanyAddress',
      'refrigerantHandlerPhone',
      'refrigerantHandlerLicenseNo',
    ]);
  
    const isAccreditedSectionInvalid = isSectionInvalid(formData, [
      'accredittedPerson',
    ]);
  
    return (
      <div className="create-job-content">
        <div className="create-job-form">
          <h1 className="top-section-header">
            Client Details
            <span className={`asterisk ${isClientSectionInvalid ? 'visible' : ''}`}>*</span>
          </h1>


          <Field label="First Name" value={formData.firstName} onChange={(v) => handleChange('firstName', v)} />
          <Field label="Surname" value={formData.surname} onChange={(v) => handleChange('surname', v)} />
          <Field label="Phone" value={formData.clientPhone} onChange={(v) => handleChange('clientPhone', v)} />
          <Field label="Email" value={formData.email} onChange={(v) => handleChange('email', v)} />

          <h2 className="section-header">
            Licensed Plumber Details
            <span className={`asterisk ${isLicensedPlumberSectionInvalid ? 'visible' : ''}`}>*</span>
          </h2>
          <Field label="Name" value={formData.licensedPlumberName} onChange={(v) => handleChange('licensedPlumberName', v)} />
          <Field label="Company Name" value={formData.licensedPlumberCompanyName} onChange={(v) => handleChange('licensedPlumberCompanyName', v)} />
          <AddressField label="Company Address" value={formData.licensedPlumberCompanyAddress} onChange={(val) => updateFormData({ licensedPlumberCompanyAddress: val })} />
          <Field label="Phone" value={formData.licensedPlumberPhone} onChange={(v) => handleChange('licensedPlumberPhone', v)} />
          <Field label="License No" value={formData.licensedPlumberLicenseNo} onChange={(v) => handleChange('licensedPlumberLicenseNo', v)} />
          <Field label="VBA Compliance Certificate No" value={formData.VBAComplianceCertificateNo} onChange={(v) => handleChange('VBAComplianceCertificateNo', v)} />

          <h2 className="section-header">
            Registered Plumber Details
            <span className={`asterisk ${isRegisteredPlumberSectionInvalid ? 'visible' : ''}`}>*</span>
          </h2>
          <Field label="Name" value={formData.registeredPlumberName} onChange={(v) => handleChange('registeredPlumberName', v)} />
          <Field label="Company Name" value={formData.registeredPlumberCompanyName} onChange={(v) => handleChange('registeredPlumberCompanyName', v)} />
          <AddressField label="Company Address" value={formData.registeredPlumberCompanyAddress} onChange={(val) => updateFormData({ registeredPlumberCompanyAddress: val })} />
          <Field label="Phone" value={formData.registeredPlumberPhone} onChange={(v) => handleChange('registeredPlumberPhone', v)} />
          <Field label="Registration No" value={formData.registeredPlumberRegistrationNo} onChange={(v) => handleChange('registeredPlumberRegistrationNo', v)} />

          <h2 className="section-header">
            Electrician Details
            <span className={`asterisk ${isElectricianSectionInvalid ? 'visible' : ''}`}>*</span>
          </h2>
          <Field label="Name" value={formData.electricianName} onChange={(v) => handleChange('electricianName', v)} />
          <Field label="Company Name" value={formData.electricianCompanyName} onChange={(v) => handleChange('electricianCompanyName', v)} />
          <AddressField label="Company Address" value={formData.electricianCompanyAddress} onChange={(val) => updateFormData({ electricianCompanyAddress: val })} />
          <Field label="Phone" value={formData.electricianPhone} onChange={(v) => handleChange('electricianPhone', v)} />
          <Field label="License No" value={formData.electricianLicenseNo} onChange={(v) => handleChange('electricianLicenseNo', v)} />
          <Field label="Certificate of Electrical Safety No" value={formData.COESNo} onChange={(v) => handleChange('COESNo', v)} />

          <h2 className="section-header">
            Refrigerant Handler Details
            <span className={`asterisk ${isRefrigerantSectionInvalid ? 'visible' : ''}`}>*</span>
          </h2>
          <Field label="Name" value={formData.refrigerantHandlerName} onChange={(v) => handleChange('refrigerantHandlerName', v)} />
          <Field label="Company Name" value={formData.refrigerantHandlerCompanyName} onChange={(v) => handleChange('refrigerantHandlerCompanyName', v)} />
          <AddressField label="Company Address" value={formData.refrigerantHandlerCompanyAddress} onChange={(val) => updateFormData({ refrigerantHandlerCompanyAddress: val })} />
          <Field label="Phone" value={formData.refrigerantHandlerPhone} onChange={(v) => handleChange('refrigerantHandlerPhone', v)} />
          <Field label="License No" value={formData.refrigerantHandlerLicenseNo} onChange={(v) => handleChange('refrigerantHandlerLicenseNo', v)} />

          <h2 className="section-header">
            Accredited Person
            <span className={`asterisk ${isAccreditedSectionInvalid ? 'visible' : ''}`}>*</span>
          </h2>
          <Field label="Accreditted Person (if applicable)" value={formData.accredittedPerson} onChange={(v) => handleChange('accredittedPerson', v)} />
        </div>
      </div>
    );
  }

export default DeclarationScreen;