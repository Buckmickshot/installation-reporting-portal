// Renders the completed ESC Activity 6 (Residential) VEEC assignment form as a PDF
// in the browser. Structure and wording follow the ESC template V1.4 exactly; values,
// tick boxes and e-signatures come from the job. A photo-evidence attachment follows.
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { buildA6Model, BOX } from './a6Model';
import * as T from './a6Text';
import { evidenceLabel, formatDate } from '../utils/jobStatus';

const A4 = [595.28, 841.89];
const M = 44;
const CW = A4[0] - 2 * M;
const INK = rgb(0.1, 0.12, 0.15);
const SUB = rgb(0.38, 0.42, 0.47);
const TEAL = rgb(0.29, 0.5, 0.63);
const ROW = rgb(0.95, 0.95, 0.95);
const ROW2 = rgb(0.9, 0.9, 0.9);
const VALUE = rgb(0.07, 0.2, 0.36);
const FONT_BASE = `${process.env.PUBLIC_URL || ''}/fonts`;

async function loadBytes(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Could not load ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}
async function loadImage(pdf, url) {
  try {
    const b = await loadBytes(url);
    return b[0] === 0x89 && b[1] === 0x50 ? await pdf.embedPng(b) : await pdf.embedJpg(b);
  } catch {
    return null;
  }
}

// rough height of a table's first row, used to avoid orphaned table titles
const r0Height = r => (!r ? 20 : r.options ? Math.max(30, Math.ceil(r.options.length / 2) * 13 + 12) : 26);

class Doc {
  constructor(pdf, f, meta) {
    Object.assign(this, { pdf, f, meta });
    this.newPage();
  }

  newPage() {
    this.page = this.pdf.addPage(A4);
    this.y = A4[1] - 40;
    if (this.meta.watermark) {
      this.page.drawText(this.meta.watermark, {
        x: 90, y: 300, size: 50, font: this.f.bold, color: rgb(0.85, 0.3, 0.25), opacity: 0.1, rotate: { type: 'degrees', angle: 35 },
      });
    }
  }

  ensure(h) {
    if (this.y - h < 64) this.newPage();
  }

  wrap(text, size, width, font = this.f.reg) {
    const words = String(text ?? '').split(/\s+/).filter(Boolean)
      .flatMap(w => (font.widthOfTextAtSize(w, size) > width ? w.split(/(?<=\/)/) : [w]))
      .flatMap(w => {
        if (font.widthOfTextAtSize(w, size) <= width) return [w];
        const out = []; let cur = '';
        for (const ch of w) { if (font.widthOfTextAtSize(cur + ch, size) > width && cur) { out.push(cur); cur = ch; } else cur += ch; }
        return cur ? [...out, cur] : out;
      });
    const lines = []; let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) > width && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  text(str, { x = M, size = 9, font = this.f.reg, color = INK, width = CW, gap = 3, indent = 0 } = {}) {
    const lines = this.wrap(str, size, width - indent, font);
    this.ensure(lines.length * (size + gap));
    lines.forEach(l => { this.page.drawText(l, { x: x + indent, y: this.y - size, size, font, color }); this.y -= size + gap; });
  }

  space(h) { this.y -= h; }

  heading(str) { this.space(8); this.ensure(40); this.text(str, { size: 13, font: this.f.bold }); this.space(4); }
  part(str) { this.space(4); this.ensure(30); this.text(str, { size: 10.5, font: this.f.bold, color: TEAL }); this.space(2); }

  box(x, y, checked) {
    this.page.drawRectangle({ x, y, width: 8, height: 8, borderColor: INK, borderWidth: 0.8, color: rgb(1, 1, 1) });
    if (checked) {
      this.page.drawLine({ start: { x: x + 1.5, y: y + 1.5 }, end: { x: x + 6.5, y: y + 6.5 }, thickness: 1.2, color: VALUE });
      this.page.drawLine({ start: { x: x + 1.5, y: y + 6.5 }, end: { x: x + 6.5, y: y + 1.5 }, thickness: 1.2, color: VALUE });
    }
  }

