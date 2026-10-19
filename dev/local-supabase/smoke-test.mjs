// End-to-end check of the database contract the front-end relies on.
// Usage: node dev/local-supabase/smoke-test.mjs   (local stack must be running)
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const keys = Object.fromEntries(
  fs.readFileSync(path.join(here, 'keys.env'), 'utf8').trim().split('\n').map(l => l.split('='))
);
const URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const PASSWORD = process.env.DEMO_PASSWORD || 'Password123!';

const client = () =>
  createClient(URL, keys.ANON_KEY, { auth: { persistSession: false }, db: { schema: 'snapshot' } });

let failures = 0;
const check = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
  if (!cond) failures++;
};
const must = ({ data, error }, label) => {
  check(label, !error, error?.message);
  return data;
};

async function login(email) {
  const sb = client();
  const { error } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`${email}: ${error.message}`);
  return sb;
}

const staff = await login('installer@acme.local');
const { data: { user } } = await staff.auth.getUser();
const me = must(await staff.from('profiles').select('*').eq('user_id', user.id).single(), 'staff reads own profile');
must(await staff.from('current_company_versions').select('*').eq('company_id', me.company_id).single(), 'staff reads own company');

const row = must(
  await staff.rpc('fn_create_installation_with_premises', { _company: me.company_id, _activity_type: 'activity-6', _prem_type: 'residential' }).single(),
  'create installation + draft premises'
);
const iid = row.installation_id;

const cid = must(await staff.rpc('fn_create_consumer_draft', { _installation: iid }).single(), 'create consumer draft');
must(await staff.rpc('fn_set_consumer_details', { _installation: iid, _first_name: 'Sam', _last_name: 'Citizen', _phone_number: '0400 111 222', _email_address: 'sam@example.com', _source_consumer: null }), 'set consumer details');
const prem = must(await staff.rpc('fn_upsert_premises', { _company_input: me.company_id, _activity_type: 'activity-6', _installation: iid, _full_address: '5 Test St, Richmond VIC 3121', _premises_type: 'residential', _other_fields: { building_age_check: true }, _reuse_existing: false, _copy_building_docs: false }).single(), 'upsert premises');
check('premises id unchanged', prem.premises_id === row.premises_id);

const up = await staff.storage.from('uploads').upload(`building_age/${prem.premises_id}/certificate/coo.txt`, new Blob(['certificate']), { upsert: true });
check('storage upload', !up.error, up.error?.message);
const publicUrl = staff.storage.from('uploads').getPublicUrl(`building_age/${prem.premises_id}/certificate/coo.txt`).data.publicUrl;
const fetched = await fetch(publicUrl).then(r => r.text());
check('public URL serves file', fetched === 'certificate');

const docId = must(await staff.rpc('fn_attach_building_document', { _installation: iid, _doc_type: 'certificate', _file_url: publicUrl, _file_name: 'coo.txt', _doc_date: '2015-01-01', _content_hash: null }), 'attach building document');
must(await staff.from('installation_history').insert({ premises_id: prem.premises_id, installation_id: iid, ducted_installed: 0, ducted_decommissioned: 0, non_ducted_installed: 1, non_ducted_decommissioned: 0, statutory_declaration_id: null, is_latest: true }), 'insert installation history');
must(await staff.from('decommissioning').insert([{ installation_id: iid, decom_scenario: 'i', brand: 'Old', model: 'X1', COES_required: true, VBA_required: null }]).select('decom_id'), 'insert decommissioning');
must(await staff.from('installation_documents').delete().eq('installation_id', iid).eq('building_documents_id', docId), 'unlink attachment');
const jobs = must(await staff.from('installation').select('installation_id, company_id, created_at, updated_at, complete, user_id').order('created_at', { ascending: false }), 'list company jobs');
check('job visible in list', jobs.some(j => j.installation_id === iid));
must(await staff.from('activity_6_registry').select('*').ilike('"Brand"', 'Demo%').limit(5), 'registry search');

// ── permission rules ───────────────────────────────────────────────
const esc = await staff.from('profiles').update({ is_admin: true }).eq('user_id', user.id);
check('staff cannot promote self to admin', !!esc.error, esc.error?.message);
const mkco = await staff.rpc('create_new_company', { input_name: 'X', input_address: 'Y' });
check('staff cannot create companies', !!mkco.error);

const admin = await login('admin@demo.local');
const allJobs = must(await admin.from('installation').select('installation_id'), 'global admin lists all jobs');
check('global admin sees Acme job', allJobs.some(j => j.installation_id === iid));
const newCo = must(await admin.rpc('create_new_company', { input_name: 'Smoke Test Pty Ltd', input_address: '1 Test Rd' }), 'global admin creates company');

const anon = client();
const anonRead = await anon.from('installation').select('*');
check('anonymous cannot read jobs', !!anonRead.error || anonRead.data.length === 0);

must(await admin.from('companies').update({ active: true }).eq('company_id', newCo), 'global admin toggles company');

// ── workflow rules ─────────────────────────────────────────────────
const direct = await staff.from('installation').update({ status: 'approved' }).eq('installation_id', iid);
check('status cannot be changed by direct update', !!direct.error, direct.error?.message);
const staffSubmit = await staff.rpc('fn_set_job_status', { _installation: iid, _status: 'submitted' });
check('staff cannot skip review', !!staffSubmit.error);
must(await staff.rpc('fn_set_job_status', { _installation: iid, _status: 'ready_for_review' }), 'staff sends for review');
const manager = await login('manager@acme.local');
const rfiNoMsg = await manager.rpc('fn_set_job_status', { _installation: iid, _status: 'rfi' });
check('RFI requires a message', !!rfiNoMsg.error);
must(await manager.rpc('fn_set_job_status', { _installation: iid, _status: 'submitted' }), 'admin submits');
const locked = await staff.from('installation').update({ form_data: { hacked: true } }).eq('installation_id', iid);
check('submitted job is locked for staff', !!locked.error, locked.error?.message);
const delSubmitted = await manager.rpc('fn_delete_installation', { _installation: iid });
check('submitted jobs cannot be deleted', !!delSubmitted.error);
const events = must(await staff.from('job_events').select('event_type, to_status').eq('installation_id', iid), 'read audit trail');
check('audit trail recorded transitions', events.filter(e => e.event_type === 'status_change').length === 2);
const premNow = must(await staff.from('premises').select('is_draft').eq('premises_id', prem.premises_id).single(), 'read premises');
check('premises finalised on submit', premNow.is_draft === false);
const ov = must(await staff.from('installation_overview').select('job_ref, customer_name, status').eq('installation_id', iid).single(), 'dashboard view');
check('dashboard view joins customer', ov.customer_name === 'Sam Citizen' && /^VEU-\d{6}$/.test(ov.job_ref));

const draft = must(await staff.rpc('fn_create_installation_with_premises', { _company: me.company_id, _activity_type: 'activity-6', _prem_type: 'residential' }).single(), 'create second draft');
must(await staff.rpc('fn_delete_installation', { _installation: draft.installation_id }), 'creator deletes draft');

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
