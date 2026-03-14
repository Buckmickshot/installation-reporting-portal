// src/components/jobCreation/RightSideBar.js
import React from 'react';
import { useSearch } from '../../contexts/SearchContext';
import './JobScreen.css';
import { sectionsConfig } from '../../utils/SectionsConfig';

export default function RightSideBar({ sections, onSelect }) {
  const { getResults } = useSearch();

  // 1️⃣ flatten all rows across every section
  const raw = Object.values(sections).flatMap(table => getResults(table) || []);

  // 2️⃣ dedupe—use the 4-field identity if present, otherwise fall back to the PK key
  const seen = new Set();
  const entries = [];

  for (const r of raw) {
    // build identity key if this is a “customer”-like record
    let key;
    if (r.first_name != null || r.last_name != null) {
      key = [
        (r.first_name    || '').trim(),
        (r.last_name     || '').trim(),
        (r.phone_number  || '').trim(),
        (r.email_address || '').trim(),
      ].join('|');
    } else if (r.registry_id) {
      key = `registry:${r.registry_id}`;
    } else if (r.electrician_id) {
      key = `electrician:${r.electrician_id}`;
    } else if (r.plumber_id) {
      key = `plumber:${r.plumber_id}`;
    } else if (r.handler_id) {
      key = `handler:${r.handler_id}`;
    } else {
      // ultimate fallback (should be rare)
      key = JSON.stringify(r);
    }

    if (!seen.has(key)) {
      seen.add(key);
      entries.push(r);
    }
  }

  // 3️⃣ render
  return (
    <div className="sidebar-right">
      <div className="sidebar-header">Suggestions &amp; Autofill</div>
      <div className="sidebar-content">
        {entries.length === 0 ? (
          <div style={{ color:'#888', fontStyle:'italic', padding:'1rem' }}>
            No suggestions yet
          </div>
        ) : entries.map((rec, i) => (
          <div key={i} className="sidebar-record">
            {/* Identify Activity 6 rows by presence of first config field */}
            {rec[sectionsConfig['Activity 6 Registry'].fields.productCategory] !== undefined ? (
              <>
                {Object.entries(sectionsConfig['Activity 6 Registry'].fields).map(
                  ([stateKey, columnName]) => (
                    <div key={stateKey} style={{ marginBottom: '0.25rem' }}>
                      <strong>{columnName}:</strong> {rec[columnName] ?? ''}
                    </div>
                  )
                )}
              </>
            ) : (
              <pre style={{ fontSize: '0.75rem' }}>
                {JSON.stringify(rec, null, 2)}
              </pre>
            )}

            <div style={{ textAlign:'right', marginTop:8 }}>
              <button onClick={() => onSelect(rec)}>Use</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
