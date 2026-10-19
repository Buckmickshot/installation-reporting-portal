import { buildA6Model, BOX, BOX_COUNT } from '../a6Model';

const fd = {
  firstName: 'Alex', surname: 'Morgan', clientPhone: '0412 555 019', email: 'alex@example.com',
  installationAddress: '17 Banksia Street, Brunswick VIC 3056', installationDate: '2026-10-14',
  decommissionedProducts: [{ decommissionScenario: 'vi', brand: 'Fujitsu', model: 'ASTA09LCC', removed: true, ductReplacement: 'N/A', decommissionMethod: 'Recovered' }],
  installedProducts: [{ productCategory: '6E(i)', brand: 'Bonaire', model: 'CRC6911050', serialNo: 'SN1', areaBucket: '41-60', factSheetRec: true, unitConfiguration: 'Single split system' }],
  COESRequired: true, VBARequired: false, COESNo: 'C-1', typeOfBenefit: 'Price reduction', amountOfBenefit: '1150',
  priceBeforeVeec: '3500', consumerPayment: '2350', installerTasksDone: true, repairScope: 'none', accredittedPerson: 'ASAP Rebates',
};
const evidence = [
  { kind: 'installer_signature', note: 'Daniel Rossi', captured_at: '2026-10-14T03:00:00Z', file_url: 'x' },
  { kind: 'customer_signature', note: 'Alex Morgan', captured_at: '2026-10-14T03:02:00Z', file_url: 'y' },
];

test('maps the demo job onto the official form', () => {
  const { fields, ticks } = buildA6Model({ job: { job_ref: 'VEU-000002' }, formData: fd, evidence });
  expect(ticks).toHaveLength(BOX_COUNT);
  const on = Object.entries({
    'scenario vi': BOX.scenario.vi, removedYes: BOX.removedYes, '6E(i)': BOX.category['6E(i)'],
    sameMfrNA: BOX.sameMfr.na, ductNA: BOX.ductwork.na, area: BOX.area['41-60'], matchYes: BOX.matchYes,
    vbaReqNo: BOX.vbaReqNo, coesReqYes: BOX.coesReqYes, benefit: BOX.benefit['Price reduction'],
    scopeRemove: BOX.scopeRemove, repairNone: BOX.repair.none, coesRecvYes: BOX.coesRecvYes,
    informedYes: BOX.informedYes, factSheetYes: BOX.factSheetYes, sizeOkYes: BOX.sizeOkYes,
  });
  on.forEach(([name, i]) => expect([name, ticks[i]]).toEqual([name, true]));
  expect(ticks.filter(Boolean)).toHaveLength(on.length); // nothing else ticked (VBA not required → no "received" answer)
  expect(fields).toMatchObject({
    apName: 'ASAP Rebates', consumerName: 'Alex Morgan', prodBrand: 'Bonaire', serials: 'SN1', coesNo: 'C-1',
    benefitAmount: '$1,150.00', priceBefore: '3,500.00', consumerPayment: '2,350.00', decomBrand: 'Fujitsu',
    sig4Consumer: 'Signed electronically by Alex Morgan',
  });
});

test('product left on site ticks "No" and the leave-on-site scope', () => {
  const f2 = { ...fd, decommissionedProducts: [{ ...fd.decommissionedProducts[0], removed: false, notRemovedReason: 'Asbestos risk' }] };
  const { fields, ticks } = buildA6Model({ job: {}, formData: f2, evidence: [] });
  expect(ticks[BOX.removedNo]).toBe(true);
  expect(ticks[BOX.scopeLeave]).toBe(true);
  expect(fields.notRemovedReason).toBe('Asbestos risk');
});
