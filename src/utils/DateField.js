import React, { useState, useEffect } from 'react';
import moment from 'moment';
import { useFormData } from '../contexts/FormDataContext';
import '../components/jobCreation/JobScreen.css';

export default function DateField({
  label,
  value,       // ISO string "YYYY-MM-DD"
  onChange,    // will be called with new ISO string
  error,       // external error message from parent
  section,
  fieldName
}) {
  const { updateInvalidFields } = useFormData();
  const [display, setDisplay] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (value) {
      setDisplay(moment(value, 'YYYY-MM-DD').format('DD/MM/YYYY'));
    } else {
      setDisplay('');
    }
  }, [value]);

  const handleInput = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    let disp = raw;

    if (raw.length > 2 && raw.length <= 4) {
      disp = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    } else if (raw.length > 4) {
      disp = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4, 8)}`;
    }

    setDisplay(disp);

    const m = moment(disp, 'DD/MM/YYYY', true);
    if (m.isValid()) {
      onChange(m.format('YYYY-MM-DD'));
    }
  };

  const handleBlur = () => {
    const m = moment(display, 'DD/MM/YYYY', true);
    let errorMsg = error || '';

    if (!display) {
      errorMsg = '';
    } else if (!m.isValid()) {
      errorMsg = 'Invalid date';
    } else if (m.isAfter(moment(), 'day')) {
      errorMsg = 'Date must be before today';
    }

    setLocalError(errorMsg);
    if (section && fieldName) {
      updateInvalidFields(section, fieldName, errorMsg);
    }
  };

  return (
    <div className="field-group">
      <label className="field-label">
        {label}
        {!value && <span className="asterisk">*</span>}
      </label>
      <input
        type="text"
        className="field-input"
        placeholder="DD/MM/YYYY"
        value={display}
        maxLength={10}
        onChange={handleInput}
        onBlur={handleBlur}
      />
      {(error || localError) && (
        <div className="error-text">
          {error || localError}
        </div>
      )}
    </div>
  );
}
