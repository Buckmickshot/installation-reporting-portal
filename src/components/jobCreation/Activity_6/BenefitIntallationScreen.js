import React, { useState, useEffect, useMemo } from 'react';
import '../JobScreen.css';
import Field from '../../../utils/Field';
import RadioField from '../../../utils/RadioField';
import { FaExclamationTriangle } from 'react-icons/fa';
import { useFormData } from '../../../contexts/FormDataContext';
import CollapsibleSection from '../../../utils/CollapsibleSection';
import {
  getRemaining,
  validateInstallationLimits
} from '../../../utils/InstallationLimits';
import { useNavigate } from 'react-router-dom';
import { FaTrash } from 'react-icons/fa';
import RightSideBar from '../RightSideBar';
import { sectionsConfig } from '../../../utils/SectionsConfig';
import { useSearch } from '../../../contexts/SearchContext';
import RoomEditor, { RoomSelector, SizingSummary } from '../../../utils/RoomConfig'
import { getMinCoPayment } from '../../../utils/MinCopayment';
import { INSTALLATION_REQUIREMENTS } from '../../constants/InstallProducts';

export default function BenefitInstallationScreen() {
  const navigate = useNavigate();
  const { formData, updateFormData, resetFormData } = useFormData();
  const caps = useMemo(() => getRemaining(formData), [formData]);
  const installedProducts = formData.installedProducts || [];
  const activityCfg = sectionsConfig['Activity 6 Registry'];
  const { setEntity, setFilters } = useSearch();
  const [activeProduct, setActiveProduct] = useState(null);

  const handleChange = (key, value) => {
    updateFormData({ [key]: value });
  
    // if it’s one of your registry fields, search for it
    const dbCol = activityCfg.fields[key];
    if (dbCol) {
      setEntity(activityCfg.table);
      setFilters({ [dbCol]: value });
    }
  };

  useEffect(() => {
    const errs = validateInstallationLimits(formData);
    updateFormData({ installationLimitError: errs });
  }, [
    formData.premisesType,
    formData.ductedCount,
    formData.ductedDecomCount,
    formData.nonDuctedCount,
    formData.nonDuctedDecomCount,
    formData.installedProducts,
    formData.decommissionedProducts,
  ]);
  
  const handleSelect = (rec) => {
    if (activeProduct == null) return;
    const updated = installedProducts.map((prod, i) =>
      i === activeProduct
        ? {
            ...prod,
            productCategory:   rec['Product Category No.'] || null,
            brand:             rec['Brand']                  || '',
            model:             rec['Model']                  || '',
            productType:       rec['Product Type']                || '',
            unitConfiguration: rec['Product Configuration'] || '',
            unitMount:         rec['Product Unit Mount']     || '',
            heatingCapacity:   rec['Heating Capacity (kW)'] || '',
            coolingCapacity:   rec['Cooling Capacity (kW)'] || null,
          }
        : prod
    );
    updateFormData({ installedProducts: updated });
  };
  
  const handleProductChange = (index, key, value) => {
    setActiveProduct(index);
    const updated = [...installedProducts];
    const prod    = { ...updated[index], [key]: value }

    const min = getMinCoPayment(prod)
    prod.minCoPayment = min
    if (!prod.coPayment) prod.coPayment = String(min)
    updated[index] = prod
    updateFormData({ installedProducts: updated });

    const dbCol = activityCfg.fields[key];
    if (dbCol) {
      setEntity(activityCfg.table);
      setFilters({ [dbCol]: value });
    }
  };
  
  const addNewProduct = () => {
  setActiveProduct(installedProducts.length);
  const allRooms = (formData.rooms || []).map(r => r.name);
  updateFormData({
    installedProducts: [
      ...installedProducts,
      {
        productCategory:   null,
        areaBucket:        null,
        brand:             '',
        model:             '',
        serialNo:          '',
        productType:       '',
        unitConfiguration: '',
        unitMount:         '',
        heatingCapacity:   '',
        coolingCapacity:   null,
        selectedArea:      null,
        matchSize:         null,
        sizeReason:        '',
        selectedRooms:     allRooms,  
        minCoPayment:      '',
        coPayment:         '0',
      }
    ]
  });
};

  const deleteInstalledProduct = (i) => {
    updateFormData({
      installedProducts: installedProducts.filter((_, idx) => idx !== i)
    });
    if (activeProduct === i) setActiveProduct(null);
  };

  return (
    <div className="create-job-content">
      <div className="create-job-form">

        <section className="mb-6">
          <h3 className="font-medium mb-2">Summary</h3>
          {installedProducts.length === 0 ? (
            <div>None</div>
          ) : (
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Product Type</th>
                  <th>Brand</th>
                  <th>Model</th>
                  <th>Serial No.</th>
                </tr>
              </thead>
              <tbody>
                {installedProducts.map((d, i) => (
                  <tr key={i}>
                    <td>{d.productCategory || '—'}</td>
                    <td>{d.brand || '—'}</td>
                    <td>{d.model || '—'}</td>
                    <td>{d.serialNo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* <div className="caps-note">
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
            Ducted: <strong>{caps.nonXI.suggestedSplit.ducted}</strong>,&nbsp;
            Non‑ducted: <strong>{caps.nonXI.suggestedSplit.nonDucted}</strong>
          </p>

          <p>
            Per‑job equality (installs = de‑coms):&nbsp;
            <strong>{caps.equalityOkThisJob ? 'OK' : 'Not matched'}</strong>
          </p>

          <p>Hard‑wired (i/ii) remaining: <strong>{caps.hardWiredRemaining}</strong></p>
        </div> */}


        {formData.installationLimitError && (
          <div className="warning-note">
            <FaExclamationTriangle className="warning-icon" />
            <p className="warning-text">
              {formData.installationLimitError}
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

        {/* <h2 className="section-header">
          Rooms and size (ONLY for multi-split systems)
        </h2>
        <RoomEditor /> */}

        <div
          className="product-selector"
          style={{
            display: 'flex',
            justifyContent: 'center',
            margin: '1.5rem 0',
          }}
        >
          {installedProducts.map((_, i) => (
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
            onClick={addNewProduct}
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

        {(installedProducts || []).map((product, index) => {
          if (index !== activeProduct) return null;

          const isDucted       = product.productType === 'Ducted';
          const isSingleSplit  = product.unitConfiguration === 'Single split system';
          const isMultiSplit   = product.unitConfiguration !== 'Single split system' && product.unitConfiguration !== '';

          return(
            <CollapsibleSection
              key={index}
              id={`product-${index}`}
              defaultOpen
              title={
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                  }}
                >
                  <FaTrash
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteInstalledProduct(index);
                    }}
                    title="Remove this product"
                    style={{
                      cursor: 'pointer',
                      color: 'black',
                      fontSize: '1.4rem',
                      marginLeft: '0.5rem',
                    }}
                  />
                  <span>{`Product ${index + 1}`}</span>
                </div>
              }
            >

              <RadioField
                label="Product Type"
                name={`selectedProduct-${index}`}
                layout="grid"
                options={[
                  { label: '6A: Ducted air to air R < 10 kW', value: '6A' },
                  { label: '6B(i): Ducted air to air 10 kW ≤ R < 25 kW', value: '6B(i)' },
                  { label: '6B(ii): Ducted air to air 25 kW ≤ R < 39 kW', value: '6B(ii)' },
                  { label: '6C: Ducted air to air 39 kW < R ≤ 65 kW', value: '6C' },
                  { label: '6D: Non-Ducted air to air R < 4 kW', value: '6D' },
                  { label: '6E(i): Non-Ducted air to air 4 kW ≤ R < 7 kW', value: '6E(i)' },
                  { label: '6E(ii): Non-Ducted air to air 7 kW ≤ R < 10 kW', value: '6E(ii)' },
                  { label: '6F: Non-Ducted air to air 10 kW ≤ R ≤ 39 kW', value: '6F' },
                  { label: '6G: Non-ducted air to air 39kW < R ≤ 65kW', value: '6G' },
                ]}
                selectedValue={product.productCategory}
                onChange={(val) => handleProductChange(index, 'productCategory', val)}
              />

              <Field label="Brand" value={product.brand} onChange={(v) => handleProductChange(index, 'brand', v)} />
              <Field label="Model" value={product.model} onChange={(v) => handleProductChange(index, 'model', v)} />
              <Field label="Serial Number" value={product.serialNo} onChange={(v) => handleProductChange(index, 'serialNo', v)} />

              {isSingleSplit && (
                // Single split → show area buckets
                <RadioField
                  label="Area (m2) heated/cooled by baseline product "
                  name={`areaBucket-${index}`}
                  layout="grid"
                  options={[
                    { label: '0–20 m²',   value: '0-20'   },
                    { label: '21–40 m²',  value: '21-40'  },
                    { label: '41–60 m²',  value: '41-60'  },
                    { label: '61–80 m²',  value: '61-80'  },
                    { label: '81–100 m²', value: '81-100' },
                    { label: '101–120 m²', value: '101-120' },
                    { label: '121–160 m²', value: '121-160' },
                    { label: '161 m²+',    value: '161+'   },
                  ]}
                  selectedValue={product.areaBucket}
                  onChange={(val) => handleProductChange(index, 'areaBucket', val)}
                />
              )}

              

             {isMultiSplit && (
  <>
    {/* Add rooms *for this product* */}
    <h4 style={{ margin: '1rem 0 0.5rem' }}>
      Rooms and size for Product {index + 1}
    </h4>

    {/* Pass the product index so RoomEditor knows which one it’s editing */}
    <RoomEditor productIndex={index} />

    {/* If you still want RoomSelector + summary you can keep those too */}
    <RoomSelector index={index} />
  </>
)}


<div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
  <button
    type="button"
    onClick={() => handleProductChange(index, 'factSheetRec', true)}
    style={{
      padding:      '0.5rem 1rem',
      background:   product.factSheetRec === true ? '#2563EB' : 'transparent',
      color:        product.factSheetRec === true ? 'white' : 'black',
      border:       '1px solid #ccc',
      borderRadius: 4,
      cursor:       'pointer',
    }}
  >
    Customer fact sheet recommends
  </button>
  <button
    type="button"
    onClick={() => handleProductChange(index, 'factSheetRec', false)}
    style={{
      padding:      '0.5rem 1rem',
      background:   product.factSheetRec === false ? '#DC2626' : 'transparent',
      color:        product.factSheetRec === false ? 'white' : 'black',
      border:       '1px solid #ccc',
      borderRadius: 4,
      cursor:       'pointer',
    }}
  >
    Does not recommend
  </button>
</div>

{product.factSheetRec === false && (
  <Field
    label="Why does the fact sheet not recommend this?"
    value={product.factSheetReason}
    onChange={v => handleProductChange(index, 'factSheetReason', v)}
  />
)}



              {(() => {
                const req = INSTALLATION_REQUIREMENTS[product.productCategory] || {};
                // only render if at least one role is required
                if (!Object.values(req).some(Boolean)) return null;

                return (
                  <div className="requirements-block mb-4 p-4 border rounded bg-gray-50">
                    <h4 className="font-semibold mb-2">Workers &amp; Licences Required</h4>
                    <ul className="list-disc list-inside">
                      {req.plumber && (
                        <li><strong>Plumber:</strong> {req.plumber}</li>
                      )}
                      {req.electrician && (
                        <li><strong>Electrician:</strong> {req.electrician}</li>
                      )}
                      {req.refrigerantHandler && (
                        <li><strong>Refrigerant Handler:</strong> {req.refrigerantHandler}</li>
                      )}
                    </ul>
                  </div>
                );
              })()}

              {isMultiSplit && (
                // Multi‑split → show rooms + summary
                <>
                  <Field label="Sum of rated Heating Capacity (kW) of all installed indoor units" value={formData.multiSplitHeatingCapacity} onChange={(v) => handleProductChange(index, 'multiSplitHeatingCapacity', v)} placeholder="Heating Capacity" />
                  <Field label="Sum of rated Cooling Capacity (kW) of all installed indoor units" value={formData.multiSplitCoolingCapacity} onChange={(v) => handleProductChange(index, 'multiSplitCoolingCapacity', v)} placeholder="Cooling Capacity" />
                </>
              )}
            </CollapsibleSection>
          )
        })}

      </div>
      {activeProduct != null && (
        <RightSideBar
          sections={{ 'Activity 6 Registry': 'activity_6_registry' }}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}