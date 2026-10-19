// Maps a job to every field and tick box of the ESC "VEEC Assignment Form
// Template: Space Heating and Cooling (Activity 6) – Residential Premises" V1.4.
// Shared by the Word (official template) and PDF outputs.
import { BRAND } from '../config/brand';
import { formatDate } from '../utils/jobStatus';

// Tick boxes in document order (see dev/forms/build_a6_template.py output)
export const BOX = {
  scenario: { i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6, viii: 7, ix: 8, x: 9, xi: 10 },
  removedYes: 11, removedNo: 12,
  category: { '6A': 13, '6B(ii)': 14, '6D': 15, '6E(ii)': 16, '6G': 17, '6B(i)': 18, '6C': 19, '6E(i)': 20, '6F': 21 },
  sameMfr: { yes: 22, no: 23, na: 24 },
  ductwork: { yes: 25, no: 26, na: 27 },
  area: { '0-20': 28, '21-40': 29, '41-60': 30, '61-80': 31, '81-100': 32, '101-120': 33, '121-140': 34, '141-160': 35, '161+': 36 },
  matchYes: 37, matchNo: 38,
  vbaReqYes: 39, vbaReqNo: 40,
  coesReqYes: 41, coesReqNo: 42,
  benefit: { 'Upfront cash': 43, 'Price reduction': 44, 'Delayed cash': 45, 'Free installation': 46, Other: 47 },
  scopeRemove: 48, scopeLeave: 49,
  repair: { all: 50, some: 51, none: 52 },
  vbaRecvYes: 53, vbaRecvNo: 54,
  coesRecvYes: 55, coesRecvNo: 56,
  informedYes: 57, informedNo: 58,
  factSheetYes: 59, factSheetNo: 60,
  sizeOkYes: 61, sizeOkNo: 62,
};
export const BOX_COUNT = 63;

