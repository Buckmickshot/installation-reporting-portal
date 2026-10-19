// src/components/jobCreation/Activity_6/DecommissionScreen.js
import React, { useEffect, useState, useMemo } from 'react';
import '../JobScreen.css';
import Field from '../../../utils/Field';
import RadioField from '../../../utils/RadioField';
import CollapsibleSection from '../../../utils/CollapsibleSection';
import { useFormData } from '../../../contexts/FormDataContext';
import LeftSideBar from '../LeftSideBar';
import { FaTrash } from 'react-icons/fa';
import { FOOTNOTES, getScenarios } from '../../constants/Decommissioning';
import { validateInstallationLimits,
  getRemaining
 } from '../../../utils/InstallationLimits';
import { useNavigate } from 'react-router-dom';
import { FaExclamationTriangle } from 'react-icons/fa';

export default function DecommissionScreen() {
  const navigate = useNavigate();
  const { formData, updateFormData, resetFormData } = useFormData();
  const caps = useMemo(() => getRemaining(formData), [formData]);
  const { premisesType } = formData;
  const isResidential = premisesType === 'residential';
  const [activeProduct, setActiveProduct] = useState(0);
  const products = formData.decommissionedProducts || [];

  const suggestedSplit = React.useMemo(() => {
    const d = Math.max(0, Math.round(caps?.nonXI?.minThisJob?.ducted    ?? 0));
    const n = Math.max(0, Math.round(caps?.nonXI?.minThisJob?.nonDucted ?? 0));
    return { ducted: d, nonDucted: n };
  }, [caps]);

  const handleChange = (key, value) => {
    updateFormData({ [key]: value });
  };

  useEffect(() => {
    const errs = validateInstallationLimits(formData);
    updateFormData({ installationLimitError: errs });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the listed fields change
  }, [
    formData.premisesType,
    formData.ductedCount,
    formData.ductedDecomCount,
    formData.nonDuctedCount,
    formData.nonDuctedDecomCount,
    formData.installedProducts,
    formData.decommissionedProducts,
  ]);

  const handleDecommissionedProductChange = (index, key, value) => {
    const updated = [...products]
    const prod = { ...updated[index], [key]: value }

    if (key === 'decommissionScenario') {
      const sc = getScenarios(isResidential).find(s => s.id === value) || { notes: [] }
      if (sc.notes.includes(16)) {
        if (prod.COESRequired === undefined) prod.COESRequired = null
      } else delete prod.COESRequired
      if (sc.notes.includes(17)) {
        if (prod.VBARequired === undefined) prod.VBARequired = null
      } else delete prod.VBARequired
    }

    updated[index] = prod
    updateFormData({ decommissionedProducts: updated })
  }

  const addDecommissionedProduct = () => {
    const newProduct = { decommissionScenario: '', brand: '', model: '', serial: '' }
    const newIndex = products.length
    updateFormData({ decommissionedProducts: [...products, newProduct] })
    setActiveProduct(newIndex)
  }

  const deleteDecommissionedProduct = index => {
    const updated = [...products]
    updated.splice(index, 1)
    updateFormData({ decommissionedProducts: updated })
    setActiveProduct(prev => (prev > 0 && prev === index ? prev - 1 : prev))
  }
  

  return (
    <div className="job-layout-container">
      <LeftSideBar
        sectionMap={{
          'Decommissioning Scenarios & Product Details': ['decommissionScenario'],
          'Disposal & Ductwork Details': [
            'decommissionMethod',
            'removed',
            formData.removed === false && 'notRemovedReason',
            'ductReplacement',
          ].filter(Boolean),
        }}
      />

      <div className="create-job-content">
        <div className="create-job-form">

          {/* Top‐level header */}
          <CollapsibleSection 
            id="decommission-scenarios" 
            title="Decommissioning Scenarios & Product Details"
            required={!formData.decommissionScenario}
          >
            <section className="mb-6">
            <h3 className="font-medium mb-2">Summary</h3>
            {formData.decommissionedProducts.length === 0 ? (
              <div>None</div>
            ) : (
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Brand</th>
                    <th>Model</th>
                    <th>CES</th>
                    <th>VBA</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.decommissionedProducts.map((d, i) => (
                    <tr key={i}>
                      <td>{d.decommissionScenario || '—'}</td>
                      <td>{d.brand || '—'}</td>
                      <td>{d.model || '—'}</td>

                      {/* Certificate of Electrical Safety */}
                      <td>
                        {d.COESRequired === undefined
                          ? 'N/A'
                          : d.COESRequired === null
                            ? 'Pending'
                            : d.COESRequired
                              ? 'Yes'
                              : 'No'}
                      </td>

                      {/* VBA Compliance Certificate */}
                      <td>
                        {d.VBARequired === undefined
                          ? 'N/A'
                          : d.VBARequired === null
                            ? 'Pending'
                            : d.VBARequired
                              ? 'Yes'
                              : 'No'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </section>

            {/* replace your commented block with this */}
            <div className="caps-note">
              <p>
                Number of install↔de‑com pairs you can still add:&nbsp;
                <strong>{caps.pairsRemaining}</strong>
              </p>

              <p>Ducted installs left (cap): <strong>{caps.installsRemaining.ducted}</strong></p>
              <p>Non‑ducted installs left (cap): <strong>{caps.installsRemaining.nonDucted}</strong></p>

              <p>
                Non‑XI de‑commissions needed <em>this job</em>:&nbsp;
                <strong>{caps.nonXI.neededThisJob}</strong>
                {caps.nonXI.neededThisJob > 0 ? ' (add this many)' : ' (none needed)'}
              </p>

              <p>
                Non‑XI you can still add without breaching caps:&nbsp;
                <strong>{caps.nonXI.extraAllowed}</strong>
              </p>

              <p>
                Suggested minimum split to meet the rule —&nbsp;
                Ducted: <strong>{suggestedSplit.ducted}</strong>,&nbsp;
                Non‑ducted: <strong>{suggestedSplit.nonDucted}</strong>
              </p>

              <p>
                Per‑job equality (installs = de‑coms):&nbsp;
                <strong>{caps.equalityOkThisJob ? 'OK' : 'Not matched'}</strong>
              </p>

              <p>Hard‑wired (i/ii) remaining: <strong>{caps.hardWiredRemaining}</strong></p>
            </div>

            {/* Installation‐limit warning */}
            {formData.installationLimitError && (
              <div className="warning-note">
                <FaExclamationTriangle className="warning-icon" />
                <p className="warning-text">{formData.installationLimitError}</p>
                <button className="exit-button" onClick={() => { resetFormData(); navigate('/'); }}>
                  Exit Form
                </button>
              </div>
            )}

            <div
            className="product-selector"
            style={{
              display: 'flex',
              justifyContent: 'center',
              margin: '1.5rem 0',
            }}
          >
            {products.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveProduct(i)}
                style={{
                  padding: '0.5rem 1rem',
                  margin: '0 0.25rem',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  background: activeProduct === i ? '#eef2ff' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                Product {i + 1}
              </button>
            ))}
            <button
              onClick={addDecommissionedProduct}
              style={{
                padding: '0.5rem 1rem',
                margin: '0 0.25rem',
                border: '1px solid #ccc',
                borderRadius: 4,
                background: activeProduct === 'transparent',
                cursor: 'pointer',
              }}
            >
              Add New Product
            </button>
          </div>

          {products.map((product, index) => {
            // only render the active product
            if (index !== activeProduct) return null;

            // find the scenario once and fall back to empty defaults
            const sc = getScenarios(isResidential)
              .find(s => s.id === product.decommissionScenario) || {
                body: null,
                notes: [],
                requirements: {}
              };

            return (
              <CollapsibleSection
                key={index}
                id={`decommissioned-product-${index}`}
                defaultOpen={true}
                title={
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <FaTrash
                      onClick={() => deleteDecommissionedProduct(index)}
                      title="Remove this product"
                      style={{ cursor: 'pointer', color: 'black', fontSize: '1.4rem', marginRight: '0.5rem' }}
                    />
                    <span>{`Decommissioned Product ${index + 1}`}</span>
                  </div>
                }
              >
                {/* Scenario selector, Brand, Model */}
                <RadioField
                  label="Scenario"
                  name={`decommissionedScenario-${index}`}
                  layout="vertical"
                  options={getScenarios(isResidential).map(s => ({ value: s.id, label: s.title }))}
                  selectedValue={product.decommissionScenario}
                  onChange={v => handleDecommissionedProductChange(index, 'decommissionScenario', v)}
                />
                <Field
                  label="Brand"
                  value={product.brand}
                  onChange={v => handleDecommissionedProductChange(index, 'brand', v)}
                />
                <Field
                  label="Model"
                  value={product.model}
                  onChange={v => handleDecommissionedProductChange(index, 'model', v)}
                />
                <Field
                label="Method used to decommission the product"
                value={product.decommissionMethod}
                onChange={(v) => handleDecommissionedProductChange(index, 'decommissionMethod', v)}
                section="Decommissioning & Disposal Details"
                />
                <RadioField
                    label="Was product removed from premises for disposal?"
                    name="removed"
                    section="Decommissioning & Disposal Details"
                    options={[
                    { label: 'Yes', value: true },
                    { label: 'No', value: false },
                    ]}
                    selectedValue={product.removed}
                    onChange={(v) => handleDecommissionedProductChange(index, 'removed', v)}
                    layout="horizontal"
                />

                {product.removed === false && (
                    <Field
                    label="Why was removal not safe or practical?"
                    value={product.notRemovedReason}
                    onChange={(v) => handleDecommissionedProductChange(index, 'notRemovedReason', v)}
                    section="Decommissioning & Disposal Details"
                    />
                )}

                <RadioField
                    label="Was ductwork replaced as part of new installation (for replacement of ducted systems with ducted systems only)?"
                    name="ductReplacement"
                    section="Decommissioning & Disposal Details"
                    options={[
                    { label: 'Yes', value: 'true' },
                    { label: 'No', value: 'false' },
                    { label: 'N/A', value: 'N/A' },
                    ]}
                    selectedValue={product.ductReplacement}
                    onChange={(v) => handleDecommissionedProductChange(index, 'ductReplacement', v)}
                    layout="horizontal"
                />

                {/* Full scenario details */}
                {sc.body && (
                  <CollapsibleSection
                    id={`scenario-${index}-details`}
                    title="View full scenario requirements"
                    defaultOpen={true}
                  >
                    <div className="decommission-body">
                      {/* Body paragraph / list */}
                      {sc.body}

                      {/* Footnotes */}
                      {sc.notes.map(num => {
                        const fn = FOOTNOTES[num];
                        return (
                          <div key={num} className="footnote">
                            <p className="footnote-intro">
                              <sup>{num}</sup> {fn.intro}
                            </p>
                            {fn.items.length > 0 && (
                              <ul className="footnote-list">
                                {fn.items.map(item => <li key={item}>{item}</li>)}
                              </ul>
                            )}
                            {fn.tail && <p className="footnote-tail">{fn.tail}</p>}
                          </div>
                        );
                      })}

                      {/* ✨ Workers & Licences Required */}
                      {sc.requirements && Object.values(sc.requirements).some(Boolean) && (
                        <div className="requirements-block mb-4 p-4 border rounded bg-gray-50">
                          <h4 className="font-semibold mb-2">Workers &amp; Licences Required</h4>
                          <ul className="list-disc list-inside">
                            {sc.requirements.plumber && (
                              <li><strong>Plumber:</strong> {sc.requirements.plumber}</li>
                            )}
                            {sc.requirements.electrician && (
                              <li><strong>Electrician:</strong> {sc.requirements.electrician}</li>
                            )}
                            {sc.requirements.refrigerantHandler && (
                              <li><strong>Refrigerant Handler:</strong> {sc.requirements.refrigerantHandler}</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Section 3 of the assignment form: agreed scope of building repair work */}
                <RadioField
                    label="Building repair work the installer will do (assignment form, Section 3)"
                    name="repairScope"
                    options={[
                    { label: 'All necessary repair work', value: 'all' },
                    { label: 'Some of the repair work', value: 'some' },
                    { label: 'No repair work', value: 'none' },
                    ]}
                    selectedValue={formData.repairScope}
                    onChange={(v) => handleChange('repairScope', v)}
                    layout="horizontal"
                />
                {formData.repairScope === 'some' && (
                    <Field
                    label="Which repair work is included / not included"
                    value={formData.repairDetails}
                    onChange={(v) => handleChange('repairDetails', v)}
                    />
                )}

                {/* COES and VBA toggles */}
                <CollapsibleSection 
                  id="certificates" 
                  title="Certificates"
                >
                  <RadioField
                    label="Certificate of Electrical Safety Required?"
                    name={`COESRequired`}
                    options={[{ label: 'Yes', value: true }, { label: 'No', value: false }]}
                    selectedValue={formData.COESRequired}
                    onChange={v => handleChange('COESRequired', v)}
                    layout="horizontal"
                  />
                  {formData.COESRequired && 
                    <Field label="COES number" value={formData.COESNo} onChange={v=>handleChange('COESNo',v)} />
                  }
                  <RadioField
                    label="VBA Compliance Certificate Required?"
                    name={`VBARequired`}
                    options={[{ label: 'Yes', value: true }, { label: 'No', value: false }]}
                    selectedValue={formData.VBARequired}
                    onChange={v => handleChange('VBARequired', v)}
                    layout="horizontal"
                  />
                  {formData.VBARequired && 
                    <Field label="VBA number" value={formData.VBANo} onChange={v=>handleChange('VBANo',v)} />
                  }
                </CollapsibleSection>
                {/* Continue with your existing workflow component */}
                {/* {product.decommissionScenario != 'xi' &&
                  <DecommissionWorkflow productIndex={index} />
                } */}
              </CollapsibleSection>
            );})}
          </CollapsibleSection>
        </div>
      </div>

      {/* <RightSideBar /> */}
    </div>
  );
}