  /** shaded table: title bar + rows. row = { label, value } | { label, options:[[label,checked]] } | { node: fn } */
  table(title, rows) {
    const pad = 5;
    if (title) {
      this.ensure(r0Height(rows[0]) + 24); // keep the title bar with its first row
      this.page.drawRectangle({ x: M, y: this.y - 17, width: CW, height: 17, color: TEAL });
      this.page.drawText(title, { x: M + pad, y: this.y - 12, size: 9.5, font: this.f.bold, color: rgb(1, 1, 1) });
      this.y -= 17;
    }
    rows.forEach((r, i) => {
      const bg = i % 2 ? ROW2 : ROW;
      if (r.options) {
        const labelW = r.label ? CW * 0.52 : 0;
        const labelLines = r.label ? this.wrap(r.label, 9, labelW - 2 * pad) : [];
        // lay options out in flowing columns
        const optX0 = M + labelW + pad;
        const optW = CW - labelW - 2 * pad;
        const placed = []; let ox = 0; let oy = 0;
        r.options.forEach(([lab, on]) => {
          const lw = this.wrap(lab, 9, (r.optionWidth || optW) - 12);
          const w = r.optionWidth ? r.optionWidth : Math.min(optW, 12 + this.f.reg.widthOfTextAtSize(lab, 9) + 10);
          if (ox + w > optW + 0.5 && ox > 0) { ox = 0; oy += 13 * Math.max(1, placed.length ? placed[placed.length - 1].n : 1); }
          placed.push({ x: ox, y: oy, lines: lw, on, n: lw.length });
          ox += w;
        });
        const optH = placed.length ? Math.max(...placed.map(p => p.y + p.n * 12)) : 0;
        const h = Math.max(labelLines.length * 12, optH, 12) + 2 * pad;
        this.ensure(h);
        this.page.drawRectangle({ x: M, y: this.y - h, width: CW, height: h, color: bg });
        labelLines.forEach((l, k) => this.page.drawText(l, { x: M + pad, y: this.y - pad - 9 - k * 12, size: 9, font: this.f.reg, color: INK }));
        placed.forEach(p => {
          const bx = optX0 + p.x; const by = this.y - pad - p.y;
          this.box(bx, by - 9, p.on);
          p.lines.forEach((l, k) => this.page.drawText(l, { x: bx + 12, y: by - 8 - k * 12, size: 9, font: this.f.reg, color: INK }));
        });
        this.y -= h;
      } else {
        const label = r.label;
        const value = r.value == null || r.value === '' ? '' : String(r.value);
        const lw = this.f.reg.widthOfTextAtSize(label + ' ', 9);
        const inline = lw < CW * 0.6;
        const lines = inline ? this.wrap(value, 9.5, CW - 2 * pad - lw, this.f.bold) : this.wrap(value, 9.5, CW - 2 * pad, this.f.bold);
        const labelLines = inline ? [label] : this.wrap(label, 9, CW - 2 * pad);
        const h = (inline ? Math.max(1, lines.length) : labelLines.length + (value ? lines.length : 0)) * 12.5 + 2 * pad;
        this.ensure(h);
        this.page.drawRectangle({ x: M, y: this.y - h, width: CW, height: h, color: bg });
        labelLines.forEach((l, k) => this.page.drawText(l, { x: M + pad, y: this.y - pad - 9 - k * 12.5, size: 9, font: this.f.reg, color: INK }));
        if (value) {
          lines.forEach((l, k) => this.page.drawText(l, {
            x: inline ? M + pad + lw : M + pad,
            y: this.y - pad - 9 - (inline ? k : labelLines.length + k) * 12.5,
            size: 9.5, font: this.f.bold, color: VALUE,
          }));
        }
        this.y -= h;
      }
    });
    this.space(8);
  }

  bullets(items, size = 9) {
    items.forEach(it => {
      const [main, ...subs] = Array.isArray(it) ? it : [it];
      const lines = this.wrap(main, size, CW - 14);
      this.ensure(lines.length * (size + 3) + 2);
      this.page.drawCircle({ x: M + 4, y: this.y - size + 3, size: 1.6, color: INK });
      lines.forEach(l => { this.page.drawText(l, { x: M + 14, y: this.y - size, size, font: this.f.reg, color: INK }); this.y -= size + 3; });
      subs.forEach(s => {
        const sl = this.wrap(s, size, CW - 34);
        this.ensure(sl.length * (size + 3));
        this.page.drawText('–', { x: M + 20, y: this.y - size, size, font: this.f.reg, color: INK });
        sl.forEach(l => { this.page.drawText(l, { x: M + 32, y: this.y - size, size, font: this.f.reg, color: INK }); this.y -= size + 3; });
      });
      this.y -= 2;
    });
    this.space(4);
  }

