import React, { useState, useRef } from 'react'
import CollapsibleSection from './CollapsibleSection'
import EvidenceField from './EvidenceField'
import { useFormData } from '../contexts/FormDataContext'
import Modal from './Modal'
import { FaQuestionCircle } from 'react-icons/fa'

const STAGES = [
    {
      key: 'electrical',
      label: 'Is it connected to the electrical supply?',
      type: 'decision',
      details: {
        yes: [
          'The product must be disconnected and appropriate steps taken to make the electrical connection safe',
          'Terminate unused wiring in a purpose-made enclosure so no live ends are exposed.',
          'Isolate the circuit at the switchboard: switch OFF and apply a lock or tag to prevent re-energisation.',
          'Prove absence of voltage at the enclosure with a voltage tester and record the result.',
          'Restore mechanical protection for any opened conduits or trunking (blank plates, seals).',
          'Test earth continuity and insulation resistance for the modified circuit; record test values.',
          'Update circuit labeling in the consumer unit to remove the decommissioned device.',
          'Issue or update the Electrical Safety Certificate (Certificate of Compliance) listing the work done.'
        ],
        no: ['Nothing is required']
      },
      evidenceFields: [
        { subKey: 'unitLivePhoto',       label: 'Photo of unit still wired into mains',                         accept: 'image/*', when: 'yes' },
        { subKey: 'terminationPhoto',    label: 'Photo of unused conductors terminated in enclosure',          accept: 'image/*', when: 'yes' },
        { subKey: 'isolationPhoto',      label: 'Photo of switchboard with breaker OFF and tagged',            accept: 'image/*', when: 'yes' },
        { subKey: 'voltageTestRecord',   label: 'Voltage test result (photo or document)',                     accept: '.pdf,image/*', when: 'yes' },
        { subKey: 'protectionRestore',   label: 'Photo of restored conduit/trunking protection',              accept: 'image/*', when: 'yes' },
        { subKey: 'testReport',          label: 'Earth/insulation test report',                              accept: '.pdf,image/*', when: 'yes' },
        { subKey: 'labelUpdatePhoto',    label: 'Photo of updated circuit directory label',                    accept: 'image/*', when: 'yes' },
        { subKey: 'complianceCertificate',label: 'Electrical Safety Certificate',                             accept: '.pdf', when: 'yes' }
        ]
    },
    {
      key: 'gas',
      label: 'Is it connected to a gas supply?',
      type: 'decision',
      details: {
        yes: [
          'The product must be disconnected and steps taken to make the gas connection safe (accordance with AS/NZS 5601.1). This includes: \n',
          'Product must be disconnect from gas supply, purged and sealed',
          'Seal all open ends during and after the work: while cutting or removing piping, seal every open end; on leaving site, permanently seal every open end with a plug, cap, blank flange or capped/plugged valve. Simply turning off a valve is not sufficient.',
          'Where an outlet has been provided for the connection of an appliance, but is not to be used immediately, it shall be sealed using a plug, cap, blank flange or capped or plugged manual shut-off valve.',
        ],
        no: ['Nothing is required']
      },
      evidenceFields: [
        { subKey: 'photos', label: 'Photo of existing unit connected to the gas pipe', accept: 'image/*', when: 'yes'},
        { subKey: 'photos', label: 'Photo of existing unit disconnected',              accept: 'image/*', when: 'yes'},
        { subKey: 'photos', label: 'Photo of gas piping sealed and/or capped',         accept: 'image/*', when: 'yes'},
      ]
    },
    {
      key: 'refrigerant',
      label: 'Does it contain refrigerant?',
      type: 'decision',
      details: {
        yes: [
          'You will need to take steps to recover refrigerants for safe disposal (handled by an RTA-authorised handler).'
        ],
        no: ['Nothing is required']
      },
      evidenceFields: [
        { subKey: 'invoice', label: 'Recovery invoice/receipt w. licence No. from RTA-authorised refrigerant handler', accept: '.pdf,image/*', when: 'yes' },
        { subKey: 'invoice', label: 'Disposal docket/certificate',                                                     accept: '.pdf,image/*', when: 'yes' }
      ]
    },
    {
      key: 'asbestos',
      label: 'Does the old product or its surroundings contain friable asbestos?',
      type: 'decision',
      details: {
        yes: [
          'Stop work immediately.',
          'Display warning signs at your work area',
          'Engage a Class A or B licensed asbestos removalist.',
          'Do not proceed with removal or disposal until all asbestos is cleared by licensee.'
        ],
        no: [
          'Nothing is required'
        ]
      },
      help: [
        <>
          Use the{' '}
          <a
            href="https://www.asbestos.vic.gov.au/about-asbestos/finding-and-identifying/find-and-identify-asbestos-tool"
            target="_blank"
            rel="noopener noreferrer"
          >
            Find &amp; Identify Asbestos tool
          </a>{' '}
          to locate ALL ACM (Asbestos Containing Material) in walls, ceilings, pipes, adhesives, coatings.
        </>,
        'Document location, type (friable vs non-friable) and area/volume of ACM you may disturb.'
      ],
      evidenceFields: [
        { subKey: 'asbestosInspection', label: 'Photo of ACM location or survey report', accept:'image/*,.pdf', multiple:true, when:'yes' },
        { subKey: 'licenseeReceipt',     label: 'Receipt from licensed removalist',       accept:'.pdf',          multiple:false, when:'yes' },
        { subKey: 'siteReport',     label: 'Site inspection report (geo-tagged photos or licensed survey)', accept: '.pdf,image/*', multiple: true, when: 'info' },
      ]
    },
    {
      key: 'asbestosTraining',
      label: 'Asbestos Awareness & Planning',
      type: 'info',
      details: [
        'Obtain asbestos-awareness training (mandatory).',
        'Display warning signage at your work area whenever ACM is present.',
        'Record training certificates and signage acknowledgement.'
      ],
      evidenceFields: [
        { subKey: 'trainingCert', label: 'Asbestos awareness training certificate', accept: '.pdf', multiple: false, when: 'info' },
        { subKey: 'signageAck',   label: 'Signed signage placement acknowledgement',  accept: '.pdf', multiple: false, when: 'info' },
      ]
    },
    {
      key: 'asbestosRoute',
      label: 'Determine Removal Route (Self vs Licensed)',
      type: 'decision',
      details: {
        yes: ['Self-removal (≤10 m² & ≤1 hr) — follow compliance code'],
        no:  ['Engage Class A/B licensed removalist']
      },
      evidenceFields: [
        { subKey: 'selfRemovalChk', label: 'Checklist: ≤ 10 m² & ≤ 1 hr',      accept: '.pdf', multiple: false, when: 'yes' },
        { subKey: 'licenseInfo',    label: 'Copy of removalist licence & appointment', accept: '.pdf', multiple: false, when: 'no' },
      ]
    },
    {
      key: 'asbestosControls',
      label: 'Safe Work Controls & Removal',
      type: 'info',
      details: [
        'For self-removal: use PPE (P2/P100 respirator, disposable overalls), wet methods, seal off work area, bag waste.',
        'For licensed removal: verify method statement and containment.',
        'Record air-monitoring results and decontamination logs.'
      ],
      evidenceFields: [
        { subKey: 'ppeLog',       label: 'PPE usage & decon log',          accept: '.pdf',           multiple: false, when: 'info' },
        { subKey: 'airMonitor',   label: 'Air-monitoring report',          accept: '.pdf',           multiple: false, when: 'info' },
      ]
    },
    {
      key: 'asbestosClearance',
      label: 'Clearance Inspection & Certificate',
      type: 'decision',
      details: {
        yes: ['Clearance inspection done by competent person; certificate obtained'],
        no:  ['Cannot proceed until clearance certificate is on file']
      },
      evidenceFields: [
        { subKey: 'clearanceCert', label: 'Signed clearance certificate',      accept: '.pdf', multiple: false, when: 'yes' },
      ]
    },
    {
      key: 'asbestosTransport',
      label: 'Transport & Disposal of Asbestos Waste',
      type: 'info',
      details: [
        'Package waste per EPA (labelled, double-wrapped).',
        'Transport to EPA-licensed facility; hold transport permit if industrial origin.',
        'Ensure no fibre release in transit.'
      ],
      evidenceFields: [
        { subKey: 'wasteDocket',  label: 'Waste docket / disposal facility receipt', accept: '.pdf', multiple: false, when: 'info' },
        { subKey: 'transportPermit', label: 'Transport permit (industrial origin)',   accept: '.pdf', multiple: false, when: 'info' },
      ]
    },
    {
      key: 'asbestosRecords',
      label: 'Record-Keeping & Reporting',
      type: 'info',
      details: [
        'Maintain master asbestos register with all reports, records, licences, certificates, and receipts.',
        'Make available to inspectors or occupier on request.'
      ],
      evidenceFields: [
        { subKey: 'masterRegister', label: 'Asbestos master register / site file', accept: '.pdf', multiple: false, when: 'info' },
      ]
    },
    {
      key: 'safeRemoval',
      label: 'Is it safe and practical to remove?',
      type: 'decision',
      details: {
        yes: [
          'The old product must be removed and recycled or disposed of appropriately.',
          'The product and any waste and debris must be removed from the consumer’s premises.',
          'It’s the commission’s expectation that there is clear agreement between the consumer and installer prior to the commencement of the installation about the scope of the installation, including whether a product is to be removed and the scope of any building repair work (if any) to be undertaken by the installer.'
        ],
        no: [
          'commission’s expectation that consumers are informed that the product will be left in-situ before the consumer agrees to undertake the upgrade',
          'justification for why the product has been left in-situ is required',
        ]
      },
      help: [
        'It is the commission’s expectation that most products should be removed from the consumer’s premises and disposed of by the installer',
        'Products which may not be safe and practical to remove include:\n  • central electric resistance heating systems and slab heating systems\n  • systems where removal would require substantial remediation work\n  • systems presenting health/safety risks (e.g. asbestos—removal must follow legislation)',
      ],
      evidenceFields: [
        { subKey: 'photos',        label: 'Photo of existing unit in situ',                                                                                                             accept: 'image/*',      when: 'yes' },
        { subKey: 'photos',        label: 'Photo of existing unit removed',                                                                                                             accept: 'image/*',      when: 'yes' },
        { subKey: 'invoice',       label: 'Waste receipt/invoice from an EPA-authorised facility, recording recipient name & address, date delivered, waste description and amount',    accept: '.pdf,image/*', when: 'yes' },
        { subKey: 'photos',        label: 'Photo of hazard preventing removal',                                                                                                         accept: '.pdf,image/*', when: 'no' },
        { subKey: 'informed',      label: 'I have informed the consumer that product will not be removed',                                                                              inputType: 'checkbox',  when: 'no' },
        { subKey: 'justification', label: 'Reason why removal is impractical (required)',                                                                                               inputType: 'textarea',  when: 'no' },
      ]
    },
    {
        key: 'renderUnusable',
        label: 'Can further steps be taken to render the product permanently unusable?',
        type: 'decision',
        details: {
          yes: [
            'Steps must be taken to render the product permanently unusable in a safe and practical manner. Methods may include:\n  • the removal and destruction of the heating element or burner, control board / internal wiring components including 3 pin plug\n  • destruction of the product’s casing or other components which renders the product permanently unusable\n  • removal of ductwork where upgrades involve replacement of gas ducted heaters',
          ],
          no: ['Collect photos evidencing reason why unit cannot be disabled']
        },
        evidenceFields: [
          { subKey: 'photos', label: 'Photo of existing unit before disabling',                                 accept: 'image/*',     when: 'yes' },
          { subKey: 'photos', label: 'Photo of existing unit disabled (clearly show how product was disabled)', accept: 'image/*',     when: 'yes' },
          { subKey: 'photos', label: 'Exact reason why existing unit cannot be disabled',                       inputType: 'textarea', when: 'no' },
          { subKey: 'photos', label: 'Photo of why existing unit cannot be disabled',                           accept: 'image/*',     when: 'no' },
        ]
    },
    {
      key: 'disposal',
      label: 'Disposal',
      type: 'info',
      details: [
        'Any waste and debris (including the product where it is safe and practical to remove) must be removed from the consumer’s premises.',
        'Manage your waste in accordance with the Environment Protection Act 2017 and Regulations: classify waste streams, contain safely in transport, and ensure it goes to a lawful place.',
        'Industrial waste duties apply: determine waste code/type (e.g. decommissioned heater → T300 “E-waste”), and follow EPA permission requirements.',
        'E-waste is banned from landfill in Victoria.',
        'If stored temporarily (up to 5 m³ non-priority), obtain necessary EPA permissions.',
        'Fluorocarbon refrigerant must be disposed of under the Ozone Protection and Synthetic Greenhouse Gas Management Act at an RTA-authorised facility.'
      ]
    },
    {
        key: 'disposeRefrigerant',
        label: 'Safely dispose of refrigerant',
        type: 'info',
        details: [
          'Safely dispose of refrigerant. Invoice or receipt including agent’s refrigerant handling licence number.'
        ]
      },
    
      // 2️⃣ Otherwise ask about e-waste
      {
        key: 'containsEWaste',
        label: 'Contains e-waste?',
        type: 'decision',
        details: {
          yes: [
            'Dispose of e-waste at a lawful place (e-waste banned from landfill).',
            'Waste docket or receipt from a lawful place.'
          ],
          no: []
        }
      },
      {
        key: 'containsDebris',
        label: 'Materials & debris (other than e-waste)?',
        type: 'decision',
        details: {
          yes: [
            'Recycle/dispose of materials at a lawful place.',
            'Waste docket or receipt from a lawful place.'
        ],
          no: []
        }
      },
  ]
  
