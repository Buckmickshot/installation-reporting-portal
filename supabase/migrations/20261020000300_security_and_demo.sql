-- =============================================================================
-- Security hardening + showcase support
--   • Customer phone/email encrypted at rest (AES-256, key held in Supabase Vault)
--   • MFA enforced at the database: users with an MFA factor must present an
--     aal2 session before any data is visible
--   • Security overview RPC (what is protected and how)
--   • Admin "revert last status change" for demos / corrections (audited)
--   • Product register served from public.activity_6_registry when present
-- =============================================================================

-- ---------- MFA enforcement ---------------------------------------------------
create or replace function snapshot.mfa_satisfied() returns boolean
language sql stable security definer set search_path = snapshot, public as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$$;

create or replace function snapshot.current_company_id() returns uuid
language sql stable security definer set search_path = snapshot, public as $$
  select p.company_id from snapshot.profiles p
  join snapshot.companies c using (company_id)
  where p.user_id = auth.uid() and p.active and c.active and snapshot.mfa_satisfied()
$$;

create or replace function snapshot.is_global_admin() returns boolean
language sql stable security definer set search_path = snapshot, public as $$
  select coalesce((select is_global_admin and active from snapshot.profiles where user_id = auth.uid()), false)
     and snapshot.mfa_satisfied()
$$;

create or replace function snapshot.is_company_admin(_company uuid default null) returns boolean
language sql stable security definer set search_path = snapshot, public as $$
  select coalesce((
    select p.is_admin and p.active
    from snapshot.profiles p
    where p.user_id = auth.uid()
      and p.company_id = coalesce(_company, p.company_id)
  ), false) and snapshot.mfa_satisfied()
$$;

-- ---------- PII encryption ----------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'veu_pii_key') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'veu_pii_key',
      'AES-256 key for customer contact details (snapshot.consumer_records)');
  end if;
end $$;

create or replace function snapshot._pii_key() returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'veu_pii_key' limit 1
$$;
revoke execute on function snapshot._pii_key() from public, anon, authenticated;

create or replace function snapshot.pii_encrypt(_value text) returns bytea
language sql stable security definer set search_path = snapshot, public, extensions as $$
  select case when _value is null or _value = '' then null
              else pgp_sym_encrypt(_value, snapshot._pii_key(), 'cipher-algo=aes256') end
$$;
revoke execute on function snapshot.pii_encrypt(text) from public, anon, authenticated;

-- decrypts only for signed-in, active staff (who also pass RLS on the row)
create or replace function snapshot.pii_decrypt(_value bytea) returns text
language sql stable security definer set search_path = snapshot, public, extensions as $$
  select case when _value is null or snapshot.current_company_id() is null then null
              else pgp_sym_decrypt(_value, snapshot._pii_key()) end
$$;
revoke execute on function snapshot.pii_decrypt(bytea) from public, anon;

alter table snapshot.consumer_details rename to consumer_records;
alter table snapshot.consumer_records
  add column phone_enc bytea,
  add column email_enc bytea;
update snapshot.consumer_records
   set phone_enc = snapshot.pii_encrypt(phone_number),
       email_enc = snapshot.pii_encrypt(email_address),
       phone_number = null,
       email_address = null;
alter table snapshot.consumer_records
  add constraint consumer_records_no_plaintext check (phone_number is null and email_address is null);
comment on column snapshot.consumer_records.phone_enc is 'AES-256 (OpenPGP symmetric) ciphertext; key in Supabase Vault';
comment on column snapshot.consumer_records.email_enc is 'AES-256 (OpenPGP symmetric) ciphertext; key in Supabase Vault';
revoke insert, update, delete on snapshot.consumer_records from authenticated;

-- the app keeps using snapshot.consumer_details; this view decrypts on read
create view snapshot.consumer_details with (security_invoker = true) as
select consumer_id, company_id, first_name, last_name,
       snapshot.pii_decrypt(phone_enc) as phone_number,
       snapshot.pii_decrypt(email_enc) as email_address,
       is_draft, created_at, updated_at
from snapshot.consumer_records;
grant select on snapshot.consumer_details to authenticated;

create or replace function snapshot.consumer_details_write() returns trigger
language plpgsql security definer set search_path = snapshot, public, extensions as $$
begin
  if tg_op = 'INSERT' then
    insert into snapshot.consumer_records
      (consumer_id, company_id, first_name, last_name, phone_enc, email_enc, is_draft)
    values
      (coalesce(new.consumer_id, gen_random_uuid()), new.company_id, new.first_name, new.last_name,
       snapshot.pii_encrypt(new.phone_number), snapshot.pii_encrypt(new.email_address), coalesce(new.is_draft, true))
    returning consumer_id, created_at, updated_at into new.consumer_id, new.created_at, new.updated_at;
    return new;
  elsif tg_op = 'UPDATE' then
    update snapshot.consumer_records r
       set company_id = new.company_id,
           first_name = new.first_name,
           last_name  = new.last_name,
           phone_enc  = case when new.phone_number is distinct from old.phone_number
                             then snapshot.pii_encrypt(new.phone_number) else r.phone_enc end,
           email_enc  = case when new.email_address is distinct from old.email_address
                             then snapshot.pii_encrypt(new.email_address) else r.email_enc end,
           is_draft   = new.is_draft
     where r.consumer_id = old.consumer_id;
    return new;
  else
    delete from snapshot.consumer_records where consumer_id = old.consumer_id;
    return old;
  end if;
end $$;
create trigger trg_consumer_details_write instead of insert or update or delete on snapshot.consumer_details
  for each row execute function snapshot.consumer_details_write();

