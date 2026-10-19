-- =============================================================================
-- 1. Worker role
--    Workers (field installers) only see jobs allocated to them. They can view
--    the job, its activity and documents, upload photos/signatures and add notes.
--    They cannot edit the job form, change status, allocate or delete.
-- =============================================================================
alter table snapshot.profiles add column if not exists is_worker boolean not null default false;
comment on column snapshot.profiles.is_worker is 'Field worker: sees allocated jobs only; uploads evidence; no job-form edits';

create or replace function snapshot.is_worker() returns boolean
language sql stable security definer set search_path = snapshot, public as $$
  select coalesce((select is_worker from snapshot.profiles where user_id = auth.uid()), false)
$$;

-- company-wide access now excludes workers (they get the job-scoped policies below)
create or replace function snapshot.can_access_company(_company uuid) returns boolean
language sql stable security definer set search_path = snapshot, public as $$
  select snapshot.is_global_admin()
      or (_company = snapshot.current_company_id() and not snapshot.is_worker())
$$;

create or replace function snapshot.worker_job(_installation uuid) returns boolean
language sql stable security definer set search_path = snapshot, public as $$
  select snapshot.is_worker() and exists (
    select 1 from snapshot.installation i
    where i.installation_id = _installation
      and i.assigned_to = auth.uid()
      and i.company_id = snapshot.current_company_id())
$$;

create or replace function snapshot.worker_premises(_premises uuid) returns boolean
language sql stable security definer set search_path = snapshot, public as $$
  select snapshot.is_worker() and exists (
    select 1 from snapshot.installation i
    where i.premises_id = _premises and i.assigned_to = auth.uid()
      and i.company_id = snapshot.current_company_id())
$$;

create or replace function snapshot.worker_consumer(_consumer uuid) returns boolean
language sql stable security definer set search_path = snapshot, public as $$
  select snapshot.is_worker() and exists (
    select 1 from snapshot.installation i
    where i.consumer_id = _consumer and i.assigned_to = auth.uid()
      and i.company_id = snapshot.current_company_id())
$$;

create policy installation_worker_read on snapshot.installation for select to authenticated
  using (snapshot.worker_job(installation_id));
create policy premises_worker_read on snapshot.premises for select to authenticated
  using (snapshot.worker_premises(premises_id));
create policy consumer_worker_read on snapshot.consumer_records for select to authenticated
  using (snapshot.worker_consumer(consumer_id));
create policy decommissioning_worker_read on snapshot.decommissioning for select to authenticated
  using (snapshot.worker_job(installation_id));
create policy installation_documents_worker_read on snapshot.installation_documents for select to authenticated
  using (snapshot.worker_job(installation_id));
create policy installation_history_worker_read on snapshot.installation_history for select to authenticated
  using (snapshot.worker_job(installation_id));
create policy building_documents_worker_read on snapshot.building_documents for select to authenticated
  using (snapshot.worker_premises(premises_id));
create policy job_evidence_worker_read on snapshot.job_evidence for select to authenticated
  using (snapshot.worker_job(installation_id));
create policy job_evidence_worker_add on snapshot.job_evidence for insert to authenticated
  with check (snapshot.worker_job(installation_id) and captured_by = auth.uid());
create policy job_evidence_worker_remove on snapshot.job_evidence for delete to authenticated
  using (snapshot.worker_job(installation_id) and captured_by = auth.uid());
create policy job_events_worker_read on snapshot.job_events for select to authenticated
  using (snapshot.worker_job(installation_id));
create policy job_events_worker_note on snapshot.job_events for insert to authenticated
  with check (snapshot.worker_job(installation_id) and event_type in ('note','evidence') and actor = auth.uid());
create policy profiles_worker_read on snapshot.profiles for select to authenticated
  using (snapshot.is_worker() and company_id = snapshot.current_company_id());
-- everyone can read their own company's name/details (workers included)
create policy companies_own_read on snapshot.companies for select to authenticated
  using (company_id = snapshot.current_company_id());
create policy cv_own_read on snapshot.company_versions for select to authenticated
  using (company_id = snapshot.current_company_id());
