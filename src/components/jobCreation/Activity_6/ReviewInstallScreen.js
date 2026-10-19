// src/components/jobCreation/Reviewinstall.js
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../JobScreen.css'
import LeftSideBar from '../LeftSideBar'
import RightSideBar from '../RightSideBar'
import CollapsibleSection from '../../../utils/CollapsibleSection'
import { useFormData } from '../../../contexts/FormDataContext'
import FileUploadField from '../../../utils/FileUploadField'
import Field from '../../../utils/Field';
import RadioField from '../../../utils/RadioField';
import { useAuth } from '../../../contexts/AuthProvider'
import { save } from '../../../relationship/save'
import Modal from '../../../utils/Modal'

export default function ReviewInstallScreen() {
  const navigate = useNavigate()
  const { formData, updateFormData } = useFormData()
  const { signOut } = useAuth()
  const isResidential = formData.premisesType === 'residential'
  const [notes, setNotes] = useState(formData.inspectorNotes || '')
  const [showSizingModal, setShowSizingModal] = useState(false)




  const handleFilesSelected = (filesArray) => {
    updateFormData({
      invoice: filesArray,
    });
  };

  const handleChange = (key, value) => {
    updateFormData({ [key]: value });
  };

  // URL of your public‑served fact sheet
  const VEU_Code_Conduct = 'https://www.esc.vic.gov.au/victorian-energy-upgrades/participating-veu-program/meeting-your-obligations-under-veu-code-conduct';
  const Consumer_Rights = '/PBL - Consumer Statement of Rights – VEU program - v 1.2 - 20240501.pdf';
  const VEET_FACTSHEET = '/Victorian-Energy-Efficiency-Target-scheme-consumer-factsheet.pdf';
  const VEU_FACTSHEET = '/VEU-space-heating-and-cooling-consumer-factsheet.pdf';

  /** PDF helper: fetch a blob from a URL */
  const fetchBlob = async url => {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to fetch PDF')
    return await res.blob()
  }

  /** Download any blob as a file */
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /** Handlers for fact sheet */
  const handleDownloadFactSheet = async () => {
    try {
      const blob = await fetchBlob(VEU_FACTSHEET)
      downloadBlob(blob, 'VEU-Consumer-Fact-Sheet.pdf')
    } catch (err) {
      console.error(err)
      alert('Could not download fact sheet.')
    }
  }

  const handleShareFactSheet = async () => {
    try {
      const blob = await fetchBlob(VEU_FACTSHEET)
      const file = new File([blob], 'VEU-Consumer-Fact-Sheet.pdf', { type: 'application/pdf' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'VEU Consumer Fact Sheet',
          text: 'Please find the VEU Consumer Fact Sheet attached.',
        })
      } else {
        // fallback to download + mailto
        await handleDownloadFactSheet()
        window.location.href =
          'mailto:?subject=VEU Consumer Fact Sheet&body=Please find the attached fact sheet.'
      }
    } catch (err) {
      console.error(err)
      alert('Could not share fact sheet.')
    }
  }

  /** Save the whole job (including inspector notes) */
  const persist = async () => {
    const next = { ...formData, inspectorNotes: notes }
    updateFormData({ inspectorNotes: notes })
    await save(next, signOut, updateFormData, navigate)
  }

  const handleSaveDraft = async () => {
    try {
      await persist()
      alert('Saved.')
    } catch (err) {
      alert(`Could not save: ${err.message}`)
    }
  }

  /** Save, then go to the job overview to finish evidence and send for review */
  const handleGenerateRecord = async () => {
    try {
      await persist()
      navigate(`/jobs/${formData.installationId}`)
    } catch (err) {
      alert(`Could not save: ${err.message}`)
    }
  }

  const sectionMap = useMemo(() => ({
    'Job Summary': ['Consumer', 'Decommissioning', 'Installation'],
    'Fact Sheet': ['View', 'Download', 'Share'],
  }), [])

  const sectionsMap = useMemo(() => ({}), [])

  const renderSizingRows = (p, i) => {
    const totalArea = (p.selectedRooms || []).reduce((sum, r) => sum + (r?.size || 0), 0)
    const cap = parseFloat(p.heatingCapacity) || 0

    if ((p.selectedRooms || []).length === 0) {
      return (
        <li key={i}>
          ⚠️ <strong>Product {i + 1} ({p.productType})</strong><br />
          <span style={{ marginLeft: 24 }}>No rooms selected</span>
        </li>
      )
    }

    const rows = []

    if (p.productType === 'Ducted') {
      const recMin = (totalArea * 1.1) / 10
      const recMax = (totalArea * 1.4) / 10
      const isPass = cap >= recMin && cap <= recMax

      rows.push(
        ['Floor area:', `${totalArea.toLocaleString()} m²`],
        ['Heating provided:', `${cap.toFixed(1)} kW`],
        ['Recommended:', `${recMin.toFixed(2)} – ${recMax.toFixed(2)} kW`],
        ['Status:', isPass ? '✅ Within recommended range' : '⚠️ Outside recommended range']
      )
    } else {
      const failedRooms = (p.selectedRooms || []).filter(r => {
        const size = r?.size || 0
        if (size <= 20) return cap < 2.5 || cap > 3
        if (size <= 40) return cap < 3 || cap > 5
        if (size <= 60) return cap < 5 || cap > 8
        return cap < 8
      })
      const isPass = failedRooms.length === 0
      const failedNames = failedRooms.map(r => r.name).join(', ') || 'None'

      rows.push(
        ['Floor area:', `${totalArea.toLocaleString()} m²`],
        ['Heating provided:', `${cap.toFixed(1)} kW`],
        ['Room check:', isPass
          ? '✅ All rooms within recommended range'
          : `⚠️ Room(s) outside range: ${failedNames}`
        ]
      )
    }

    return (
      <li key={i}>
        {p.matchSize ? '✅' : '⚠️'} <strong>Product {i + 1} ({p.productType})</strong>
        <table style={{ marginTop: 8 }}>
          <tbody>
            {rows.map(([label, val], j) => (
              <tr key={j}>
                <td style={{ paddingRight: 12, verticalAlign: 'top', fontWeight: 600 }}>{label}</td>
                <td>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </li>
    )
  }

  return (
    <div className="create-job-content">
      <LeftSideBar sectionMap={sectionMap} />

      <div className="create-job-form p-4 max-w-3xl mx-auto">
        {/* 1. Job Summary */}
        <CollapsibleSection id="summary" title="Job Summary" defaultOpen>
          {/* 1. Consumer */}
          <section className="mb-6">
            <h3 className="font-medium">Consumer</h3>
            <div>Name: {formData.firstName} {formData.surname}</div>
            <div>Phone: {formData.clientPhone}</div>
            <div>Email: {formData.email}</div>
            <div>Address: {formData.installationAddress}</div>
          </section>

          {/* 2. Decommissioning as a table */}
          <section className="mb-6">
            <h3 className="font-medium mb-2">Decommissioning</h3>
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

          {/* 3. Installation as a table */}
          <section>
            <h3 className="font-medium mb-2">Installation</h3>
            {formData.installedProducts.length === 0 ? (
              <div>None</div>
            ) : (
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Brand</th>
                    <th>Model</th>
                    <th>Heat kW</th>
                    <th>Cool kW</th>
                    <th>Min Co-Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.installedProducts.map((p, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{p.productType || '—'}</td>
                      <td>{p.brand || '—'}</td>
                      <td>{p.model || '—'}</td>
                      <td>{p.heatingCapacity || '—'}</td>
                      <td>{p.coolingCapacity || '—'}</td>
                      <td>${p.minCoPayment || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </CollapsibleSection>

        {/* 3. Consumer Fact Sheet */}
        <CollapsibleSection id="benefit_co_payment" title="Form of Benefit & Co-Payment">
          <RadioField
            label="Form of Benefit Provided"
            name="typeOfBenefit"
            options={[
              { label: 'Upfront cash', value: 'Upfront cash' },
              { label: 'Price reduction', value: 'Price reduction' },
              { label: 'Delayed cash', value: 'Delayed cash' },
              { label: 'Other (please describe)', value: 'Other' },
            ]}
            selectedValue={formData.typeOfBenefit}
            onChange={(val) => handleChange('typeOfBenefit', val)}
            layout="horizontal"
          />
          {formData.typeOfBenefit === 'Other' && (
            <Field
              label="Other Form of Benefit"
              value={formData.otherBenefit}
              onChange={(v) => handleChange('otherBenefit', v)}
            />
          )}
          <Field
            label="Amount of Benefit Provided for assignment of certificates"
            value={formData.amountOfBenefit}
            onChange={(v) => handleChange('amountOfBenefit', v)}
          />
          <Field
            label="Price of installed product(s) incl. GST, before VEEC incentive ($)"
            value={formData.priceBeforeVeec}
            onChange={(v) => handleChange('priceBeforeVeec', v)}
          />
          <Field
            label="Consumer payment for installed product(s) incl. GST ($)"
            value={formData.consumerPayment}
            onChange={(v) => handleChange('consumerPayment', v)}
          />
          <CollapsibleSection
            id={`invoice`}
            title="Invoice"
            defaultOpen={false}
          >

            <p className="mb-2 text-sm text-gray-700">
              <p>What the invoice must list:</p>
              <li>the brand and model of the installed product(s)</li>
              <li>the number of installed product(s)</li>
              <li>the name and address of the energy consumer</li>
              <li>the name, address and ABN of the installer business</li>
              <li>the price of the product(s) (before VEEC incentive is applied)</li>
              <li>the VEEC incentive amount</li>
              <li>the amount paid the by the energy consumer for the product(s) (after VEEC incentive is applied)</li>
              <li>date of purchase or installation</li>
              <p>The Invoice must clearly show that the minimum customer payments for each installed product follows the table of products above</p>
              <p>The co-payment amount cannot be reimbursed, in part or in full, to the energy consumer in any form</p>
            </p>

            <CollapsibleSection id="benefit-docs" title="Invoice Attachment" defaultOpen>
              <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#666', margin: '0 0 0.75rem' }}>
                Upload one or more documents or pictures. Be sure it is clear. Make sure that the minimum consumer payment for installed product(s) including GST (after VEEC incentive) follows the co-payment values in the summary table above
              </p>
              <FileUploadField
                attachments={formData.invoice || []}
                onFilesSelected={handleFilesSelected}
                accept=".pdf,image/*"
                multiple
              />
            </CollapsibleSection>

          </CollapsibleSection>
        </CollapsibleSection>

        <CollapsibleSection id="quote" title="Pre-Install Information" defaultOpen={false} >
          {/* wrap the body in a div so we can target just this section: */}
          <div className="inspector-notes-body">
            <textarea
              placeholder="Add any notes for the workers"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <p className="mb-4 text-sm text-gray-700">
            <strong>Important:</strong> You must provide the energy consumer with a copy of the current{" "}
            <a
              href={VEU_FACTSHEET}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              VEU Space Heating and Cooling Consumer Fact Sheet
            </a>{" "}
            and {" "}
            <a
              href={VEET_FACTSHEET}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              VEET Scheme Consumer Factsheet
            </a>{" "}
            before they agree to proceed with the installation.
          </p>
          <div style={{ display: 'flex', gap: 8, margin: '0.5rem 0 1rem' }}>
            <button type="button" onClick={handleDownloadFactSheet}>Download fact sheet</button>
            <button type="button" onClick={handleShareFactSheet}>Share with customer</button>
          </div>

          <p className="mb-2 text-sm text-gray-700">
            You must provide consumer (according to the {" "}
            <a
              href={VEU_Code_Conduct}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              VEU Code of Conduct
            </a>{""})
            with:
          </p>
          <ul className="list-disc ml-6 text-sm text-gray-700">
            <li>clear and accurate information on the activity (e.g. product performance and suitability of the product to that person and premises)</li>
            <li>information about their {" "}
              <a
                href={Consumer_Rights}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                rights and obligations
              </a>{" "}
              under the VEU program</li>
            <li>terms and conditions of the contract</li>
            <li>contact details of the person to be undertaking the installation</li>
          </ul>

          {isResidential && (
            <>
              <p className="mb-2 text-sm text-gray-700">
                You must clearly explain to the customer:
              </p>
              <ul className="list-disc ml-6 text-sm text-gray-700">
                <li>Whether the product is suitable for the heating and cooling needs of the customer's premises</li>
                <li>
                  Whether the installed product’s size is consistent with recommendations in the {" "}
                  <a
                    href={VEU_FACTSHEET}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    VEU Space Heating and Cooling Consumer Fact Sheet
                  </a>
                </li>
              </ul>

              <button onClick={() => setShowSizingModal(true)}>
                View Sizing Recommendation Summary
              </button>

              {/* 2) The modal itself */}
              {showSizingModal && (
                <Modal onClose={() => setShowSizingModal(false)}>
                  <h2>Sizing Recommendation Summary</h2>
                  <ul className="list-none pl-0 text-sm text-gray-800 space-y-4">
                    {(formData.installedProducts || []).map((p, i) =>
                      renderSizingRows(p, i)
                    )}
                  </ul>
                  <button onClick={() => setShowSizingModal(false)}>Close</button>
                </Modal>
              )}

              <RadioField
                label="Have you done all necessary tasks above?"
                name="installerTasksDone"
                options={[{ label: 'Yes', value: true }, { label: 'No', value: false }]}
                selectedValue={formData.installerTasksDone}
                onChange={v => handleChange('installerTasksDone', v)}
                layout="horizontal"
              />
            </>
          )}

        </CollapsibleSection>

        {/* <DateField
          label="Completion Date"
          value={formData.installationDate || ''}
          onChange={iso => handleDocDateChange(dateKey, iso)}
          section="Client Details"
          fieldName={`${docTitle} Completion Date`}
          error={formData.dateErrors?.[dateKey]}
        /> */}

        {/* 4. Final Actions */}
        <div className="flex space-x-4 mt-6">
          <button
            className="px-4 py-2 border rounded"
            onClick={handleSaveDraft}
          >
            Save Draft
          </button>
          <button
            className="px-4 py-2 bg-indigo-600 text-white rounded"
            onClick={handleGenerateRecord}
          >
            Finalise Job
          </button>
        </div>
      </div>
      {/* <button
                  disabled={hasErrors}
                  onClick={() => {
                    if (hasErrors) {
                      alert('One or more co-payments is below its minimum.')
                      return
                    }
                    // …finalise…
                  }}
                >
                  Finalise Job
                </button> */}
      <RightSideBar sections={sectionsMap} onSelect={() => { }} />
    </div>
  )
}