  checklist(items) {
    items.forEach(([label, on]) => {
      const lines = this.wrap(label, 9, CW - 16);
      this.ensure(lines.length * 12 + 4);
      this.box(M, this.y - 9, on);
      lines.forEach(l => { this.page.drawText(l, { x: M + 14, y: this.y - 8, size: 9, font: this.f.reg, color: INK }); this.y -= 12; });
      this.y -= 4;
    });
    this.space(2);
  }

  signature(image, who, date) {
    const h = 58;
    this.ensure(h + 6);
    const half = CW / 2;
    this.page.drawRectangle({ x: M, y: this.y - h, width: CW, height: h, color: ROW });
    this.page.drawText('Signature:', { x: M + 5, y: this.y - 14, size: 9, font: this.f.reg, color: INK });
    if (image) {
      const s = Math.min((half - 70) / image.width, (h - 10) / image.height);
      this.page.drawImage(image, { x: M + 55, y: this.y - h + 5, width: image.width * s, height: image.height * s });
    }
    if (who) this.page.drawText(who, { x: M + 55, y: this.y - h + 4, size: 7, font: this.f.reg, color: SUB });
    this.page.drawText('Date:', { x: M + half + 5, y: this.y - 14, size: 9, font: this.f.reg, color: INK });
    if (date) this.page.drawText(date, { x: M + half + 32, y: this.y - 14, size: 9.5, font: this.f.bold, color: VALUE });
    this.y -= h + 10;
  }

  footnote(n, text) {
    this.text(`${n} ${text}`, { size: 7.5, color: SUB, gap: 2 });
    this.space(4);
  }
}

/**
 * @returns {Promise<Uint8Array>} PDF bytes
 */