const isTrue = v => v === true || v === 'true';
const isFalse = v => v === false || v === 'false';
const join = (arr, sep = '; ') => arr.filter(Boolean).join(sep);
const money = v => (v === '' || v == null || isNaN(Number(v)) ? '' : Number(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const areaKey = b => (b ? String(b).replace(/\s/g, '').replace(/m.*$/, '').replace(/\+$/, '+') : null);

export function buildA6Model({ job, formData: fd, evidence = [] }) {
  const ticks = new Array(BOX_COUNT).fill(false);
  const tick = i => { if (i != null) ticks[i] = true; };

  const decom = (fd.decommissionedProducts || []).filter(p => p.decommissionScenario || p.brand || p.model);
  const prods = (fd.installedProducts || []).filter(p => p.brand || p.model);
  const sig = kind => evidence.filter(e => e.kind === kind).slice(-1)[0] || null;
  const instSig = sig('installer_signature');
  const custSig = sig('customer_signature');
  const signedOn = e => (e ? formatDate(e.captured_at) : '');
  const signedBy = e => (e ? `Signed electronically by ${e.note || 'signatory'}` : '');

  // decommissioning
  decom.forEach(p => tick(BOX.scenario[p.decommissionScenario]));
  if (!decom.length) tick(BOX.scenario.xi);
  const removedAll = decom.length && decom.every(p => isTrue(p.removed));
  const anyNotRemoved = decom.some(p => isFalse(p.removed));
  if (decom.length) tick(anyNotRemoved ? BOX.removedNo : removedAll ? BOX.removedYes : null);

  // installed products
  prods.forEach(p => tick(BOX.category[p.productCategory]));
  const multi = prods.some(p => /multi/i.test(p.unitConfiguration || ''));
  tick(multi ? null : BOX.sameMfr.na);
  const duct = decom.map(p => p.ductReplacement).find(Boolean);
  tick(duct === 'N/A' || !duct ? BOX.ductwork.na : isTrue(duct) ? BOX.ductwork.yes : BOX.ductwork.no);
  prods.forEach(p => tick(BOX.area[areaKey(p.areaBucket)]));
  const recommended = prods.length ? prods.every(p => p.factSheetRec !== false) : null;
  if (recommended !== null) tick(recommended ? BOX.matchYes : BOX.matchNo);

  // certificates
  const vbaReq = isTrue(fd.VBARequired) || decom.some(p => isTrue(p.VBARequired));
  const coesReq = isTrue(fd.COESRequired) || decom.some(p => isTrue(p.COESRequired));
  tick(vbaReq ? BOX.vbaReqYes : BOX.vbaReqNo);
  tick(coesReq ? BOX.coesReqYes : BOX.coesReqNo);
  const vbaNo = fd.VBAComplianceCertificateNo || fd.vbaCertificateNumber || fd.VBANo || '';
  const coesNo = fd.COESNo || fd.coesCertificateNumber || '';

  // benefit
  tick(BOX.benefit[fd.typeOfBenefit]);

  // Section 3 scope of work
  if (decom.length) tick(anyNotRemoved ? BOX.scopeLeave : BOX.scopeRemove);
  tick(BOX.repair[fd.repairScope || 'none']);

  // Section 4 consumer acknowledgements
  if (vbaReq) tick(vbaNo ? BOX.vbaRecvYes : BOX.vbaRecvNo);
  if (coesReq) tick(coesNo ? BOX.coesRecvYes : BOX.coesRecvNo);
  if (vbaReq || coesReq) tick(isTrue(fd.installerTasksDone) ? BOX.informedYes : BOX.informedNo);
  tick(isTrue(fd.installerTasksDone) ? BOX.factSheetYes : BOX.factSheetNo);
  if (recommended !== null) tick(recommended ? BOX.sizeOkYes : BOX.sizeOkNo);

  const apName = fd.accredittedPerson || BRAND.accreditedPerson;
  const fields = {
    apName,
    apContact: BRAND.contactLine,
    jobRef: job.job_ref || '',
    installAddress: fd.installationAddress || '',
    installDate: fd.installationDate ? formatDate(fd.installationDate) : '',
    elecName: fd.electricianName || '', elecCompany: fd.electricianCompanyName || '', elecAddress: fd.electricianCompanyAddress || '',
    elecPhone: fd.electricianPhone || '', elecLicence: fd.electricianLicenseNo || '',
    lpName: fd.licencedPlumberName || '', lpCompany: fd.licencedPlumberCompanyName || '', lpAddress: fd.licencedPlumberCompanyAddress || '',
    lpPhone: fd.licencedPlumberPhone || '', lpLicence: fd.licencedPlumberLicenseNo || '',
    rpName: fd.registeredPlumberName || '', rpCompany: fd.registeredPlumberCompanyName || '', rpAddress: fd.registeredPlumberCompanyAddress || '',
    rpPhone: fd.registeredPlumberPhone || '', rpLicence: fd.registeredPlumberRegistrationNo || '',
    rhName: fd.refrigerantHandlerName || '', rhCompany: fd.refrigerantHandlerCompanyName || '', rhAddress: fd.refrigerantHandlerCompanyAddress || '',
    rhPhone: fd.refrigerantHandlerPhone || '', rhLicence: fd.refrigerantHandlerLicenseNo || '',
    decomBrand: join(decom.map(p => p.brand)), decomModel: join(decom.map(p => p.model)),
    decomMethod: join(decom.map(p => p.decommissionMethod)),
    notRemovedReason: join(decom.filter(p => isFalse(p.removed)).map(p => p.notRemovedReason)),
    prodBrand: join(prods.map(p => p.brand)), prodModel: join(prods.map(p => p.model)),
    serials: join(prods.map(p => p.serialNo)),
    sumHeat: multi ? String(fd.multiSplitHeatingCapacity || prods.reduce((s, p) => s + (Number(p.heatingCapacity) || 0), 0)) : '',
    sumCool: multi ? String(fd.multiSplitCoolingCapacity || prods.reduce((s, p) => s + (Number(p.coolingCapacity) || 0), 0)) : '',
    sizeReason: join(prods.filter(p => p.factSheetRec === false).map(p => p.factSheetReason || p.sizeReason)),
    coesNo, vbaNo,
    benefitOther: fd.typeOfBenefit === 'Other' ? fd.otherBenefit || '' : '',
    benefitAmount: fd.amountOfBenefit ? `$${money(fd.amountOfBenefit)}` : '',
    priceBefore: money(fd.priceBeforeVeec), consumerPayment: money(fd.consumerPayment),
    repairDetails: fd.repairScope === 'some' ? fd.repairDetails || '' : '',
    sig2Installer: signedBy(instSig), date2Installer: signedOn(instSig),
    sig3aInstaller: signedBy(instSig), date3aInstaller: signedOn(instSig),
    sig3bConsumer: signedBy(custSig), date3bConsumer: signedOn(custSig),
    consumerName: join([fd.firstName, fd.surname], ' '), consumerPhone: fd.clientPhone || '', consumerEmail: fd.email || '',
    sig4Consumer: signedBy(custSig), date4Consumer: signedOn(custSig),
  };
  return { fields, ticks, signatures: { installer: instSig, customer: custSig }, multi };
}
