// Creates a staff account. Only company admins (for their own company) and global
// admins may call it. Lets the project keep public sign-ups switched off.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const strong = (p: string) =>
  p.length >= 10 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(e);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // act as the caller to check their permissions (RLS + MFA rules apply)
    const caller = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      db: { schema: 'snapshot' },
      auth: { persistSession: false },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json(401, { error: 'Please sign in again.' });

    const b = await req.json();
    const email = String(b.email ?? '').trim().toLowerCase();
    const password = String(b.password ?? '');
    const name = String(b.name ?? '').trim();
    const phone = String(b.phone ?? '').trim() || null;
    const companyId = String(b.company_id ?? '');
    if (!name || !companyId) return json(400, { error: 'Name and company are required.' });
    if (!isEmail(email)) return json(400, { error: 'Enter a valid email address.' });
    if (!strong(password)) return json(400, { error: 'Password must be at least 10 characters with upper and lower case letters, a number and a symbol.' });

    const [{ data: isGlobal }, { data: isAdmin }] = await Promise.all([
      caller.rpc('is_global_admin'),
      caller.rpc('is_company_admin', { _company: companyId }),
    ]);
    if (!isGlobal && !isAdmin) return json(403, { error: 'Only an admin of this company can add users.' });
    if (b.is_global_admin && !isGlobal) return json(403, { error: 'Only a global admin can create global admins.' });

    const admin = createClient(url, service, { auth: { persistSession: false }, db: { schema: 'snapshot' } });
    const { data: created, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { name },
    });
    if (error) return json(400, { error: /already/i.test(error.message) ? 'A user with this email already exists.' : error.message });

    const { error: pErr } = await admin.from('profiles').insert({
      user_id: created.user.id, company_id: companyId, name, email, phone,
      is_admin: !!b.is_admin, is_global_admin: !!b.is_global_admin, active: true,
    });
    if (pErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json(400, { error: pErr.message });
    }
    return json(200, { user_id: created.user.id });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