export default function DecommissionWorkflow({ productIndex }) {
  const { formData, updateFormData } = useFormData()
  const [ modalStage, setModalStage ] = useState(null)
  const allSteps = formData.decommissionSteps || {}
  const stepsForThis = allSteps[productIndex] || {}

  const setAnswer = (key, ans) => {
    const copy = { ...allSteps }
    const step = { ...(copy[productIndex] || {}) }
    step[key] = { ...step[key], answer: ans }
    copy[productIndex] = step
    updateFormData({ decommissionSteps: copy })
  }

  const handleSubFiles = (stageKey, subKey, value) => {
    const copy = { ...allSteps }
    const step = { ...(copy[productIndex] || {}) }
    const prev = step[stageKey]?.evidence || {}
    step[stageKey] = { ...step[stageKey], evidence: { ...prev, [subKey]: value } }
    copy[productIndex] = step
    updateFormData({ decommissionSteps: copy })
  }

    const refr    = stepsForThis.refrigerant?.answer
    const safeAns = stepsForThis.safeRemoval?.answer
    const asbAns  = stepsForThis.asbestos?.answer

    let visible = []

    // 1. First three Qs
    visible.push(
      STAGES.find(s => s.key==='electrical'),
      STAGES.find(s => s.key==='gas'),
      STAGES.find(s => s.key==='refrigerant'),
      STAGES.find(s => s.key==='asbestos'),
    )

    if (asbAns === 'yes') {
      visible.push(
        STAGES.find(s => s.key==='asbestosTraining'),
        STAGES.find(s => s.key==='asbestosRoute'),
        STAGES.find(s => s.key==='asbestosControls'),
        STAGES.find(s => s.key==='asbestosClearance'),
        STAGES.find(s => s.key==='asbestosTransport'),
        STAGES.find(s => s.key==='asbestosRecords')
      )
    }

    visible.push(STAGES.find(s => s.key==='safeRemoval'))
    
    // 5. Branch on safeRemoval
    if (safeAns === 'yes') {
      visible.push(
        STAGES.find(s => s.key==='disposal')
      )

      if (refr === 'yes') {
          visible.push(STAGES.find(s => s.key==='disposeRefrigerant'))
      }
      visible.push(STAGES.find(s => s.key==='containsEWaste'))
      visible.push(STAGES.find(s => s.key==='containsDebris'))
    } else if (safeAns === 'no') {
      visible.push(STAGES.find(s => s.key==='renderUnusable'))
    }

    // 4️⃣ Render
    return (
      <CollapsibleSection id="decom-workflow" title="Decommissioning Workflow & Guidance" defaultOpen>
        <p style={{ fontStyle:'italic' }}>
          All evidence requiring photos, have to be geo-tagged and time-stamped. 
        </p>
        <table className="summary-table">
          <thead> 
            <tr>
              <th>Action (step-by-step)</th><th>Guidance</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(stage => {
              const ans = stepsForThis[stage.key]?.answer
              return (
                <tr key={stage.key}>
                  {/* ── Action */}
                  <td style={{whiteSpace:'pre-wrap',minWidth:200}}>
                    {/* <div style={{ display:'flex', alignItems:'center' }}> */}
                      {stage.help && (
                        <FaQuestionCircle
                          style={{ marginRight: 6, cursor: 'pointer' }}
                          title={`Click for guidance on ${stage.label}`}
                          onClick={() => setModalStage(`${stage.key}Help`)}
                        />
                      )}
                      {stage.type === 'decision'
                        ? <>
                            <div>{stage.label}</div>
                            <label><input type="radio" checked={ans==='yes'} onChange={()=>setAnswer(stage.key,'yes')} /> Yes</label>
                            <label><input type="radio" checked={ans==='no'}  onChange={()=>setAnswer(stage.key,'no')}  /> No</label>
                          </>
                        : <strong>{stage.label}</strong>
                      }
                    {/* </div> */}
                  </td>

                  {/* ── Guidance */}
                  <td style={{ whiteSpace: 'pre-wrap', color: '#333', position: 'relative' }}>
                    {(ans || stage.type === 'info') &&
                      (stage.details[ans] || stage.details).map((line, i) => (
                        <p key={i} style={{ margin: '0 0 .5em' }}>
                          • {line}
                        </p>
                      ))}

                    {/* Centered evidence button at bottom */}
                    {stage.evidenceFields.length > 0 && (
                      <div style={{ textAlign: 'center', marginTop: '1em' }}>
                        <button onClick={() => setModalStage(stage.key)}>
                          View / Add Evidence…
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {modalStage && modalStage.endsWith('Help') && (() => {
          const helpKey = modalStage.replace(/Help$/, '')
          const stageDef = STAGES.find(s => s.key === helpKey)
          return (
            <Modal onClose={() => setModalStage(null)}>
              <h2>Additional Information</h2>
              <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '1rem' }}>
                {stageDef.help.map((txt, i) => (
                  <p key={i} style={{ margin: '0 0 .5em' }}>• {txt}</p>
                ))}
              </div>
              <button onClick={() => setModalStage(null)}>Got it</button>
            </Modal>
          )
        })()}

        {/* ── Modal for uploads & thumbnails ─────────────────────── */}
        {modalStage && !modalStage.endsWith('Help') && (() => {
          const stageDef = STAGES.find(s => s.key === modalStage)
          const evidMap = stepsForThis[modalStage]?.evidence || {}
          const ans     = stepsForThis[modalStage]?.answer
          const toRender = stageDef.evidenceFields.filter(f =>
            f.when === 'info' || (Array.isArray(f.when) ? f.when.includes(ans) : f.when === ans)
          )
          return (
            <Modal onClose={() => setModalStage(null)}>
              <h2>{stageDef.label} Evidence</h2>
              <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '1rem' }}>
                {toRender.map(field => (
                  <EvidenceField
                    key={field.subKey}
                    stageKey={modalStage}
                    field={field}
                    value={evidMap[field.subKey]}
                    onChange={val => {
                      const prev = stepsForThis[modalStage]?.evidence || {}
                      const updatedStep = {
                        ...stepsForThis[modalStage],
                        evidence: { ...prev, [field.subKey]: val }
                      }
                      updateFormData({
                        decommissionSteps: {
                          ...formData.decommissionSteps,
                          [productIndex]: { ...stepsForThis, [modalStage]: updatedStep }
                        }
                      })
                    }}
                  />
                ))}
              </div>
              <button onClick={() => setModalStage(null)}>Done</button>
            </Modal>
          )
        })()}
    </CollapsibleSection>
  )
}