do $$
declare t text;
begin
  foreach t in array array['licenced_plumber','registered_plumber','electrician','refrigerant_handler'] loop
    execute format('create policy %1$s_worker_read on snapshot.%1$I for select to authenticated
                      using (snapshot.is_worker() and company_id = snapshot.current_company_id())', t);
  end loop;
end $$;

-- role changes: workers can't promote themselves either
create or replace function snapshot.profiles_guard() returns trigger
language plpgsql security definer set search_path = snapshot, public as $$
begin
  if auth.uid() is null or current_setting('snapshot.via_admin_rpc', true) = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.email is distinct from old.email then
    raise exception 'Sign-in email can only be changed by an administrator';
  end if;
  if snapshot.is_global_admin() then
    return new;
  end if;
  if new.is_global_admin and (tg_op = 'INSERT' or not old.is_global_admin) then
    raise exception 'Only a global admin can grant global admin';
  end if;
  if tg_op = 'UPDATE' then
    if old.is_global_admin and new.user_id <> auth.uid() then
      raise exception 'Only a global admin can change a global admin';
    end if;
    if new.company_id <> old.company_id then
      raise exception 'Users cannot be moved between companies';
    end if;
    if not snapshot.is_company_admin(old.company_id) and
       (new.is_admin <> old.is_admin or new.active <> old.active
        or new.is_global_admin <> old.is_global_admin or new.is_worker <> old.is_worker) then
      raise exception 'Only an admin can change roles or activation';
    end if;
    if new.user_id = auth.uid() and (new.is_admin <> old.is_admin or new.active <> old.active or new.is_worker <> old.is_worker) then
      raise exception 'You cannot change your own role or activation';
    end if;
  end if;
  return new;
end $$;

-- user list with the role spelled out (replaces fn_company_users in the app)
create or replace function snapshot.fn_company_members(_company uuid)
returns table (
  user_id uuid, name text, email text, phone text, active boolean, role text,
  created_at timestamptz, last_sign_in_at timestamptz, mfa_enabled boolean
)
language plpgsql stable security definer set search_path = snapshot, public as $$
begin
  if not (snapshot.is_global_admin() or snapshot.is_company_admin(_company)) then
    raise exception 'Only admins can view the user list' using errcode = '42501';
  end if;
  return query
    select p.user_id, p.name, coalesce(u.email::text, p.email), p.phone, p.active,
           case when p.is_global_admin then 'global_admin' when p.is_admin then 'admin'
                when p.is_worker then 'worker' else 'staff' end,
           p.created_at, u.last_sign_in_at,
           exists (select 1 from auth.mfa_factors f where f.user_id = p.user_id and f.status = 'verified')
    from snapshot.profiles p
    left join auth.users u on u.id = p.user_id
    where p.company_id = _company
    order by p.is_global_admin desc, p.is_admin desc, p.is_worker, p.name;
end $$;

create or replace function snapshot.fn_admin_update_user(
  _user uuid, _name text, _phone text, _email text, _role text, _active boolean
) returns void
language plpgsql security definer set search_path = snapshot, public as $$
declare
  t snapshot.profiles;
  new_email text := lower(trim(_email));
  self boolean := _user = auth.uid();
  cur_role text;
begin
  select * into t from snapshot.profiles where user_id = _user;
  if not found then raise exception 'User not found'; end if;
  if not (self or snapshot._can_manage_user(_user)) then
    raise exception 'You do not have permission to manage this user' using errcode = '42501';
  end if;
  if _role not in ('staff', 'worker', 'admin', 'global_admin') then raise exception 'Unknown role %', _role; end if;
  if _role = 'global_admin' and not snapshot.is_global_admin() then
    raise exception 'Only a global admin can grant global admin';
  end if;
  cur_role := case when t.is_global_admin then 'global_admin' when t.is_admin then 'admin'
                   when t.is_worker then 'worker' else 'staff' end;
  if self and (_active is distinct from t.active or _role is distinct from cur_role) then
    raise exception 'You cannot change your own role or deactivate yourself';
  end if;
  if self and not snapshot._can_manage_user(_user) and new_email is distinct from lower(t.email) then
    raise exception 'Contact an administrator to change your sign-in email';
  end if;
  if coalesce(trim(_name), '') = '' then raise exception 'Name is required'; end if;
  if new_email !~ '^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$' then raise exception 'Enter a valid email address'; end if;

  perform set_config('snapshot.via_admin_rpc', 'on', true);
  if new_email is distinct from lower(t.email) then
    if exists (select 1 from auth.users where lower(email) = new_email and id <> _user) then
      raise exception 'Another account already uses %', new_email;
    end if;
    update auth.users set email = new_email, email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
      where id = _user;
    update auth.identities set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(new_email)), updated_at = now()
      where user_id = _user and provider = 'email';
  end if;

  update snapshot.profiles set
    name = trim(_name),
    phone = nullif(trim(coalesce(_phone, '')), ''),
    email = new_email,
    is_admin = _role in ('admin', 'global_admin'),
    is_global_admin = _role = 'global_admin',
    is_worker = _role = 'worker',
    active = _active
  where user_id = _user;
  perform set_config('snapshot.via_admin_rpc', 'off', true);

  if _active is distinct from t.active then
    update auth.users set banned_until = case when _active then null else '2999-12-31'::timestamptz end where id = _user;
    if not _active then
      update auth.refresh_tokens set revoked = true, updated_at = now() where user_id = _user::text and not revoked;
      update auth.sessions set not_after = now() where user_id = _user and (not_after is null or not_after > now());
    end if;
  end if;
