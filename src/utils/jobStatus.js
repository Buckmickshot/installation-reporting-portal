export const STATUSES = [
  { value: 'draft', label: 'Draft', tone: 'neutral', hint: 'Being filled in' },
  { value: 'rfi', label: 'Info requested', tone: 'warn', hint: 'Reviewer needs more information' },
  { value: 'ready_for_review', label: 'Ready for review', tone: 'info', hint: 'Waiting for an admin to check' },
  { value: 'submitted', label: 'Submitted', tone: 'accent', hint: 'Lodged with the VEU registry' },
  { value: 'approved', label: 'Approved', tone: 'good', hint: 'VEECs created' },
  { value: 'paid', label: 'Paid', tone: 'good', hint: 'Rebate settled' },
  { value: 'cancelled', label: 'Cancelled', tone: 'muted', hint: 'Will not proceed' },
];

export const STATUS_BY_VALUE = Object.fromEntries(STATUSES.map(s => [s.value, s]));
export const statusLabel = v => STATUS_BY_VALUE[v]?.label ?? v;

/**
 * Actions available for a job — mirrors the rules in fn_set_job_status.
 * Each: { to, label, kind: 'primary'|'secondary'|'danger', needsMessage, requiresReady }
 */
export function availableActions(status, isAdmin) {
  const a = [];
  if (status === 'draft' || status === 'rfi')
    a.push({ to: 'ready_for_review', label: status === 'rfi' ? 'Resubmit for review' : 'Send for review', kind: 'primary', requiresReady: true });
  if (status === 'ready_for_review') a.push({ to: 'draft', label: 'Pull back to draft', kind: 'secondary' });
  if (isAdmin && status === 'ready_for_review') {
    a.push({ to: 'submitted', label: 'Mark as submitted to VEU', kind: 'primary', requiresReady: true });
    a.push({ to: 'rfi', label: 'Request information', kind: 'secondary', needsMessage: true });
  }
  if (isAdmin && status === 'submitted') {
    a.push({ to: 'approved', label: 'Mark approved', kind: 'primary' });
    a.push({ to: 'rfi', label: 'Request information', kind: 'secondary', needsMessage: true });
  }
  if (isAdmin && status === 'approved') a.push({ to: 'paid', label: 'Mark paid', kind: 'primary' });
  if (status === 'draft' || (isAdmin && ['ready_for_review', 'rfi', 'submitted'].includes(status)))
    a.push({ to: 'cancelled', label: 'Cancel job', kind: 'danger', needsMessage: true });
  if (isAdmin && status === 'cancelled') a.push({ to: 'draft', label: 'Reopen as draft', kind: 'secondary' });
  return a;
}

export const isEditable = (status, isAdmin) => isAdmin || ['draft', 'rfi', 'ready_for_review'].includes(status);

export const EVIDENCE_KINDS = [
  { value: 'old_unit', label: 'Old unit (before removal)', group: 'photo' },
  { value: 'old_unit_nameplate', label: 'Old unit nameplate', group: 'photo' },
  { value: 'decommissioned_unit', label: 'Decommissioned / removed unit', group: 'photo' },
  { value: 'new_indoor_unit', label: 'New indoor unit installed', group: 'photo' },
  { value: 'new_outdoor_unit', label: 'New outdoor unit installed', group: 'photo' },
  { value: 'new_unit_nameplate', label: 'New unit nameplate / serial', group: 'photo' },
  { value: 'other', label: 'Other', group: 'photo' },
  { value: 'customer_signature', label: 'Customer signature', group: 'signature' },
  { value: 'installer_signature', label: 'Installer signature', group: 'signature' },
];
export const evidenceLabel = v => EVIDENCE_KINDS.find(k => k.value === v)?.label ?? v;

export function formatDate(d, withTime = false) {
  if (!d) return '—';
  const opts = withTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Date(d).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', ...opts });
}
