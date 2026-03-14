import React from 'react'
import FileUploadField from './FileUploadField'

export default function EvidenceField({ stageKey, field, value, onChange }) {
  const { subKey, label, accept} = field
  const inputType = field.hasOwnProperty('inputType')
  ? field.inputType
  : 'file'

  const multiple = field.hasOwnProperty('multiple')
  ? field.multiple
  : (inputType === 'file')
  const id = `${stageKey}-${subKey}`

  switch (inputType) {
    case 'file':
      return (
        <div style={{ margin: '1rem 0' }}>
          <strong>{label}</strong>
          <FileUploadField
            attachments={value || []}
            onFilesSelected={files => onChange(files)}
            accept={accept}
            multiple={multiple}
          />
        </div>
      )

    case 'text':
      return (
        <div style={{ margin: '1rem 0' }}>
          <label htmlFor={id}><strong>{label}</strong></label><br />
          <input
            id={id}
            type="text"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            style={{ width: '100%', marginTop: 4 }}
          />
        </div>
      )

    case 'textarea':
      return (
        <div style={{ margin: '1rem 0' }}>
          <label htmlFor={id}><strong>{label}</strong></label>
          <textarea
            id={id}
            rows={4}
            style={{ width: '100%', marginTop: 4 }}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
          />
        </div>
      )

    case 'checkbox':
      return (
        <div style={{ margin: '1rem 0' }}>
          <label>
            <input
              id={id}
              type="checkbox"
              checked={!!value}
              onChange={e => onChange(e.target.checked)}
            />{' '}
            {label}
          </label>
        </div>
      )

    default:
      return null
  }
}