export async function buildAssignmentFormPdf({ job, formData: fd, evidence = [] }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [reg, bold] = await Promise.all([
    loadBytes(`${FONT_BASE}/LiberationSans-Regular.ttf`),
    loadBytes(`${FONT_BASE}/LiberationSans-Bold.ttf`),
  ]);
  const f = { reg: await pdf.embedFont(reg, { subset: true }), bold: await pdf.embedFont(bold, { subset: true }) };
  const { fields: v, ticks, signatures } = buildA6Model({ job, formData: fd, evidence });
  const on = i => !!ticks[i];
  const ap = v.apName;
  const submitted = ['submitted', 'approved', 'paid'].includes(job.status);

  pdf.setTitle(`${T.A6_FORM_TITLE} – ${job.job_ref}`);
  pdf.setAuthor(ap);
  pdf.setSubject('Victorian Energy Upgrades – VEEC assignment form');
  pdf.setProducer(`${ap} portal`);
  pdf.setCreationDate(new Date());

  const [instImg, custImg] = await Promise.all([
    signatures.installer ? loadImage(pdf, signatures.installer.file_url) : null,
    signatures.customer ? loadImage(pdf, signatures.customer.file_url) : null,
  ]);
  const D = new Doc(pdf, f, { watermark: submitted ? null : 'DRAFT – NOT SUBMITTED' });

  // ── Accredited person header ────────────────────────────────────────────
  D.text(ap, { size: 18, font: f.bold, color: rgb(0.12, 0.23, 0.34) });
  D.text(v.apContact, { size: 8.5, color: SUB });
  D.text(`${T.A6_FORM_TITLE}  ·  Job ${v.jobRef}`, { size: 8.5, color: SUB });
  D.space(6);

  // ── Section 1 ───────────────────────────────────────────────────────────
  D.heading('Section 1: Consumer rights information');
  T.SECTION1(ap).forEach(p => { D.text(p, { size: 9 }); D.space(4); });

  // ── Section 2 ───────────────────────────────────────────────────────────
  D.heading('Section 2: Installation details and installer declaration');
  D.part('Part A: Installation details');
  D.table('Installation details', [
    { label: 'Installation address:', value: v.installAddress },
    { label: 'Installation date:', value: v.installDate },
  ]);
  const person = (title, p, licLabel) => D.table(title, [
    { label: 'Name:', value: v[`${p}Name`] }, { label: 'Company name:', value: v[`${p}Company`] },
    { label: 'Company address:', value: v[`${p}Address`] }, { label: 'Phone number:', value: v[`${p}Phone`] },
    { label: licLabel, value: v[`${p}Licence`] },
  ]);
  person('Electrician details', 'elec', 'Electrician licence number:');
  person('Licenced plumber details', 'lp', 'Plumbing licence number:');
  person('Registered plumber details ¹', 'rp', 'Plumbing registration number:');
  person('Refrigerant handling details', 'rh', 'Refrigerant handling licence number:');
  D.footnote('¹', T.FOOTNOTE_REG_PLUMBER);

  D.table('Decommissioning scenario and decommissioned product details', [
    ...T.SCENARIOS.map(([id, label]) => ({ label: '', options: [[label, on(BOX.scenario[id])]], optionWidth: CW - 10 })),
    { label: 'Brand:', value: v.decomBrand },
    { label: 'Model:', value: v.decomModel },
  ]);
  D.table('Decommissioning and disposal details:', [
    { label: 'Method used to decommission the product(s):', value: v.decomMethod },
    { label: 'Was decommissioned product removed from the consumer’s premises for disposal?', options: [['Yes', on(BOX.removedYes)], ['No', on(BOX.removedNo)]] },
    { label: 'Justification for why it was not safe or practical to remove the product (where product was not removed):', value: v.notRemovedReason },
  ]);
  D.table('Installed product details *', [
    { label: 'Product type:', options: T.CATEGORIES.map(([c, l]) => [l, on(BOX.category[c])]), optionWidth: (CW * 0.48 - 10) / 1 },
    { label: 'Brand:', value: v.prodBrand },
    { label: 'Model:', value: v.prodModel },
    { label: 'Serial number(s):', value: v.serials },
    { label: 'Sum of the rated heating capacity (in kW) of all installed indoor units (for multi-split systems only):', value: v.sumHeat },
    { label: 'Sum of the rated cooling capacity (in kW) of all installed indoor units (for multi-split systems only):', value: v.sumCool },
    { label: 'Are all indoor units installed from the same original equipment manufacturer as the connected outdoor unit (for multi-split systems only)?', options: [['Yes', on(BOX.sameMfr.yes)], ['No', on(BOX.sameMfr.no)], ['N/A', on(BOX.sameMfr.na)]] },
    { label: 'Was ductwork of decommissioned product replaced as part of installation of new product? (for replacement of ducted systems with ducted systems only)', options: [['Yes', on(BOX.ductwork.yes)], ['No', on(BOX.ductwork.no)], ['N/A', on(BOX.ductwork.na)]] },
  ]);
  D.text('Above information (as appropriate) to be recorded for each product installed as part of this assignment of rights', { size: 8.5, font: f.reg, color: SUB });
  D.space(6);
  D.table('Pre-installation and installation sizing details', [
    { label: 'Area (m2) heated/cooled by baseline product – per product', options: T.AREAS.map(([k, l]) => [l, on(BOX.area[k])]), optionWidth: 82 },
    { label: 'Do the product(s) installed match the recommended size in the Space Heating and Cooling Consumer Fact Sheet', options: [['Yes', on(BOX.matchYes)], ['No*', on(BOX.matchNo)]] },
    { label: '*If ‘no’, please provide the reason why the recommended size system was not installed:', value: v.sizeReason },
  ]);
  D.table('Certificate details', [
    { label: 'Is a VBA Compliance Certificate required for the work undertaken?', options: [['Yes', on(BOX.vbaReqYes)], ['No', on(BOX.vbaReqNo)]] },
    { label: 'Is a Certificate of Electrical Safety required for the work undertaken?', options: [['Yes', on(BOX.coesReqYes)], ['No', on(BOX.coesReqNo)]] },
    { label: 'Certificate of Electrical Safety number:', value: v.coesNo },
    { label: 'VBA Compliance Certificate number:', value: v.vbaNo },
  ]);
  D.table('Form of benefit provided', [
    { label: '', options: T.BENEFITS.map(b => [b === 'Other' ? `Other (please describe)${v.benefitOther ? `: ${v.benefitOther}` : ''}` : b, on(BOX.benefit[b])]) },
    { label: 'Amount of benefit provided for assignment of certificates:', value: v.benefitAmount },
  ]);
  D.table('Co-payment details ²', [
    { label: 'Price of installed product(s) including GST (before VEEC incentive): $', value: v.priceBefore },
    { label: 'Consumer payment for installed product(s) including GST : $', value: v.consumerPayment },
  ]);
  D.footnote('²', T.FOOTNOTE_COPAYMENT);

  D.part('Part B: Declaration by installer');
  D.text('I declare that:');
  D.space(2);
  D.bullets(T.INSTALLER_DECLARATION);
  D.signature(instImg, v.sig2Installer, v.date2Installer);

  // ── Section 3 ───────────────────────────────────────────────────────────
  D.heading('Section 3: Agreement between installer and consumer on scope of decommissioning work as part of installation');
  D.text('As part of the installation of the new product(s), the installer will: (tick applicable box)');
  D.space(4);
  D.checklist([[T.SCOPE_REMOVAL[0], on(BOX.scopeRemove)], [T.SCOPE_REMOVAL[1], on(BOX.scopeLeave)]]);
  D.text('As part of the installation of the new product(s), the installer will: (tick applicable box)');
  D.space(4);
  D.checklist(T.SCOPE_REPAIR.map(([k, l]) => [k === 'some' && v.repairDetails ? `${l}: ${v.repairDetails}` : l, on(BOX.repair[k])]));
  D.part('Part A: Declaration by installer');
  D.text('I declare that:');
  D.space(2);
  D.bullets(T.SECTION3_INSTALLER);
  D.signature(instImg, v.sig3aInstaller, v.date3aInstaller);
  D.part('Part B: Acknowledgement by consumer');
  D.text('I acknowledge that:');
  D.space(2);
  D.bullets(T.SECTION3_CONSUMER);
  D.signature(custImg, v.sig3bConsumer, v.date3bConsumer);

  // ── Section 4 ───────────────────────────────────────────────────────────
  D.heading('Section 4: Consumer details and declaration');
  D.part('Part A: Consumer details');
  D.table('Consumer details', [
    { label: 'Name:', value: v.consumerName },
    { label: 'Phone number:', value: v.consumerPhone },
    { label: 'Email address:', value: v.consumerEmail },
    ...T.CONSUMER_QUESTIONS.map(([k, l]) => ({ label: l, options: [['Yes', on(BOX[`${k}Yes`])], ['No', on(BOX[`${k}No`])]] })),
  ]);
  D.part('Part B: Declaration by consumer');
  D.text('I declare that:');
  D.space(2);
  D.bullets(T.CONSUMER_DECLARATION(ap));
  D.signature(custImg, v.sig4Consumer, v.date4Consumer);

  // ── Attachment: photo evidence ─────────────────────────────────────────
  const photos = evidence.filter(e => !e.kind.includes('signature'));
  if (photos.length) {
    D.newPage();
    D.text('Attachment – installation photo evidence', { size: 13, font: f.bold });
    D.text('Supporting evidence captured on site (timestamped and geotagged). Not part of the assignment form.', { size: 8.5, color: SUB });
    D.space(8);
    const colW = (CW - 16) / 2;
    for (let i = 0; i < photos.length; i += 2) {
      D.ensure(196);
      for (let j = 0; j < 2 && i + j < photos.length; j++) {
        const e = photos[i + j];
        const img = await loadImage(pdf, e.file_url);
        const x = M + j * (colW + 16);
        if (img) {
          const s = Math.min(colW / img.width, 150 / img.height);
          D.page.drawImage(img, { x, y: D.y - 150, width: img.width * s, height: img.height * s });
        }
        D.page.drawText(evidenceLabel(e.kind), { x, y: D.y - 162, size: 8.5, font: f.bold, color: INK });
        const meta = `${formatDate(e.captured_at, true)}${e.latitude != null ? `  ·  GPS ${e.latitude.toFixed(5)}, ${e.longitude.toFixed(5)}` : ''}`;
        D.page.drawText(meta, { x, y: D.y - 173, size: 7.5, font: f.reg, color: SUB });
      }
      D.y -= 188;
    }
  }

  // footer on every page
  const pages = pdf.getPages();
  pages.forEach((pg, i) => {
    pg.drawText(`${ap}  ·  Job ${v.jobRef}  ·  ${T.A6_FORM_TITLE}`, { x: M, y: 30, size: 7, font: f.reg, color: SUB });
    pg.drawText(`Page ${i + 1} of ${pages.length}`, { x: A4[0] - M - 48, y: 30, size: 7, font: f.reg, color: SUB });
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
