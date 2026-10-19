import { readinessChecklist } from '../readiness';
import { availableActions, isEditable } from '../jobStatus';
import { isValidPhone, isValidEmail } from '../Enforce';
import { toCsv } from '../csv';

const completeJob = {
  firstName: 'Sam', surname: 'Citizen', clientPhone: '0412 345 678', email: 'sam@example.com',
  installationAddress: '1 Test St, Richmond VIC 3121', buildingAgeCheck: true,
  buildingDates: { certificateDateFiles: [{ url: 'u', name: 'coo.pdf' }], certificateDate: '2010-01-01' },
  installedProducts: [{ brand: 'Demo Air', model: 'DA-25RC', productCategory: '6A', serialNo: 'SN1' }],
  decommissionedProducts: [{ decommissionScenario: 'i', brand: 'Old', model: 'X' }],
  licencedPlumberName: 'P', licencedPlumberLicenseNo: '1',
  electricianName: 'E', electricianLicenseNo: '2',
  refrigerantHandlerName: 'R', refrigerantHandlerLicenseNo: '3',
  installationDate: '2026-10-18',
};
const allEvidence = ['new_outdoor_unit', 'new_unit_nameplate', 'old_unit', 'customer_signature', 'installer_signature'].map(kind => ({ kind }));

describe('readinessChecklist', () => {
  test('complete job with evidence is ready', () => {
    const r = readinessChecklist(completeJob, allEvidence);
    expect(r.ready).toBe(true);
    expect(r.done).toBe(r.total);
  });
  test('missing serial and signature blocks readiness', () => {
    const job = { ...completeJob, installedProducts: [{ ...completeJob.installedProducts[0], serialNo: '' }] };
    const r = readinessChecklist(job, allEvidence.filter(e => e.kind !== 'customer_signature'));
    expect(r.ready).toBe(false);
    const missing = r.items.filter(i => !i.ok).map(i => i.label);
    expect(missing).toEqual(expect.arrayContaining(['Every new product has a serial number', 'Customer signature']));
  });
  test('old-unit photo only required when something was decommissioned', () => {
    const job = { ...completeJob, decommissionedProducts: [{ decommissionScenario: '', brand: '', model: '' }] };
    const labels = readinessChecklist(job, []).items.map(i => i.label);
    expect(labels).not.toContain('Photo of the old / removed unit');
  });
  test('COES number required when a product needs a COES', () => {
    const job = { ...completeJob, decommissionedProducts: [{ decommissionScenario: 'i', COESRequired: true }] };
    expect(readinessChecklist(job, allEvidence).ready).toBe(false);
    expect(readinessChecklist({ ...job, COESNo: 'C123' }, allEvidence).ready).toBe(true);
  });
});

describe('status actions mirror the database rules', () => {
  const to = (s, admin) => availableActions(s, admin).map(a => a.to);
  test('staff can only send for review or cancel a draft', () => {
    expect(to('draft', false)).toEqual(['ready_for_review', 'cancelled']);
    expect(to('ready_for_review', false)).toEqual(['draft']);
    expect(to('submitted', false)).toEqual([]);
  });
  test('admins review, submit, approve and mark paid', () => {
    expect(to('ready_for_review', true)).toEqual(expect.arrayContaining(['submitted', 'rfi', 'cancelled']));
    expect(to('submitted', true)).toEqual(expect.arrayContaining(['approved', 'rfi']));
    expect(to('approved', true)).toEqual(['paid']);
  });
  test('submitted jobs are locked for staff only', () => {
    expect(isEditable('submitted', false)).toBe(false);
    expect(isEditable('submitted', true)).toBe(true);
    expect(isEditable('rfi', false)).toBe(true);
  });
});

describe('validation', () => {
  test.each(['0412345678', '0412 345 678', '+61 412 345 678', '03 9123 4567', '(03) 9123-4567', '1300 123 456'])('accepts %s', p =>
    expect(isValidPhone(p)).toBe(true));
  test.each(['12345', '0512345678', 'phone'])('rejects %s', p => expect(isValidPhone(p)).toBe(false));
  test('email', () => {
    expect(isValidEmail('a.b+c@example.com.au')).toBe(true);
    expect(isValidEmail('nope@')).toBe(false);
  });
});

test('csv escapes commas, quotes and newlines', () => {
  const csv = toCsv([{ a: 'x,y', b: 'say "hi"', c: 'l1\nl2' }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }]);
  expect(csv).toBe('A,B,C\r\n"x,y","say ""hi""","l1\nl2"');
});
