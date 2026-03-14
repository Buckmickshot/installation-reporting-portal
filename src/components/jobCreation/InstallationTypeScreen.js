// src/components/jobCreation/InstallationTypeScreen.js
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { INSTALLATION_TYPES } from '../constants/InstallationTypesData'
import './JobScreen.css'
import RadioField from '../../utils/RadioField'
import { useFormData } from '../../contexts/FormDataContext'
import { supabase } from '../../relationship/supabaseConfig'
import { safeQuery } from '../Authentication/SafeQuery'
import { useAuth } from '../../contexts/AuthProvider'

export default function InstallationTypeScreen() {
  const [selected, setSelected] = useState(null)
  const [variant, setVariant]   = useState(null)

  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { formData, updateFormData, resetFormData } = useFormData()

  const activity = INSTALLATION_TYPES.find(a => a.value === selected)
  const hasVariants = Boolean(activity?.variants)
  const canContinue = Boolean(selected) && (!hasVariants || Boolean(variant))

  /**
   * STEP 1: user picks activity + premises‑type
   *   • update the draft installation row with activity_type
   *   • call rpc.fn_create_draft_premises(company_id, installation_id, premises_type)
   *   • store the returned IDs in context for downstream screens
   */
  const goNext = async () => {
    if (!canContinue) return
  
    // 1️⃣ Create a new installation + initial draft premises
    const payload = {
      _company:       formData.companyId,
      _activity_type: selected,
      _prem_type:     variant
    }
  
    const { data: row, error } = await safeQuery(
      () => supabase
              .rpc('fn_create_installation_with_premises', payload)
              .single(),
      { signOut, navigate }
    )
  
    if (error) {
      console.error('create-installation error:', error)
      return
    }
    if (!row) {
      console.error('No data returned from fn_create_installation_with_premises')
      return
    }
  
    // row.installation_id and row.premises_id are now set
    updateFormData({
      installationId: row.installation_id,
      premisesId:     row.premises_id,
      activityType:   selected,
      premisesType:   variant
    })
  
    // 2️⃣ Move on to the next screen
    const base = `/create-job/${selected}`
    const path = hasVariants
      ? `${base}/${variant}/customer`
      : `${base}/customer`
    navigate(path)
  }
  
  return (
    <div className="installation-screen">
      <h2>Pick a VEEC installation activity</h2>

      <RadioField
        name="activity"
        layout="grid"
        section="installation-type"
        options={INSTALLATION_TYPES.map(a => ({ label: a.label, value: a.value }))}
        selectedValue={selected}
        onChange={(val) => {
          setSelected(val)
          setVariant(null)   // reset variant when activity changes
        }}
      />

      {hasVariants && (
        <div className="variant-box-wrapper">
          <div className="variant-arrow" />
          <RadioField
            name="variant"
            label="Premise type:"
            layout="horizontal"
            section="variant"
            options={activity.variants}
            selectedValue={variant}
            onChange={setVariant}
          />
        </div>
      )}

      <div className="button-row">
        <button
          className="back-button"
          onClick={() => {
            resetFormData()
            navigate('/')
          }}
        >
          Back
        </button>

        <button
          className="continue-button"
          disabled={!canContinue}
          onClick={goNext}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
