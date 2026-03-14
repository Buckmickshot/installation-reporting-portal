// src/contexts/SearchContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../relationship/supabaseConfig';
import { sectionsConfig } from '../utils/SectionsConfig';

const SearchContext = createContext();

export function SearchProvider({ children }) {
  const [entity, setEntity] = useState(null);
  const [filters, setFilters] = useState({});
  const [resultsMap, setResultsMap] = useState({});

  useEffect(() => {
    if (!entity) return;

    const cfg = Object.values(sectionsConfig).find(s => s.table === entity) || {};
    const validCols = Object.values(cfg.fields || {});

    const active = Object.entries(filters)
      .filter(([col, val]) =>
        val != null &&
        `${val}`.trim() !== '' &&
        validCols.includes(col)
      );

    let q = supabase.from(entity).select('*').limit(20);

    if (entity === 'consumer_details') {
      q = q
        .eq('is_draft', false)
    }

    active.forEach(([col, val]) => {
      const needsQuoting = /[^a-z0-9_]/i.test(col);
      const column = needsQuoting
        ? `"${col.replace(/"/g, '""')}"`
        : col;

      // exact match:
      q = q.ilike(column, `${val}%`);

      // or, if you want substring/case-insensitive:
      // q = q.ilike(column, `%${val}%`);
    });

    q.then(({ data, error }) => {
      setResultsMap(m => ({ ...m, [entity]: error ? [] : data || [] }));
    });
  }, [entity, filters]);


  return (
    <SearchContext.Provider value={{
      entity, setEntity,
      filters, setFilters,
      getResults: table => resultsMap[table] || []
    }}>
      {children}
    </SearchContext.Provider>
  );
}

export const useSearch = () => useContext(SearchContext);
