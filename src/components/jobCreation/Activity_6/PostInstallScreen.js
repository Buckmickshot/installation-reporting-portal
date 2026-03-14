// src/components/jobCreation/Activity_6/DecommissionScreen.js
import React, { useState } from 'react';
import '../JobScreen.css';
import Field from '../../../utils/Field';
import RadioField from '../../../utils/RadioField';
import CollapsibleSection from '../../../utils/CollapsibleSection';
import { useFormData } from '../../../contexts/FormDataContext';
import LeftSideBar from '../LeftSideBar';
import { getScenarios } from '../../constants/Decommissioning';
import { FaExclamationTriangle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const DECOMMISSION_DEC_ERROR = "Since you have not followed the decommission and disposal requirements, the VEEC application will not be approved"
const INFORMATION_DEC_ERROR = "You have not provide necessary information or documents to the consumers, the VEEC application will not be approved"


export default function DecommissionScreen() {
    const navigate = useNavigate()
    const { formData, updateFormData, resetFormData } = useFormData();

    const isResidential = !!formData.isResidential;
    // 5‑year warranty rule – residential + affected Activity 6 sub‑types from 31 Mar 2025
    const AFFECTED_CODES = new Set(['6A', '6B', '6D', '6F']);
    const hasAffectedProduct = (formData.installedProducts || []).some(
    (p) => AFFECTED_CODES.has(p?.productCategory)
    );
    const fiveYearWarrantyRequired =
    isResidential &&
    hasAffectedProduct

    // 1) Build scenario list based on isResidential
    const scenarios = React.useMemo(
        () => getScenarios(formData.isResidential),
        [formData.isResidential]
    );
    
    const VEU_Code_Conduct = 'https://www.esc.vic.gov.au/victorian-energy-upgrades/participating-veu-program/meeting-your-obligations-under-veu-code-conduct';

    const coesList = formData.decommissionedProducts
        .map((p, i) => ({ idx: i, prod: p }))
        .filter(({ prod }) => prod.COESRequired);
    const vbaList = formData.decommissionedProducts
        .map((p, i) => ({ idx: i, prod: p }))
        .filter(({ prod }) => prod.VBARequired);

    // Do we show the Certificates panel at all?
    const needsCertificates = coesList.length > 0 || vbaList.length > 0;

    // 2) Indices of products requiring COES or VBA
    const coesIndices = formData.decommissionedProducts
        .map((p, i) => (p.COESRequired ? i : null))
        .filter((i) => i != null);
    const vbaIndices = formData.decommissionedProducts
        .map((p, i) => (p.VBARequired ? i : null))
        .filter((i) => i != null);

    // 3) Validation flags
    const disposalInvalid = [
        'decommissionMethod',
        'removed',
        ...(formData.removed === false ? ['notRemovedReason'] : []),
        'ductReplacement',
    ].some((key) => {
        const v = formData[key];
        return v === '' || v == null;
    });

    const coesSectionInvalid =
        coesIndices.length > 0 &&
        (!formData.coesCertificateNumber ||
        !Array.isArray(formData.coesAppliedProducts) ||
        formData.coesAppliedProducts.length === 0);

    const vbaSectionInvalid =
        vbaIndices.length > 0 &&
        (!formData.vbaCertificateNumber ||
        !Array.isArray(formData.vbaAppliedProducts) ||
        formData.vbaAppliedProducts.length === 0);

    // 4) Toggle a checkbox in an array field
    const toggleCheckbox = (fieldKey, idx) => {
        const arr = Array.isArray(formData[fieldKey]) ? formData[fieldKey] : [];
        if (arr.includes(idx)) {
        updateFormData({ [fieldKey]: arr.filter((i) => i !== idx) });
        } else {
        updateFormData({ [fieldKey]: [...arr, idx] });
        }
    };

    const handleFilesSelected = (filesArray) => {
        updateFormData({
          invoice: filesArray,
        });
      };
      
      const handleChange = (key, value) => {
        updateFormData({ [key]: value });
      };

    // 5) LeftSideBar needs every form key in this one section
    const allFieldKeys = formData.decommissionedProducts
        .flatMap((_, i) => [
        `decommissionedProducts.${i}.decommissionScenario`,
        `decommissionedProducts.${i}.brand`,
        `decommissionedProducts.${i}.model`,
        ])
        .concat([
        'coesCertificateNumber',
        'vbaCertificateNumber',
        'decommissionMethod',
        'removed',
        ...(formData.removed === false ? ['notRemovedReason'] : []),
        'ductReplacement',
        ]);

    return (
        <div className="job-layout-container">
            <LeftSideBar
            sectionMap={{
                'Decommissioning & Disposal Details': allFieldKeys,
            }}
        />

        <div className="create-job-content">
            <div className="create-job-form">
                <CollapsibleSection id="post-install" title="Post‑Install Information" defaultOpen>
                    <p className="mb-2 text-sm text-gray-700">On completion of the installation, provide the consumer with:</p>
                    <ul className="list-disc ml-6 text-sm text-gray-700 space-y-1">
                        <li>Tax invoice or proof of purchase.</li>
                        <li>Completed VEEC Assignment Form.</li>
                        <li>Victorian Building Authority (VBA) Compliance Certificate and/or Certificate of Electrical Safety (as applicable).</li>
                        <li>Manufacturer’s instructions and warranty.</li>
                        <li>Information required by the{" "}
                            <a
                            href={VEU_Code_Conduct}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                            >
                            VEU Code of Conduct
                            </a>{" "}
                                , including dispute resolution information, manufacturer’s instructions,
                                and contact details of the accredited person and/or scheme participant who undertook the installation.</li>
                        {fiveYearWarrantyRequired &&
                        <li>
                            A minimum 5-year warranty against defects document for products installed
                            containing contact details of who to contact regarding product warranty
                            obligations in Australia in the event of a product failure.
                        </li>}
                    </ul>

                    <RadioField
                        label="Have you provided all required post‑install information/documents?"
                        name="postInstallDocsGiven"
                        options={[
                        { label: 'Yes', value: true },
                        { label: 'No', value: false },
                        ]}
                        selectedValue={formData.postInstallinfoGiven}
                        onChange={(v) => handleChange('postInstallinfoGiven', v)}
                        layout="horizontal"
                    />

                    {formData.postInstallinfoGiven === false && (
                        <div className="warning-note">
                            <FaExclamationTriangle className="warning-icon" />
                            <p className="warning-text">
                            {INFORMATION_DEC_ERROR}
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


                {needsCertificates && (
                    <CollapsibleSection
                        id="certificates"
                        title="Certificates"
                        required={false}
                    >
                        {/* COES group */}
                        {coesList.length > 0 && (
                        <>
                            <p>Products requiring a <strong>COES</strong> certificate:</p>
                            <ul>
                            {coesList.map(({ idx, prod }) => (
                                <li key={idx}>
                                Product {idx + 1} – {prod.brand} {prod.model}
                                </li>
                            ))}
                            </ul>

                            <Field
                            label="COES Certificate Number"
                            value={formData.coesCertificateNumber || ''}
                            onChange={(v) => updateFormData({ coesCertificateNumber: v })}
                            section="Decommissioning & Disposal Details"
                            />
                        </>
                        )}

                        {/* VBA group */}
                        {vbaList.length > 0 && (
                        <>
                            <p style={{ marginTop: 16 }}>
                            Products requiring a <strong>VBA</strong> certificate:
                            </p>
                            <ul>
                            {vbaList.map(({ idx, prod }) => (
                                <li key={idx}>
                                Product {idx + 1} – {prod.brand} {prod.model}
                                </li>
                            ))}
                            </ul>

                            <Field
                            label="VBA Compliance Certificate Number"
                            value={formData.vbaCertificateNumber || ''}
                            onChange={(v) => updateFormData({ vbaCertificateNumber: v })}
                            section="Decommissioning & Disposal Details"
                            />
                        </>
                        )}
                    </CollapsibleSection>
                )}
            </div>
        </div>
        </div>
    );
}