end $$;

-- =============================================================================
-- 2. Profile name & phone mirrored onto the sign-in account
--    (Supabase dashboard → Authentication → Users shows these)
-- =============================================================================
create or replace function snapshot.au_phone(_p text) returns text
language sql immutable as $$
  select case
    when d ~ '^04\d{8}$' then '61' || substr(d, 2)
    when d ~ '^0[2378]\d{8}$' then '61' || substr(d, 2)
    when d ~ '^61\d{9}$' then d
    else null end
  from (select regexp_replace(coalesce(_p, ''), '\D', '', 'g') as d) x
$$;

create or replace function snapshot.sync_profile_to_auth() returns trigger
language plpgsql security definer set search_path = snapshot, public as $$
declare ph text := snapshot.au_phone(new.phone);
begin
  if ph is not null and exists (select 1 from auth.users where phone = ph and id <> new.user_id) then
    ph := null;  -- phone numbers are unique per sign-in account; keep it on the profile only
  end if;
  update auth.users
     set phone = ph,
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                              || jsonb_build_object('name', new.name, 'full_name', new.name, 'display_name', new.name,
                                                    'phone', new.phone),
         updated_at = now()
   where id = new.user_id
     and (phone is distinct from ph or raw_user_meta_data->>'display_name' is distinct from new.name
          or raw_user_meta_data->>'phone' is distinct from new.phone);
  return new;
end $$;
create trigger trg_profile_to_auth after insert or update of name, phone on snapshot.profiles
  for each row execute function snapshot.sync_profile_to_auth();
-- bring existing accounts in line
update snapshot.profiles set phone = phone;

-- =============================================================================
-- 3. Audit log — every change, with where it lives
-- =============================================================================
create table if not exists snapshot.audit_log (
  audit_id    bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid,
  company_id  uuid,
  location    text not null,          -- e.g. snapshot.profiles  /  auth.users
  record_id   text,
  action      text not null,          -- created / updated / deleted / password changed / signed in …
  summary     text,
  changes     jsonb
);
create index if not exists audit_log_at on snapshot.audit_log (at desc);
create index if not exists audit_log_company on snapshot.audit_log (company_id, at desc);
alter table snapshot.audit_log enable row level security;
create policy audit_read on snapshot.audit_log for select to authenticated
  using (snapshot.is_global_admin() or snapshot.is_company_admin(company_id));
revoke all on snapshot.audit_log from anon, authenticated;
grant select on snapshot.audit_log to authenticated;
grant all on snapshot.audit_log to service_role;

