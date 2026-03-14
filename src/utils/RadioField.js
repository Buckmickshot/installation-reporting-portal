import React from 'react';
import '../components/jobCreation/JobScreen.css';

export default function RadioField({
  label,
  name,
  options,
  selectedValue,
  onChange,
  layout = 'vertical',
  section,
  alignDashes = false // NEW PARAMETER
}) {
  const layoutClass = {
    vertical: 'radio-options-vertical',
    horizontal: 'radio-options-horizontal',
    grid: 'radio-options'
  }[layout];
  const fieldId = `${section}-${label}`.replace(/\s+/g, '').toLowerCase();

  return (
    <div className="field-group" id={fieldId}>
      {label && (
        <label className="field-label">
          {label}
          <span className={`asterisk ${(selectedValue === null || selectedValue === undefined || selectedValue === '') ? 'visible' : ''}`}>*</span>
        </label>
      )}

      <div className={layoutClass}>
        {options.map(({ label, value }) => {
          let code = null;
          let desc = null;
          
          if (alignDashes) {
            const match = label.match(/^(Scenario \(\w+\))\s*[–-]\s*(.+)$/);
            if (match) {
              code = match[1];
              desc = match[2];
            }
          }
          
          return (
            <label key={value} className="radio-option">
              <input
                type="radio"
                name={name}
                value={value}
                checked={selectedValue === value}
                onChange={() => onChange(value)}
              />
            {alignDashes && code && desc ? (
              <span className="aligned-radio-label">
                <span className="scenario-code">{code}</span>
                <span className="scenario-dash">–</span>
                <span className="scenario-desc">{desc}</span>
              </span>
            ) : (
              label
            )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
