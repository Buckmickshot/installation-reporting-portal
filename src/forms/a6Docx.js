// Fills the official ESC Activity 6 residential assignment form (Word) in the browser.
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { buildA6Model } from './a6Model';

const TEMPLATE_URL = `${process.env.PUBLIC_URL || ''}/forms/a6-residential-template.docx`;

export async function buildA6Docx({ job, formData, evidence }) {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error('Assignment form template not found');
  const zip = new PizZip(await res.arrayBuffer());
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => '' });
  const { fields, ticks } = buildA6Model({ job, formData, evidence });
  const data = { ...fields };
  ticks.forEach((on, i) => { data[`cb${i}`] = on ? '☒' : '☐'; });
  doc.render(data);
  return doc.getZip().generate({ type: 'uint8array', compression: 'DEFLATE' });
}
