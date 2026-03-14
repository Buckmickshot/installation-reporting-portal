import React, { useState } from 'react'
import { useFormData } from '../contexts/FormDataContext'
import { isValidEmail, isValidPhone } from './Enforce'
import '../components/jobCreation/JobScreen.css'

export default function Field({
  label,
  value,
  onChange,
  placeholder,
  section,
  type = 'text',
  min,
  max,
}) {
  const { updateInvalidFields } = useFormData()
  const [localError, setLocalError] = useState('')

  const isEmailField = label.toLowerCase().includes('email')
  const isPhoneField = label.toLowerCase().includes('phone')
  const fieldId = `${section}-${label}`.replace(/\s+/g, '').toLowerCase()

  const handleBlur = () => {
    let error = null
    const v = value?.toString().trim()

    // Existing email/phone checks
    if (isEmailField && v && !isValidEmail(v)) {
      error = 'Invalid Email'
    } else if (isPhoneField && v && !isValidPhone(v)) {
      error = 'Invalid Phone Number'
    }

    // New: numeric field checks
    else if (type === 'number' && v) {
      // not digits only
      if (!/^\d+$/.test(v)) {
        error = 'Must be a whole number'
      }
      // below minimum
      else if (min != null && Number(v) < Number(min)) {
        error = `Must be at least ${min}`
      }
      // above maximum
      else if (max != null && Number(v) > Number(max)) {
        error = `Cannot exceed ${max}`
      }
    }

    setLocalError(error)
    updateInvalidFields(section, label, error)
  }

  const handleChange = e => {
    onChange(e.target.value)
    if (localError) setLocalError('')
  }

  return (
    <div className="field-group" id={fieldId}>
      <label className="field-label">
        {label}
        <span className={`asterisk ${!value || localError ? 'visible' : ''}`}>
          *
        </span>
      </label>

      <input
        type={type}
        placeholder={placeholder || label}
        value={value ?? ''}
        onChange={handleChange}
        onBlur={handleBlur}
        className="field-input"
        {...(type === 'number'
          ? {
              inputMode: 'numeric',
              pattern: '\\d*',
              min,
              max,
            }
          : {})}
      />

      {localError && <div className="error-text">{localError}</div>}
    </div>
  )
}