-- re-point the dashboard view at the decrypting view
create or replace view snapshot.installation_overview
with (security_invoker = true) as
select
  i.installation_id,
  i.job_number,
  'VEU-' || lpad(i.job_number::text, 6, '0') as job_ref,
  i.company_id,
  cv.name                                   as company_name,
  i.activity_type,
  i.status,
  i.complete,
  i.created_at,
  i.updated_at,
  i.submitted_at,
  i.approved_at,
  i.installation_date,
  i.user_id,
  creator.name                              as created_by_name,
  i.assigned_to,
  assignee.name                             as assigned_to_name,
  p.premises_id,
  p.full_address,
  p.premises_type,
  c.consumer_id,
  nullif(trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), '') as customer_name,
  c.phone_number                            as customer_phone,
  c.email_address                           as customer_email,
  coalesce(jsonb_array_length(nullif(i.form_data->'installedProducts', 'null'::jsonb)), 0) as product_count,
  (select count(*) from snapshot.job_evidence e where e.installation_id = i.installation_id) as evidence_count,
  (select e.message from snapshot.job_events e
     where e.installation_id = i.installation_id and e.to_status = 'rfi'
     order by e.created_at desc limit 1)    as last_rfi_message
from snapshot.installation i
left join snapshot.premises p          on p.premises_id = i.premises_id
left join snapshot.consumer_details c  on c.consumer_id = i.consumer_id
left join snapshot.profiles creator    on creator.user_id = i.user_id
left join snapshot.profiles assignee   on assignee.user_id = i.assigned_to
left join snapshot.current_company_versions cv on cv.company_id = i.company_id;
grant select on snapshot.installation_overview to authenticated;

-- ---------- revert last status change (admins; audited) ------------------------
create or replace function snapshot.fn_revert_job_status(_installation uuid, _message text default null)
returns snapshot.installation
language plpgsql security definer set search_path = snapshot, public as $$
declare r snapshot.installation; prev text;
begin
  r := snapshot._assert_installation(_installation);
  if not (snapshot.is_global_admin() or snapshot.is_company_admin(r.company_id)) then
    raise exception 'Only admins can revert a status change' using errcode = '42501';
  end if;
  select e.from_status into prev from snapshot.job_events e
   where e.installation_id = _installation and e.event_type = 'status_change' and e.to_status = r.status
   order by e.created_at desc limit 1;
  if prev is null then raise exception 'Nothing to revert'; end if;

  perform set_config('snapshot.via_status_rpc', 'on', true);
  perform set_config('snapshot.status_message', '↩ Reverted' || coalesce(': ' || nullif(trim(_message), ''), ''), true);
  update snapshot.installation
     set status = prev,
         complete = prev in ('submitted','approved','paid'),
         submitted_at = case when prev in ('submitted','approved','paid') then submitted_at end,
         approved_at  = case when prev in ('approved','paid') then approved_at end
   where installation_id = _installation
  returning * into r;
  perform set_config('snapshot.via_status_rpc', '', true);
  perform set_config('snapshot.status_message', '', true);
  return r;
end $$;

-- ---------- security overview -------------------------------------------------
create or replace function snapshot.fn_security_overview() returns jsonb
language plpgsql stable security definer set search_path = snapshot, public as $$
declare cid uuid := snapshot.current_company_id(); sample bytea;
begin
  if cid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select phone_enc into sample from snapshot.consumer_records r
   where r.phone_enc is not null and snapshot.can_access_company(r.company_id)
   order by r.created_at desc limit 1;
  return jsonb_build_object(
    'rls_tables', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'snapshot' and c.relkind = 'r' and c.relrowsecurity),
    'all_tables', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'snapshot' and c.relkind = 'r'),
    'encrypted_customers', (select count(*) from snapshot.consumer_records r
                             where (r.phone_enc is not null or r.email_enc is not null) and snapshot.can_access_company(r.company_id)),
    'ciphertext_sample', case when sample is null then null else encode(substring(sample from 1 for 48), 'hex') end,
    'cipher', 'AES-256 (OpenPGP symmetric, pgcrypto)',
    'key_store', 'Supabase Vault (secret encrypted with the project root key; never sent to the browser)',
    'password_hashing', case when (select encrypted_password from auth.users where id = auth.uid()) like '$2%' then 'bcrypt' else 'hashed' end,
    'mfa_factors', (select count(*) from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'),
    'session_aal', coalesce(auth.jwt() ->> 'aal', 'aal1'),
    'audit_events', (select count(*) from snapshot.job_events e where snapshot.can_access_company(e.company_id)),
    'transport', 'HTTPS / TLS 1.2+ for all API traffic'
  );
end $$;

-- ---------- product register --------------------------------------------------
do $$
begin
  if to_regclass('public.activity_6_registry') is not null then
    alter table snapshot.activity_6_registry rename to activity_6_registry_sample;
    execute $v$
      create view snapshot.activity_6_registry as
      select registry_id,
             "Product Category No.", "Brand", "Model", "Product Type", "Product Configuration",
             "Product Unit Mount", "Heating Capacity (kW)", "Cooling Capacity (kW)",
             "GEMS Class", "Refrigerant Type (GWP)", "Status", "Effective From", "Effective To"
        from public.activity_6_registry
       where coalesce("Status", 'Approved') = 'Approved'
    $v$;
    grant select on snapshot.activity_6_registry to authenticated;
  end if;
end $$;

grant execute on all functions in schema snapshot to authenticated;
revoke execute on function snapshot._pii_key() from authenticated;
revoke execute on function snapshot.pii_encrypt(text) from authenticated;