-- short, safe rendering of a value for the log
create or replace function snapshot._audit_val(_v jsonb) returns jsonb
language sql immutable as $$
  select case
    when _v is null then null
    when jsonb_typeof(_v) = 'string' and length(_v #>> '{}') > 160 then to_jsonb(left(_v #>> '{}', 157) || '…')
    when jsonb_typeof(_v) in ('object','array') and length(_v::text) > 160 then to_jsonb(left(_v::text, 157) || '…')
    else _v end
$$;

create or replace function snapshot.audit_row() returns trigger
language plpgsql security definer set search_path = snapshot, public as $$
declare
  pk text := tg_argv[0];
  masked text[] := coalesce(tg_argv[1]::text[], '{}');
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
  diff jsonb := '{}'::jsonb;
  k text;
  sub text;
begin
  for k in select jsonb_object_keys(r) loop
    continue when k in ('updated_at', 'created_at');
    if tg_op = 'UPDATE' and (o -> k) is not distinct from (n -> k) then continue; end if;
    if tg_op = 'INSERT' and (n -> k) = 'null'::jsonb then continue; end if;
    if k = any(masked) then
      diff := diff || jsonb_build_object(k, '«encrypted value changed»');
    elsif k = 'form_data' and tg_op = 'UPDATE' then
      -- list the job-form fields that changed rather than the whole document
      for sub in select key from jsonb_each(coalesce(n -> k, '{}')) union select key from jsonb_each(coalesce(o -> k, '{}')) loop
        if (o -> k -> sub) is distinct from (n -> k -> sub) then
          diff := diff || jsonb_build_object('form_data.' || sub,
                    jsonb_build_object('old', snapshot._audit_val(o -> k -> sub), 'new', snapshot._audit_val(n -> k -> sub)));
        end if;
      end loop;
    elsif tg_op = 'UPDATE' then
      diff := diff || jsonb_build_object(k, jsonb_build_object('old', snapshot._audit_val(o -> k), 'new', snapshot._audit_val(n -> k)));
    else
      diff := diff || jsonb_build_object(k, snapshot._audit_val(coalesce(n, o) -> k));
    end if;
  end loop;
  if tg_op = 'UPDATE' and diff = '{}'::jsonb then return null; end if;

  insert into snapshot.audit_log (actor, company_id, location, record_id, action, summary, changes)
  values (auth.uid(),
          nullif(r ->> 'company_id', '')::uuid,
          tg_table_schema || '.' || tg_table_name,
          r ->> pk,
          case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
          case when tg_op = 'UPDATE' then (select string_agg(x, ', ') from jsonb_object_keys(diff) x) end,
          diff);
  return null;
exception when others then
  raise warning 'audit log skipped: %', sqlerrm;
  return null;
end $$;

create trigger trg_audit after insert or update or delete on snapshot.companies
  for each row execute function snapshot.audit_row('company_id');
create trigger trg_audit after insert or update or delete on snapshot.company_versions
  for each row execute function snapshot.audit_row('company_version_id');
create trigger trg_audit after insert or update or delete on snapshot.profiles
  for each row execute function snapshot.audit_row('user_id');
create trigger trg_audit after insert or update or delete on snapshot.installation
  for each row execute function snapshot.audit_row('installation_id');
create trigger trg_audit after insert or update or delete on snapshot.premises
  for each row execute function snapshot.audit_row('premises_id');
create trigger trg_audit after insert or update or delete on snapshot.consumer_records
  for each row execute function snapshot.audit_row('consumer_id', '{phone_enc,email_enc}');
create trigger trg_audit after insert or update or delete on snapshot.job_evidence
  for each row execute function snapshot.audit_row('evidence_id');
create trigger trg_audit after insert or update or delete on snapshot.decommissioning
  for each row execute function snapshot.audit_row('decom_id');
create trigger trg_audit after insert or update or delete on snapshot.building_documents
  for each row execute function snapshot.audit_row('building_documents_id');

-- sign-in accounts (auth.users): passwords, emails, phone, blocking, sign-ins
create or replace function snapshot.audit_auth_user() returns trigger
language plpgsql security definer set search_path = snapshot, public as $$
declare
  co uuid := (select company_id from snapshot.profiles where user_id = new.id);
  who uuid := coalesce(auth.uid(), new.id);
  ev text[] := '{}';
  diff jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into snapshot.audit_log (actor, company_id, location, record_id, action, summary, changes)
    values (auth.uid(), co, 'auth.users', new.id::text, 'account created', new.email,
            jsonb_build_object('email', new.email, 'encrypted_password', '«bcrypt hash stored»'));
    return null;
  end if;
  if new.encrypted_password is distinct from old.encrypted_password then
    ev := array_append(ev, 'password changed'::text);
    diff := diff || jsonb_build_object('encrypted_password', jsonb_build_object(
      'old', left(coalesce(old.encrypted_password, ''), 7) || '…', 'new', left(coalesce(new.encrypted_password, ''), 7) || '…  (new bcrypt hash)'));
  end if;
  if new.email is distinct from old.email then
    ev := array_append(ev, 'email changed'::text);
    diff := diff || jsonb_build_object('email', jsonb_build_object('old', old.email, 'new', new.email));
  end if;
  if new.phone is distinct from old.phone then
    ev := array_append(ev, 'phone changed'::text);
    diff := diff || jsonb_build_object('phone', jsonb_build_object('old', old.phone, 'new', new.phone));
  end if;
  if new.banned_until is distinct from old.banned_until then
    ev := array_append(ev, (case when new.banned_until is null then 'sign-in unblocked' else 'sign-in blocked' end)::text);
    diff := diff || jsonb_build_object('banned_until', jsonb_build_object('old', old.banned_until, 'new', new.banned_until));
  end if;
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    ev := array_append(ev, 'signed in'::text);
    diff := diff || jsonb_build_object('last_sign_in_at', jsonb_build_object('old', old.last_sign_in_at, 'new', new.last_sign_in_at));
  end if;
  if array_length(ev, 1) is null then return null; end if;
  insert into snapshot.audit_log (actor, company_id, location, record_id, action, summary, changes)
  values (who, co, 'auth.users', new.id::text, array_to_string(ev, ', '), new.email, diff);
  return null;
exception when others then
  raise warning 'audit log skipped: %', sqlerrm;
  return null;
end $$;
create trigger trg_audit_auth_user after insert or update on auth.users
  for each row execute function snapshot.audit_auth_user();

create or replace function snapshot.audit_mfa() returns trigger
language plpgsql security definer set search_path = snapshot, public as $$
declare
  r record;
  co uuid;
  act text;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  act := case
    when tg_op = 'DELETE' then 'two-factor removed'
    when tg_op = 'INSERT' then null
    when new.status::text = 'verified' and old.status::text <> 'verified' then 'two-factor turned on'
    when new.status::text <> 'verified' and old.status::text = 'verified' then 'two-factor removed'
    else null end;
  if act is null then return null; end if;
  co := (select company_id from snapshot.profiles where user_id = r.user_id);
  insert into snapshot.audit_log (actor, company_id, location, record_id, action, summary, changes)
  values (coalesce(auth.uid(), r.user_id), co, 'auth.mfa_factors', r.id::text, act,
          (select email from auth.users where id = r.user_id),
          jsonb_build_object('factor_type', r.factor_type::text, 'friendly_name', r.friendly_name, 'user_id', r.user_id));
  return null;
exception when others then
  raise warning 'audit log skipped: %', sqlerrm;
  return null;
end $$;
create trigger trg_audit_mfa after insert or update or delete on auth.mfa_factors
  for each row execute function snapshot.audit_mfa();

-- =============================================================================
-- 4. Change your own password after proving it's you:
--    a 6-digit code emailed by supabase.auth.reauthenticate(), or a fresh
--    authenticator-app code (session upgraded to AAL2 within the last 10 minutes).
-- =============================================================================
create or replace function snapshot.fn_change_password(_password text, _code text default null) returns text
language plpgsql security definer set search_path = snapshot, public, extensions as $$
declare
  u auth.users;
  ok boolean := false;
  how text;
  sid text := auth.jwt() ->> 'session_id';
begin
  if auth.uid() is null then raise exception 'Please sign in again' using errcode = '42501'; end if;
  select * into u from auth.users where id = auth.uid();

  if coalesce(trim(_code), '') <> '' then
    ok := coalesce(u.reauthentication_token, '') <> ''
          and u.reauthentication_sent_at > now() - interval '15 minutes'
          and u.reauthentication_token = encode(sha224(convert_to(u.email || trim(_code), 'UTF8')), 'hex');
    how := 'email code';
    if not ok then raise exception 'That code is incorrect or has expired. Request a new one.'; end if;
  else
    ok := coalesce(auth.jwt() ->> 'aal', '') = 'aal2' and exists (
      select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
      where a ->> 'method' = 'totp' and (a ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - 600);
    how := 'authenticator app';
    if not ok then raise exception 'Verify with your authenticator app or an emailed code first.'; end if;
  end if;

  if length(_password) < 10 or _password !~ '[A-Z]' or _password !~ '[a-z]' or _password !~ '[0-9]' or _password !~ '[^A-Za-z0-9]' then
    raise exception 'Password must be at least 10 characters with upper and lower case letters, a number and a symbol';
  end if;
  if u.encrypted_password = crypt(_password, u.encrypted_password) then
    raise exception 'Your new password must be different from your current password';
  end if;

  update auth.users
     set encrypted_password = crypt(_password, gen_salt('bf')),
         reauthentication_token = '', reauthentication_sent_at = null, updated_at = now()
   where id = u.id;
  -- sign out everywhere else, keep this session
  update auth.sessions set not_after = now()
   where user_id = u.id and id::text is distinct from sid and (not_after is null or not_after > now());
  update auth.refresh_tokens set revoked = true, updated_at = now()
   where user_id = u.id::text and session_id::text is distinct from sid and not revoked;
  return how;
end $$;

revoke execute on function snapshot.fn_change_password(text, text) from public, anon;
grant execute on function snapshot.fn_change_password(text, text) to authenticated;
revoke execute on function snapshot.fn_company_members(uuid) from public, anon;
grant execute on function snapshot.fn_company_members(uuid) to authenticated;
revoke execute on function snapshot.worker_job(uuid), snapshot.worker_premises(uuid), snapshot.worker_consumer(uuid) from public, anon;
grant execute on function snapshot.worker_job(uuid), snapshot.worker_premises(uuid), snapshot.worker_consumer(uuid), snapshot.is_worker() to authenticated;

-- =============================================================================
-- 5. Demo: Liam Brooks (Northside worker) gets two of the demo jobs after a reset
-- =============================================================================
create or replace function snapshot.fn_demo_assign_workers() returns int
language plpgsql security definer set search_path = snapshot, public as $$
declare n int;
begin
  if auth.uid() is not null and not snapshot.is_global_admin() then
    raise exception 'Only a global admin can reset demo data' using errcode = '42501';
  end if;
  update snapshot.installation i set assigned_to = '2b0f0000-0000-4000-8000-000000000014'
    from snapshot.consumer_records c
   where c.consumer_id = i.consumer_id and i.is_demo and c.first_name in ('Hannah', 'Tom')
     and exists (select 1 from snapshot.profiles where user_id = '2b0f0000-0000-4000-8000-000000000014');
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function snapshot.fn_demo_assign_workers() from public, anon;
grant execute on function snapshot.fn_demo_assign_workers() to authenticated;

-- check an emailed re-authentication code without using it (for the Settings flow)
create or replace function snapshot.fn_check_reauth_code(_code text) returns boolean
language sql stable security definer set search_path = snapshot, public as $$
  select coalesce(u.reauthentication_token, '') <> ''
     and u.reauthentication_sent_at > now() - interval '15 minutes'
     and u.reauthentication_token = encode(sha224(convert_to(u.email || trim(coalesce(_code, '')), 'UTF8')), 'hex')
  from auth.users u where u.id = auth.uid()
$$;
revoke execute on function snapshot.fn_check_reauth_code(text) from public, anon;
grant execute on function snapshot.fn_check_reauth_code(text) to authenticated;
