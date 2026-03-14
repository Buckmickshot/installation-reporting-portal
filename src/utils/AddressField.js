import React, { useState, useEffect, useRef } from 'react';
import { useDebounce } from 'use-debounce';
import { useFormData } from '../contexts/FormDataContext';
import { env } from '../config/env';
import '../components/jobCreation/JobScreen.css';

export default function AddressField({
  label,
  value,
  onChange,
  section,
  verified = false,
}) {
  const { updateFormData, updateInvalidFields } = useFormData();
  const [input, setInput] = useState(value || '');
  const [debouncedInput] = useDebounce(input, 300);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [touched, setTouched] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [isFromVerifiedInput, setIsFromVerifiedInput] = useState(verified); // ✅ new

  const lastSelectedRef = useRef('');
  const latestSuggestionsRef = useRef([]);

  useEffect(() => {
    const clean = value?.trim() || '';
    setInput(clean);
    if (verified && clean) {
      setIsValid(true);
      lastSelectedRef.current = clean;
      setTouched(true);
      setIsFromVerifiedInput(true); // ✅ prevent fetch/suggestions
    } else {
      setIsFromVerifiedInput(false);
    }
  }, [value, verified]);

  useEffect(() => {
    if (
      !debouncedInput ||
      debouncedInput.length < 4 ||
      debouncedInput === lastSelectedRef.current ||
      isFromVerifiedInput // ✅ skip if verified
    ) {
      setSuggestions([]);
      latestSuggestionsRef.current = [];
      return;
    }

    if (!env.geoscapeApiKey) {
      setSuggestions([]);
      latestSuggestionsRef.current = [];
      return;
    }

    fetch(
      `https://api.psma.com.au/v1/predictive/address?query=${encodeURIComponent(
        debouncedInput
      )}&maxNumberOfResults=10`,
      {
        headers: {
          Authorization: env.geoscapeApiKey,
          Accept: 'application/json',
        },
      }
    )
      .then(res => res.json())
      .then(data => {
        const results = data.suggest || [];
        setSuggestions(results);
        latestSuggestionsRef.current = results;
      })
      .catch(err => {
        console.error('address fetch error', err);
        setSuggestions([]);
        latestSuggestionsRef.current = [];
      });
  }, [debouncedInput, isFromVerifiedInput]); // ✅ added dependency

  useEffect(() => {
    if (suggestions.length > 0 && !isFromVerifiedInput) {
      setShowSuggestions(true); // ✅ suppress if verified
    }
  }, [suggestions, isFromVerifiedInput]);

  const fieldId = `${section}-${label}`.replace(/\s+/g, '').toLowerCase();

  const handleSelect = suggestion => {
    const fullAddress = suggestion.address;
    lastSelectedRef.current = fullAddress;
    setInput(fullAddress);
    setIsValid(true);
    setTouched(true);
    setIsFromVerifiedInput(true); // ✅ mark verified after selection
    updateInvalidFields(section, label, null);
    onChange(suggestion); // ✅ passes the suggestion to parent
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleTyping = e => {
    const val = e.target.value;
    setInput(val);
    setShowSuggestions(true);

    if (val.trim() === '') {
      lastSelectedRef.current = '';
      setIsValid(false);
      setIsFromVerifiedInput(false);
      updateInvalidFields(section, label, null);
      updateFormData({ installationAddress: '' });
      return;
    }

    lastSelectedRef.current = '';
    setIsValid(false);
    setIsFromVerifiedInput(false); // ✅ not from verified anymore
    updateFormData({ installationAddress: '' }); // ✅ clear verified address
  };

  const handleValidation = () => {
    setTouched(true);
    const trimmed = input.trim();

    if (!trimmed) {
      setIsValid(false);
      lastSelectedRef.current = '';
      updateInvalidFields(section, label, null);
      return;
    }

    if (trimmed === lastSelectedRef.current) {
      setIsValid(true);
      updateInvalidFields(section, label, null);
      return;
    }

    const matched = latestSuggestionsRef.current.some(
      s => s.address === trimmed
    );

    setIsValid(matched);
    updateInvalidFields(section, label, matched ? null : 'Invalid address');
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter') {
      handleValidation();
      setShowSuggestions(false);
    }
  };

  return (
    <div className="field-group" id={fieldId}>
      <label className="field-label">
        {label}
        <span
          className={`asterisk ${!input || (!isValid && touched) ? 'visible' : ''
            }`}
        >
          *
        </span>
      </label>
      <input
        type="text"
        className="field-input"
        value={input}
        placeholder={label}
        onChange={handleTyping}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (!isFromVerifiedInput && suggestions.length > 0) {
            setShowSuggestions(true); // ✅ suppress if verified
          }
        }}
        onBlur={() =>
          setTimeout(() => {
            setShowSuggestions(false);
            handleValidation();
          }, 150)
        }
      />

      {!isValid && touched && input.length > 0 && (
        <p
          style={{
            color: 'red',
            fontSize: '0.875rem',
            marginTop: '0.25rem',
          }}
        >
          Please select a valid address from the suggestions.
        </p>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <ul className="address-suggestions">
          {suggestions.map((s, i) => (
            <li key={i} onMouseDown={() => handleSelect(s)}>
              {s.address}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
