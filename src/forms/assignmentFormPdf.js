// Generates the completed VEEC assignment record (Activity 6 – residential) as a
// PDF in the browser: consumer & premises, decommissioning, installation and
// tradespeople, assignment of certificates, signatures and photo evidence.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getScenarios } from '../components/constants/Decommissioning';
import { evidenceLabel, formatDate } from '../utils/jobStatus';

const A4 = [595.28, 841.89];
const M = 42; // margin
const INK = rgb(0.11, 0.15, 0.2);
const SUB = rgb(0.36, 0.41, 0.47);
const LINE = rgb(0.85, 0.88, 0.91);
const NAVY = rgb(0.17, 0.24, 0.31);
const ACCENT = rgb(0.2, 0.6, 0.86);

// Standard PDF fonts only cover WinAnsi — map the few characters we use that it lacks.
const clean = v =>
  String(v ?? '')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/[↔]/g, '<->')
    .replace(/[✓✔]/g, 'Yes')
    .replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•…€]/g, '');

const yesNo = v => (v === true || v === 'true' ? 'Yes' : v === false || v === 'false' ? 'No' : v ? String(v) : '—');

async function fetchImage(pdf, url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    return isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

class Writer {
  constructor(pdf, fonts, meta) {
    this.pdf = pdf;
    this.f = fonts;
    this.meta = meta;
    this.page = null;
    this.y = 0;
    this.newPage();
  }

  newPage() {
    this.page = this.pdf.addPage(A4);
    const { page } = this;
    page.drawRectangle({ x: 0, y: A4[1] - 54, width: A4[0], height: 54, color: NAVY });
    page.drawText('Victorian Energy Upgrades  ·  Activity 6 – Space heating & cooling (Residential)', {
      x: M, y: A4[1] - 24, size: 10.5, font: this.f.bold, color: rgb(1, 1, 1),
    });
    page.drawText(clean(`VEEC assignment record  ·  ${this.meta.jobRef}  ·  ${this.meta.company}`), {
      x: M, y: A4[1] - 40, size: 8.5, font: this.f.reg, color: rgb(0.85, 0.9, 0.95),
    });
    if (this.meta.watermark) {
      page.drawText(this.meta.watermark, {
        x: 95, y: 330, size: 46, font: this.f.bold, color: rgb(0.86, 0.35, 0.3), opacity: 0.12, rotate: { type: 'degrees', angle: 35 },
      });
    }
    this.y = A4[1] - 78;
  }

  ensure(h) {
    if (this.y - h < 60) this.newPage();
  }

  section(num, title) {
    this.ensure(40);
    this.y -= 8;
    this.page.drawRectangle({ x: M, y: this.y - 18, width: A4[0] - 2 * M, height: 22, color: rgb(0.93, 0.95, 0.97) });
    this.page.drawRectangle({ x: M, y: this.y - 18, width: 3, height: 22, color: ACCENT });
    this.page.drawText(clean(`Section ${num}  ${title}`), { x: M + 10, y: this.y - 11, size: 11, font: this.f.bold, color: INK });
    this.y -= 30;
  }

  part(title) {
    this.ensure(24);
    this.page.drawText(clean(title), { x: M, y: this.y - 10, size: 9.5, font: this.f.bold, color: SUB });
    this.y -= 18;
  }

  wrap(text, size, width, font = this.f.reg) {
    // break over-long tokens (model / serial numbers) so they never spill into the next column
    const words = clean(text)
      .split(/\s+/)
      .flatMap(w => (font.widthOfTextAtSize(w, size) > width ? w.split(/(?<=\/)/) : [w]))
      .flatMap(w => {
        if (font.widthOfTextAtSize(w, size) <= width) return [w];
        const parts = [];
        let cur = '';
        for (const ch of w) {
          if (font.widthOfTextAtSize(cur + ch, size) > width && cur) {
            parts.push(cur);
            cur = ch;
          } else cur += ch;
        }
        if (cur) parts.push(cur);
        return parts;
      });
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) > width && line) {
        lines.push(line);
        line = w;
      } else line = t;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  /** two-column label/value grid */
  fields(rows) {
    const colW = (A4[0] - 2 * M) / 2;
    for (let i = 0; i < rows.length; i += 2) {
      const pair = rows.slice(i, i + 2);
      const heights = pair.map(([, v]) => this.wrap(v || '—', 9.5, colW - 14).length * 12 + 14);
      const h = Math.max(...heights);
      this.ensure(h + 4);
      pair.forEach(([label, value], j) => {
        const x = M + j * colW;
        this.page.drawText(clean(label), { x, y: this.y - 8, size: 7.5, font: this.f.reg, color: SUB });
        this.wrap(value || '—', 9.5, colW - 14).forEach((ln, k) =>
          this.page.drawText(ln, { x, y: this.y - 20 - k * 12, size: 9.5, font: this.f.reg, color: INK })
        );
      });
      this.y -= h + 4;
    }
  }

  table(headers, rows, widths) {
    const total = A4[0] - 2 * M;
    const w = widths.map(x => x * total);
    const drawRow = (cells, bold, shade) => {
      const lines = cells.map((c, i) => this.wrap(c ?? '—', 8.5, w[i] - 8, bold ? this.f.bold : this.f.reg));
      const h = Math.max(...lines.map(l => l.length)) * 11 + 8;
      this.ensure(h);
      if (shade) this.page.drawRectangle({ x: M, y: this.y - h, width: total, height: h, color: rgb(0.96, 0.97, 0.98) });
      let x = M;
      lines.forEach((ls, i) => {
        ls.forEach((ln, k) =>
          this.page.drawText(ln, { x: x + 4, y: this.y - 12 - k * 11, size: 8.5, font: bold ? this.f.bold : this.f.reg, color: bold ? SUB : INK })
        );
        x += w[i];
      });
      this.page.drawLine({ start: { x: M, y: this.y - h }, end: { x: M + total, y: this.y - h }, thickness: 0.6, color: LINE });
      this.y -= h;
    };
    drawRow(headers, true, true);
    (rows.length ? rows : [headers.map(() => '—')]).forEach(r => drawRow(r, false, false));
    this.y -= 8;
  }

  paragraph(text, size = 8.5, color = SUB) {
    const lines = this.wrap(text, size, A4[0] - 2 * M);
    this.ensure(lines.length * (size + 3) + 6);
    lines.forEach(ln => {
      this.page.drawText(ln, { x: M, y: this.y - size, size, font: this.f.reg, color });
      this.y -= size + 3;
    });
    this.y -= 6;
  }

  signature(label, image, name, date) {
    this.ensure(92);
    const x = M;
    const w = 250;
    this.page.drawText(clean(label), { x, y: this.y - 9, size: 8, font: this.f.reg, color: SUB });
    this.page.drawRectangle({ x, y: this.y - 72, width: w, height: 58, borderColor: LINE, borderWidth: 1 });
    if (image) {
      const s = Math.min((w - 10) / image.width, 50 / image.height);
      this.page.drawImage(image, { x: x + 5, y: this.y - 67, width: image.width * s, height: image.height * s });
    } else {
      this.page.drawText('Not signed', { x: x + 8, y: this.y - 45, size: 9, font: this.f.reg, color: SUB });
    }
    this.page.drawText(clean(`Name: ${name || '—'}`), { x: x + w + 16, y: this.y - 34, size: 9.5, font: this.f.reg, color: INK });
    this.page.drawText(clean(`Date: ${date || '—'}`), { x: x + w + 16, y: this.y - 50, size: 9.5, font: this.f.reg, color: INK });
    this.y -= 84;
  }
}

