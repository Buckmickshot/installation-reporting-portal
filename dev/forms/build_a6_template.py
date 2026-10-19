#!/usr/bin/env python3
"""
Turns the ESC "VEEC Assignment Form Template: Space Heating and Cooling (Activity 6)
– Residential Premises" (V1.4, 12 Dec 2024) into a docxtemplater template.

  • removes the instructions-for-APs preamble and the START/END OF TEMPLATE markers
    (the ESC instructs APs to customise the form with their own details)
  • adds an accredited-person header ({apName}, {apContact}, {jobRef})
  • inserts {tags} after every field label and replaces every tick box with {cbN}
  • leaves all ESC wording, including the declarations, unchanged

Usage: python3 build_a6_template.py <official.docx> <out-template.docx> <out-boxes.json>
"""
import json
import re
import shutil
import sys
import tempfile
import zipfile
from copy import deepcopy

from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
W14 = 'http://schemas.microsoft.com/office/word/2010/wordml'
NS = {'w': W, 'w14': W14}
q = lambda tag: '{%s}%s' % (W, tag.split(':')[1]) if tag.startswith('w:') else tag
PUA_BOX = ''  # Wingdings empty box

src, out, boxes_out = sys.argv[1:4]
tmp = tempfile.mkdtemp()
with zipfile.ZipFile(src) as z:
    z.extractall(tmp)
doc_path = f'{tmp}/word/document.xml'
tree = etree.parse(doc_path)
body = tree.getroot().find('w:body', NS)


def ptext(p):
    return ''.join(t.text or '' for t in p.iter(q('w:t')))


def merge_runs_text(p):
    """Collapse all text of a paragraph into its first text run (keeps first run formatting)."""
    ts = list(p.iter(q('w:t')))
    if not ts:
        return None
    full = ''.join(t.text or '' for t in ts)
    ts[0].text = full
    ts[0].set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    for t in ts[1:]:
        t.text = ''
    return ts[0]


def append_run(p, text, bold=False):
    r = etree.SubElement(p, q('w:r'))
    rpr = etree.SubElement(r, q('w:rPr'))
    color = etree.SubElement(rpr, q('w:color'))
    color.set(q('w:val'), '1F3B57')
    if bold:
        etree.SubElement(rpr, q('w:b'))
    t = etree.SubElement(r, q('w:t'))
    t.text = text
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    return r


# ---------- 1. drop the AP instructions preamble -----------------------------
children = list(body)
start = next(i for i, el in enumerate(children) if el.tag == q('w:p') and 'START OF TEMPLATE' in ptext(el))
for el in children[: start + 1]:
    body.remove(el)
for el in list(body):
    if el.tag == q('w:p') and 'END OF TEMPLATE' in ptext(el):
        body.remove(el)

# ---------- 2. accredited-person header ---------------------------------------
first = body[0]
for text, size, bold in [('{apName}', 32, True), ('{apContact}', 18, False), ('VEEC assignment form · Job {jobRef}', 18, False)]:
    p = etree.Element(q('w:p'))
    r = append_run(p, text, bold)
    sz = etree.SubElement(r.find(q('w:rPr')), q('w:sz'))
    sz.set(q('w:val'), str(size))
    first.addprevious(p)

# ---------- 3. accredited person name placeholders -----------------------------
for t in body.iter(q('w:t')):
    if t.text and ('insert name of accredited person' in t.text or 'name of accredited person' in t.text):
        t.text = re.sub(r'<\s*(insert )?name of accredited person\s*>', '{apName}', t.text)
# the placeholder can be split across runs; merge paragraphs that still contain it
for p in body.iter(q('w:p')):
    if 'name of accredited person' in ptext(p):
        t = merge_runs_text(p)
        t.text = re.sub(r'<\s*(insert )?name of accredited person\s*>', '{apName}', t.text)

# ---------- 4. field labels → tags --------------------------------------------
paras = list(body.iter(q('w:p')))
labels = {
    'Installation address:': 'installAddress',
    'Installation date:': 'installDate',
    'Method used to decommission the product(s):': 'decomMethod',
    'Justification for why it was not safe or practical to remove the product (where product was not removed):': 'notRemovedReason',
    'Serial number(s):': 'serials',
    'Sum of the rated heating capacity (in kW) of all installed indoor units (for multi-split systems only):': 'sumHeat',
    'Sum of the rated cooling capacity (in kW) of all installed indoor units (for multi-split systems only):': 'sumCool',
    '*If ‘no’, please provide the reason why the recommended size system was not installed:': 'sizeReason',
    'Certificate of Electrical Safety number:': 'coesNo',
    'VBA Compliance Certificate number:': 'vbaNo',
    'Amount of benefit provided for assignment of certificates:': 'benefitAmount',
    'Price of installed product(s) including GST (before VEEC incentive): $': 'priceBefore',
    'Consumer payment for installed product(s) including GST : $': 'consumerPayment',
    'Email address:': 'consumerEmail',
}
# repeated labels are assigned in document order
sequences = {
    'Name:': ['elecName', 'lpName', 'rpName', 'rhName', 'consumerName'],
    'Company name:': ['elecCompany', 'lpCompany', 'rpCompany', 'rhCompany'],
    'Company address:': ['elecAddress', 'lpAddress', 'rpAddress', 'rhAddress'],
    'Phone number:': ['elecPhone', 'lpPhone', 'rpPhone', 'rhPhone', 'consumerPhone'],
    'Electrician licence number:': ['elecLicence'],
    'Plumbing licence number:': ['lpLicence'],
    'Plumbing registration number:': ['rpLicence'],
    'Refrigerant handling licence number:': ['rhLicence'],
    'Signature:': ['sig3aInstaller', 'sig3bConsumer', 'sig4Consumer'],
    'Date:': ['date3aInstaller', 'date3bConsumer', 'date4Consumer'],
}
counters = {k: 0 for k in sequences}
decom_cells = iter(['decomBrand', 'decomModel'])
used = []
for p in paras:
    txt = ptext(p).strip()
    if txt in labels:
        append_run(p, ' {%s}' % labels[txt]); used.append(labels[txt])
    elif txt in sequences and counters[txt] < len(sequences[txt]):
        tag = sequences[txt][counters[txt]]; counters[txt] += 1
        append_run(p, ' {%s}' % tag); used.append(tag)
    elif txt in ('Brand', 'Model') and len(used) and 'rhLicence' in used and 'decomMethod' not in used:
        tag = next(decom_cells)
        append_run(p, ': {%s}' % tag); used.append(tag)
    elif txt.startswith('Brand:') and 'Model:' in txt:
        t = merge_runs_text(p)
        t.text = 'Brand: {prodBrand}      Model: {prodModel}'; used += ['prodBrand', 'prodModel']
    elif txt.startswith('Signature:') and 'Date:' in txt:
        t = merge_runs_text(p)
        t.text = 'Signature: {sig2Installer}            Date: {date2Installer}'; used += ['sig2Installer', 'date2Installer']
    elif txt.startswith('Upfront cash') or txt.startswith(PUA_BOX + ' Upfront cash') or 'Other (please describe)' in txt:
        pass  # handled with boxes; description appended below
