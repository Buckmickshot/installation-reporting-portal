import React, { useState } from 'react';
import { useFormData } from '../../contexts/FormDataContext';
import './JobScreen.css';

const fieldNameMap = {
  'Title': 'title',
  'First Name': 'firstName',
  'Surname': 'surname',
  'Phone': 'clientPhone',
  'Email': 'email',
  'Installation Address': 'installationAddress',
  
  'Name': {
    'Licensed Plumber Details': 'licensedPlumberName',
    'Registered Plumber Details': 'registeredPlumberName',
    'Electrician Details': 'electricianName',
    'Refrigerant Handler Details': 'refrigerantHandlerName',
  },

  'Company Name': {
    'Licensed Plumber Details': 'licensedPlumberCompanyName',
    'Registered Plumber Details': 'registeredPlumberCompanyName',
    'Electrician Details': 'electricianCompanyName',
    'Refrigerant Handler Details': 'refrigerantHandlerCompanyName',
  },

  'Company Address': {
    'Licensed Plumber Details': 'licensedPlumberCompanyAddress',
    'Registered Plumber Details': 'registeredPlumberCompanyAddress',
    'Electrician Details': 'electricianCompanyAddress',
    'Refrigerant Handler Details': 'refrigerantHandlerCompanyAddress',
  },

  'License No': {
    'Licensed Plumber Details': 'licensedPlumberLicenseNo',
    'Electrician Details': 'electricianLicenseNo',
    'Refrigerant Handler Details': 'refrigerantHandlerLicenseNo',
  },

  'VBA Compliance Certificate Required?': 'VBARequired',
  'VBA Compliance Certificate No': 'VBAComplianceCertificateNo',
  'Registration No': 'registeredPlumberRegistrationNo',
  'Certificate of Electrical Safety Required?': 'COESRequired',
  'Certificate of Electrical Safety No': 'COESNo',
  'Accreditted Person': 'accredittedPerson',
};

function LeftSideBar({ sectionMap }) {
  const { formData } = useFormData();
  const invalidFields = formData.invalidFields || {};
  const sectionNames = Object.keys(sectionMap);
  const firstSection = sectionNames[0] || ''; 
  const [expandedSections, setExpandedSections] = useState({
    ...(firstSection && { [firstSection]: true }),
  });

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const scrollToField = (fieldId) => {
    const element = document.getElementById(fieldId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const resolveKey = (field, section) => {
    const mapped = fieldNameMap[field];
    if (typeof mapped === 'object') return mapped[section];
    return mapped;
  };

  return (
    <div className="sidebar-left">
      <div className="sidebar-header">Form Sections</div>
      <div className="sidebar-content">
        {Object.entries(sectionMap).map(([sectionName, fields]) => {
          const sectionErrors = invalidFields[sectionName] || {};
          const hasErrors = Object.keys(sectionErrors).length > 0;
          const isFilled = (val) => val !== '' && val !== null && val !== undefined;
          
          const allFieldsFilled = fields.every((field) => {
            const key = resolveKey(field, sectionName);
            return isFilled(formData[key]);
          });

          const sectionClass = hasErrors
            ? 'invalid'
            : allFieldsFilled
            ? 'valid'
            : '';

          return (
            <div key={sectionName} className="sidebar-section-wrapper">
              <div className={`sidebar-section ${sectionClass}`}>
                <span
                  className="arrow"
                  onClick={() => toggleSection(sectionName)}
                >
                  {expandedSections[sectionName] ? '▼ ' : '▶  '}
                </span>
                <span
                  className="sidebar-section-title"
                  onClick={() => scrollToField(sectionName.toLowerCase().replace(/\s+/g, '-'))}
                >
                  {sectionName}
                </span>
              </div>

              {expandedSections[sectionName] && (
                <ul className="error-list">
                  {fields.map((field) => {
                    const key = resolveKey(field, sectionName);
                    const error = sectionErrors[field];
                    const value = formData[key];
                    return (
                      <li
                        key={field}
                        className={`sidebar-field ${
                          error ? 'invalid' : value ? 'valid' : ''
                        }`}
                        onClick={() =>
                          scrollToField(`${sectionName}-${field}`.replace(/\s+/g, '').toLowerCase())
                        }
                      >
                        {field}
                        {error && <span className="sidebar-error-msg"> – {error}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LeftSideBar;