const cell = v => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** columns: [{ key, label, get?(row) }] */
export function toCsv(rows, columns) {
  const head = columns.map(c => cell(c.label)).join(',');
  const body = rows.map(r => columns.map(c => cell(c.get ? c.get(r) : r[c.key])).join(','));
  return [head, ...body].join('\r\n');
}

export function downloadCsv(filename, csv) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