for p in paras:
    if 'Other (please describe)' in ptext(p):
        append_run(p, ' {benefitOther}'); used.append('benefitOther')
    if ptext(p).strip().startswith('undertake, or organise, the completion of some of the building repair work') or \
       'some of the building repair work' in ptext(p):
        append_run(p, ' {repairDetails}'); used.append('repairDetails')

# ---------- 5. tick boxes → {cbN} -------------------------------------------------
boxes = []
def ctx(el):
    p = el
    while p is not None and p.tag != q('w:p'):
        p = p.getparent()
    return ptext(p).strip()[:110] if p is not None else ''

for t in list(body.iter(q('w:t'))):
    if t.text is None:
        continue
    if '☐' in t.text or PUA_BOX in t.text:
        is_pua = PUA_BOX in t.text
        parts = re.split('(☐|%s)' % PUA_BOX, t.text)
        # rebuild text with tags
        new = ''
        for part in parts:
            if part in ('☐', PUA_BOX):
                n = len(boxes)
                boxes.append({'n': n, 'context': ctx(t)})
                new += '{cb%d}' % n
            else:
                new += part
        t.text = new
        t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        if is_pua:
            # switch the run from Wingdings to a font that has ☐ / ☒
            rpr = t.getparent().find(q('w:rPr'))
            if rpr is not None:
                f = rpr.find(q('w:rFonts'))
                if f is not None:
                    for a in list(f.attrib):
                        f.set(a, 'Segoe UI Symbol')

# checkbox content controls: let Word treat the box as plain text (we set the glyph)
for sdt in list(body.iter(q('w:sdt'))):
    cb = sdt.find('.//w14:checkbox', NS)
    if cb is not None:
        cb.getparent().remove(cb)

tree.write(doc_path, xml_declaration=True, encoding='UTF-8', standalone=True)

# ---------- 6. header/footer: replace ESC branding with the accredited person's ----
import glob
for part in glob.glob(f'{tmp}/word/header*.xml') + glob.glob(f'{tmp}/word/footer*.xml'):
    ht = etree.parse(part)
    root = ht.getroot()
    # footer text: clear ESC wording and put the AP name + job ref in a fresh run
    for p in root.iter(q('w:p')):
        if 'Essential Services Commission' in ptext(p):
            for t in p.iter(q('w:t')):
                if not (t.text or '').strip().isdigit():
                    t.text = ''
            r = etree.Element(q('w:r'))
            t = etree.SubElement(r, q('w:t'))
            t.text = '{apName}  ·  Job {jobRef}  ·  '
            t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
            ppr = p.find(q('w:pPr'))
            (ppr.addnext(r) if ppr is not None else p.insert(0, r))
    # ESC / VEU logos: drop every run that carries a picture (DrawingML or VML fallback)
    for r in list(root.iter(q('w:r'))):
        xml = etree.tostring(r).decode()
        if ('drawing' in xml or 'pict' in xml) and 'blip' in xml or 'imagedata' in xml:
            r.getparent().remove(r)
    ht.write(part, xml_declaration=True, encoding='UTF-8', standalone=True)

# document title (shown by the footer's TITLE field)
core = f'{tmp}/docProps/core.xml'
cx = open(core, encoding='utf-8').read()
cx = re.sub(r'<dc:title>.*?</dc:title>', '<dc:title>VEEC Assignment Form – Space Heating and Cooling (Activity 6) – Residential Premises</dc:title>', cx, flags=re.S)
open(core, 'w', encoding='utf-8').write(cx)

# repackage
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = open(f'{tmp}/{item.filename}', 'rb').read() if not item.is_dir() else b''
        zout.writestr(item, data)
shutil.rmtree(tmp)
json.dump({'fields': used, 'boxes': boxes}, open(boxes_out, 'w'), indent=1, ensure_ascii=False)
print(f'{len(used)} fields, {len(boxes)} tick boxes')