/**
 * @param job       row from installation_overview
 * @param formData  wizard state (as loaded by LoadInstallation)
 * @param evidence  job_evidence rows
 * @returns Uint8Array PDF bytes
 */
export async function buildAssignmentFormPdf({ job, formData: fd, evidence = [] }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`VEEC assignment record ${job.job_ref}`);
  pdf.setSubject('Victorian Energy Upgrades – Activity 6 (Residential)');
  pdf.setProducer('VEU Installation Portal');
  pdf.setCreationDate(new Date());
  const fonts = { reg: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  const submitted = ['submitted', 'approved', 'paid'].includes(job.status);
  const W = new Writer(pdf, fonts, {
    jobRef: job.job_ref,
    company: job.company_name || '',
    watermark: submitted ? null : 'DRAFT – NOT SUBMITTED',
  });

  const isRes = (fd.premisesType || job.premises_type) === 'residential';
  const scenarios = getScenarios(isRes);
  const sig = kind => evidence.filter(e => e.kind === kind).slice(-1)[0];
  const custSig = sig('customer_signature');
  const instSig = sig('installer_signature');
  const [custImg, instImg] = await Promise.all([
    custSig ? fetchImage(pdf, custSig.file_url) : null,
    instSig ? fetchImage(pdf, instSig.file_url) : null,
  ]);
  const installDate = fd.installationDate ? formatDate(fd.installationDate) : '—';

  // ── Section 1 ───────────────────────────────────────────────────────────
  W.section(1, 'Energy consumer and premises');
  W.part('Part A – Energy consumer details');
  W.fields([
    ['Consumer name', [fd.firstName, fd.surname].filter(Boolean).join(' ')],
    ['Phone', fd.clientPhone],
    ['Email', fd.email],
    ['Consumer type', isRes ? 'Residential' : 'Non-residential'],
  ]);
  W.part('Part B – Installation premises');
  const bd = fd.buildingDates || {};
  const ageDocs = [
    ['Certificate of occupancy / final inspection', bd.certificateDateFiles, bd.certificateDate],
    ['Final inspection notice / practical completion', bd.inspectionDateFiles, bd.inspectionDate],
    ['Council building permit completion record', bd.handoverDateFiles, bd.handoverDate],
    ['Statutory declaration', bd.statutoryDecDateFiles, bd.statutoryDecDate],
  ].filter(([, files]) => (files || []).length);
  W.fields([
    ['Installation address', fd.installationAddress],
    ['Premises type', isRes ? 'Residential' : 'Non-residential'],
    ['Building older than 2 years', yesNo(fd.buildingAgeCheck)],
    ['Building age evidence', ageDocs.map(([t, , d]) => `${t} (${d ? formatDate(d) : 'undated'})`).join('; ') || '—'],
    ['Prior ducted installs / decommissioned', `${fd.ductedCount ?? 0} / ${fd.ductedDecomCount ?? 0}`],
    ['Prior non-ducted installs / decommissioned', `${fd.nonDuctedCount ?? 0} / ${fd.nonDuctedDecomCount ?? 0}`],
  ]);

  // ── Section 2 ───────────────────────────────────────────────────────────
  W.section(2, 'Decommissioning of existing heating / cooling');
  W.part('Part A – Products decommissioned');
  const decom = (fd.decommissionedProducts || []).filter(p => p.decommissionScenario || p.brand || p.model);
  W.table(
    ['Scenario', 'Brand', 'Model', 'Method', 'Removed for disposal', 'Ductwork replaced'],
    decom.map(p => [
      scenarios.find(s => s.id === p.decommissionScenario)?.title || p.decommissionScenario,
      p.brand, p.model, p.decommissionMethod,
      p.removed === false ? `No – ${p.notRemovedReason || ''}` : yesNo(p.removed),
      p.ductReplacement === 'N/A' ? 'N/A' : yesNo(p.ductReplacement),
    ]),
    [0.26, 0.12, 0.13, 0.25, 0.12, 0.12]
  );
  W.fields([
    ['Certificate of Electrical Safety required', yesNo(fd.COESRequired)],
    ['VBA compliance certificate required', yesNo(fd.VBARequired)],
  ]);
  W.part('Part B – Decommissioning declaration (installer)');
  W.paragraph('The installer declares the products listed above were decommissioned in accordance with the Victorian Energy Upgrades specifications and disposed of as recorded.');
  W.signature('Installer signature', instImg, instSig?.note, instSig ? formatDate(instSig.captured_at) : null);

  // ── Section 3 ───────────────────────────────────────────────────────────
  W.section(3, 'Installation of high-efficiency air conditioner');
  W.part('Part A – Products installed');
  const prods = (fd.installedProducts || []).filter(p => p.brand || p.model);
  W.table(
    ['Category', 'Brand', 'Model', 'Serial no.', 'Heat / cool kW', 'Configuration', 'Area served'],
    prods.map(p => [
      p.productCategory, p.brand, p.model, p.serialNo,
      `${p.heatingCapacity ?? '—'} / ${p.coolingCapacity ?? '—'}`,
      [p.productType, p.unitConfiguration].filter(Boolean).join(', '),
      p.areaBucket ? `${p.areaBucket} m²` : '—',
    ]),
    [0.09, 0.12, 0.2, 0.17, 0.12, 0.18, 0.12]
  );
  W.fields([
    ['Installation date', installDate],
    ['Accredited person', fd.accredittedPerson],
    ['Certificate of Electrical Safety no.', fd.COESNo || fd.coesCertificateNumber],
    ['VBA compliance certificate no.', fd.VBAComplianceCertificateNo || fd.vbaCertificateNumber],
  ]);
  W.part('Part B – Tradespeople');
  const trade = (role, k, licKey = 'LicenseNo') => [
    role, fd[`${k}Name`], fd[`${k}CompanyName`], fd[`${k}${licKey}`], fd[`${k}Phone`],
  ];
  W.table(
    ['Role', 'Name', 'Company', 'Licence / registration', 'Phone'],
    [
      trade('Licensed plumber', 'licencedPlumber'),
      trade('Registered plumber', 'registeredPlumber', 'RegistrationNo'),
      trade('Electrician', 'electrician'),
      trade('Refrigerant handler', 'refrigerantHandler'),
    ].filter(r => r[1]),
    [0.2, 0.18, 0.28, 0.18, 0.16]
  );
  W.paragraph('The installer declares the installation was carried out by appropriately licensed persons in accordance with the Victorian Energy Upgrades specifications and all applicable laws, codes and standards.');
  W.signature('Installer signature', instImg, instSig?.note, instSig ? formatDate(instSig.captured_at) : null);

  // ── Section 4 ───────────────────────────────────────────────────────────
  W.section(4, 'Assignment of VEECs and energy consumer declaration');
  W.part('Part A – Benefit provided to the energy consumer');
  W.fields([
    ['Form of benefit', fd.typeOfBenefit === 'Other' ? `Other – ${fd.otherBenefit || ''}` : fd.typeOfBenefit],
    ['Amount of benefit', fd.amountOfBenefit ? `$${Number(fd.amountOfBenefit).toLocaleString('en-AU')}` : '—'],
    ['Consumer given VEU fact sheet / information', yesNo(fd.installerTasksDone)],
    ['Post-installation documents provided', yesNo(fd.postInstallinfoGiven)],
  ]);
  W.part('Part B – Energy consumer declaration and assignment');
  W.paragraph('The energy consumer declares the information in this form is true and correct, and assigns the right to create Victorian energy efficiency certificates for this activity to the accredited person named above in exchange for the benefit described.');
  W.signature('Energy consumer signature', custImg, custSig?.note, custSig ? formatDate(custSig.captured_at) : null);

  // ── Evidence appendix ──────────────────────────────────────────────────
  const photos = evidence.filter(e => !e.kind.includes('signature'));
  if (photos.length) {
    W.newPage();
    W.section('A', 'Photo evidence (timestamped, geotagged)');
    const colW = (A4[0] - 2 * M - 16) / 2;
    for (let i = 0; i < photos.length; i += 2) {
      W.ensure(200);
      for (let j = 0; j < 2 && i + j < photos.length; j++) {
        const e = photos[i + j];
        const img = await fetchImage(pdf, e.file_url);
        const x = M + j * (colW + 16);
        const boxH = 150;
        if (img) {
          const s = Math.min(colW / img.width, boxH / img.height);
          W.page.drawImage(img, { x, y: W.y - boxH, width: img.width * s, height: img.height * s });
        } else {
          W.page.drawRectangle({ x, y: W.y - boxH, width: colW, height: boxH, borderColor: LINE, borderWidth: 1 });
        }
        W.page.drawText(clean(evidenceLabel(e.kind)), { x, y: W.y - boxH - 12, size: 8.5, font: fonts.bold, color: INK });
        const meta = `${formatDate(e.captured_at, true)}${e.latitude != null ? `  ·  GPS ${e.latitude.toFixed(5)}, ${e.longitude.toFixed(5)}` : ''}`;
        W.page.drawText(clean(meta), { x, y: W.y - boxH - 24, size: 7.5, font: fonts.reg, color: SUB });
      }
      W.y -= 190;
    }
  }

  // footer on every page
  const pages = pdf.getPages();
  const stamp = `Generated ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' })} by VEU Installation Portal  ·  status: ${job.status}`;
  pages.forEach((pg, i) => {
    pg.drawLine({ start: { x: M, y: 40 }, end: { x: A4[0] - M, y: 40 }, thickness: 0.6, color: LINE });
    pg.drawText(clean(stamp), { x: M, y: 28, size: 7, font: fonts.reg, color: SUB });
    pg.drawText(`Page ${i + 1} of ${pages.length}`, { x: A4[0] - M - 50, y: 28, size: 7, font: fonts.reg, color: SUB });
  });

  return pdf.save();
}

export function downloadBytes(bytes, filename, type = 'application/pdf') {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
