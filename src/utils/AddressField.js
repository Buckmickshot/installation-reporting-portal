import React, { useState, useEffect, useRef } from 'react';
import { useDebounce } from 'use-debounce';
import { useFormData } from '../contexts/FormDataContext';
import { env } from '../config/env';
import '../components/jobCreation/JobScreen.css';

/**
 * Address input with Geoscape (PSMA) predictive lookup.
 *
 * onChange(addressString, suggestion) fires when an address is committed:
 *   • with a Geoscape key  → only when a suggestion is picked (verified address)
 *   • without a key        → on blur / Enter with whatever was typed (manual entry)
 * It fires with '' when the field is cleared or edited away from a committed value.
 */
export default function AddressField({ label, value, onChange, section, verified = false }) {
  const { updateInvalidFields } = useFormData();
  const lookupEnabled = Boolean(env.geoscapeApiKey);

  const [input, setInput] = useState(value || '');
  const [debouncedInput] = useDebounce(input, 300);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const committedRef = useRef(value || '');

  // keep in sync when the parent value changes (e.g. job resumed / autofill)
  useEffect(() => {
    const clean = (typeof value === 'string' ? value : value?.address || '').trim();
    setInput(clean);
    committedRef.current = clean;
  }, [value]);

  useEffect(() => {
    if (!lookupEnabled || debouncedInput.length < 4 || debouncedInput === committedRef.current) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    fetch(
      `https://api.psma.com.au/v1/predictive/address?query=${encodeURIComponent(debouncedInput)}&maxNumberOfResults=10`,
      { headers: { Authorization: env.geoscapeApiKey, Accept: 'application/json' }, signal: ctrl.signal }
    )
      .then(res => res.json())
      .then(data => {
        setSuggestions(data.suggest || []);
        setOpen(true);
      })
      .catch(err => {
        if (err.name !== 'AbortError') setSuggestions([]);
      });
    return () => ctrl.abort();
  }, [debouncedInput, lookupEnabled]);

  const fieldId = `${section}-${label}`.replace(/\s+/g, '').toLowerCase();
  const isCommitted = input.trim() !== '' && input.trim() === committedRef.current;
  const showError = lookupEnabled && touched && input.trim() !== '' && !isCommitted;

  const commit = (address, suggestion = { address }) => {
    committedRef.current = address;
    setInput(address);
    setSuggestions([]);
    setOpen(false);
    updateInvalidFields(section, label, null);
    onChange(address, suggestion);
  };

  const handleTyping = e => {
    const val = e.target.value;
    setInput(val);
    if (committedRef.current) {
      committedRef.current = '';
      onChange('', null);
    }
  };

  const handleBlur = () =>
    setTimeout(() => {
      setOpen(false);
      setTouched(true);
      const trimmed = input.trim();
      if (!trimmed) {
        updateInvalidFields(section, label, null);
        return;
      }
      if (trimmed === committedRef.current) return;
      if (!lookupEnabled) return commit(trimmed);
      const match = suggestions.find(s => s.address === trimmed);
      if (match) commit(match.address, match);
      else updateInvalidFields(section, label, 'Invalid address');
    }, 150);

  return (
    <div className="field-group" id={fieldId}>
      <label className="field-label">
        {label}
        <span className={`asterisk ${!input || showError ? 'visible' : ''}`}>*</span>
      </label>
      <input
        type="text"
        className="field-input"
        value={input}
        placeholder={lookupEnabled ? 'Start typing an address…' : 'Street, suburb, state, postcode'}
        onChange={handleTyping}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={handleBlur}
        autoComplete="off"
      />

      {showError && (
        <p style={{ color: 'red', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Please select a valid address from the suggestions.
        </p>
      )}

      {open && suggestions.length > 0 && (
        <ul className="address-suggestions">
          {suggestions.map((s, i) => (
            <li key={i} onMouseDown={() => commit(s.address, s)}>
              {s.address}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
