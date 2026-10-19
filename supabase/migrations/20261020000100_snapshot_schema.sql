-- =============================================================================
-- VEU Installation Reporting Portal — core schema (schema: snapshot)
--
-- Reconstructed from the front-end's usage of Supabase. Apply to a fresh
-- Supabase project with `supabase db push` (or paste into the SQL editor),
-- then add `snapshot` to Settings → API → "Exposed schemas".
-- =============================================================================

create extension if not exists pgcrypto;

create schema if not exists snapshot;
grant usage on schema snapshot to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Companies (installer businesses) — versioned name/address
-- -----------------------------------------------------------------------------
create table snapshot.companies (
  company_id  uuid primary key default gen_random_uuid(),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table snapshot.company_versions (
  company_version_id  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references snapshot.companies(company_id) on delete cascade,
  name                text not null,
  address             text not null,
  previous_version_id uuid references snapshot.company_versions(company_version_id),
  created_by          uuid default auth.uid(),
  created_at          timestamptz not null default now()
);
create index on snapshot.company_versions (company_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Staff profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table snapshot.profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  company_id      uuid not null references snapshot.companies(company_id),
  name            text,
  email           text,
  phone           text,
  active          boolean not null default true,
  is_admin        boolean not null default false,
  is_global_admin boolean not null default false,
  confirmed       boolean not null default false,
  created_at      timestamptz not null default now()
);
create index on snapshot.profiles (company_id);

-- -----------------------------------------------------------------------------
-- Permission helpers (SECURITY DEFINER so they can be used inside RLS)
-- -----------------------------------------------------------------------------
create or replace function snapshot.current_company_id() returns uuid
language sql stable security definer set search_path = snapshot, public as $$
  select p.company_id from snapshot.profiles p
  join snapshot.companies c using (company_id)
  where p.user_id = auth.uid() and p.active and c.active
$$;

create or replace function snapshot.is_global_admin() returns boolean
language sql stable security definer set search_path = snapshot, public as $$
  select coalesce((select is_global_admin and active from snapshot.profiles where user_id = auth.uid()), false)
$$;

create or replace function snapshot.is_company_admin(_company uuid default null) returns boolean
language sql stable security definer set search_path = snapshot, public as $$
  select coalesce((
    select p.is_admin and p.active
    from snapshot.profiles p
    where p.user_id = auth.uid()
      and p.company_id = coalesce(_company, p.company_id)
  ), false)
$$;

-- "can this user see/edit rows belonging to company X?"
create or replace function snapshot.can_access_company(_company uuid) returns boolean
language sql stable security definer set search_path = snapshot, public as $$
  select snapshot.is_global_admin() or _company = snapshot.current_company_id()
$$;

grant execute on all functions in schema snapshot to authenticated;

-- Current version of every company, plus the active flag
create or replace view snapshot.current_company_versions
with (security_invoker = true) as
select distinct on (cv.company_id)
  cv.company_id,
  cv.company_version_id,
  cv.name,
  cv.address,
  cv.created_at,
  c.active as company_active,
  c.active as active
from snapshot.company_versions cv
join snapshot.companies c using (company_id)
order by cv.company_id, cv.created_at desc;

-- -----------------------------------------------------------------------------
-- Premises, consumers, installations
-- -----------------------------------------------------------------------------
create table snapshot.premises (
  premises_id        uuid primary key default gen_random_uuid(),
  company_id         uuid not null references snapshot.companies(company_id),
  full_address       text,
  premises_type      text check (premises_type in ('residential','non-residential')),
  building_age_check boolean,
  is_draft           boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on snapshot.premises (company_id, lower(full_address));

create table snapshot.consumer_details (
  consumer_id   uuid primary key default gen_random_uuid(),
  company_id    uuid not null references snapshot.companies(company_id),
  first_name    text,
  last_name     text,
  phone_number  text,
  email_address text,
  is_draft      boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on snapshot.consumer_details (company_id);

create table snapshot.installation (
  installation_id uuid primary key default gen_random_uuid(),
  company_id      uuid not null references snapshot.companies(company_id),
  user_id         uuid references auth.users(id) default auth.uid(),
  activity_type   text,
  premises_id     uuid references snapshot.premises(premises_id),
  consumer_id     uuid references snapshot.consumer_details(consumer_id),
  complete        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on snapshot.installation (company_id, created_at desc);
create index on snapshot.installation (premises_id);

-- -----------------------------------------------------------------------------
-- Building documents (shared per premises) + link to installations
-- -----------------------------------------------------------------------------
create table snapshot.building_documents (
  building_documents_id uuid primary key default gen_random_uuid(),
  premises_id   uuid not null references snapshot.premises(premises_id) on delete cascade,
  company_id    uuid not null references snapshot.companies(company_id),
  doc_type      text not null check (doc_type in
                  ('certificate','inspection','handover','statutory_declaration','previous_installation_evidence')),
  file_url      text not null,
  file_name     text,
  doc_date      date,
  content_hash  text,
  created_at    timestamptz not null default now(),
  unique (premises_id, doc_type, file_url)
);

create table snapshot.installation_documents (
  installation_id       uuid references snapshot.installation(installation_id) on delete cascade,
  building_documents_id uuid references snapshot.building_documents(building_documents_id) on delete cascade,
  company_id            uuid not null references snapshot.companies(company_id),
  created_at            timestamptz not null default now(),
  primary key (installation_id, building_documents_id)
);

-- -----------------------------------------------------------------------------
-- Prior-installation totals per premises (caps for Activity 6)
-- -----------------------------------------------------------------------------
create table snapshot.installation_history (
  installation_history_id   uuid primary key default gen_random_uuid(),
  premises_id               uuid not null references snapshot.premises(premises_id) on delete cascade,
  installation_id           uuid references snapshot.installation(installation_id) on delete cascade,
  company_id                uuid references snapshot.companies(company_id),
  ducted_installed          int not null default 0 check (ducted_installed >= 0),
  ducted_decommissioned     int not null default 0 check (ducted_decommissioned >= 0),
  non_ducted_installed      int not null default 0 check (non_ducted_installed >= 0),
  non_ducted_decommissioned int not null default 0 check (non_ducted_decommissioned >= 0),
  statutory_declaration_id  uuid references snapshot.building_documents(building_documents_id) on delete set null,
  statutory_declaration_type text,
  is_latest                 boolean not null default true,
  created_at                timestamptz not null default now()
);
create index on snapshot.installation_history (premises_id) where is_latest;

-- -----------------------------------------------------------------------------
-- Decommissioned products
-- -----------------------------------------------------------------------------
create table snapshot.decommissioning (
  decom_id        uuid primary key default gen_random_uuid(),
  installation_id uuid not null references snapshot.installation(installation_id) on delete cascade,
  company_id      uuid references snapshot.companies(company_id),
  decom_scenario  text,
  brand           text,
  model           text,
  "COES_required" boolean,
  "VBA_required"  boolean,
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Product registry (Activity 6 — ESC registered products) — read-only reference
-- -----------------------------------------------------------------------------
create table snapshot.activity_6_registry (
  registry_id               uuid primary key default gen_random_uuid(),
  "Product Category No."    text,
  "Brand"                   text,
  "Model"                   text,
  "Product Type"            text,
  "Product Configuration"   text,
  "Product Unit Mount"      text,
  "Heating Capacity (kW)"   numeric,
  "Cooling Capacity (kW)"   numeric
);
create index on snapshot.activity_6_registry ("Brand", "Model");

-- -----------------------------------------------------------------------------
-- Tradespeople directories (per company, used for autofill)
-- -----------------------------------------------------------------------------
create table snapshot.licenced_plumber (
  plumber_id      uuid primary key default gen_random_uuid(),
  company_id      uuid not null default snapshot.current_company_id() references snapshot.companies(company_id),
  name text, company_name text, company_address text, phone_number text, licence_number text,
  created_at timestamptz not null default now()
);
create table snapshot.registered_plumber (
  plumber_id      uuid primary key default gen_random_uuid(),
  company_id      uuid not null default snapshot.current_company_id() references snapshot.companies(company_id),
  name text, company_name text, company_address text, phone_number text, registration_number text,
  created_at timestamptz not null default now()
);
create table snapshot.electrician (
  electrician_id  uuid primary key default gen_random_uuid(),
  company_id      uuid not null default snapshot.current_company_id() references snapshot.companies(company_id),
  name text, company_name text, company_address text, phone_number text, licence_number text,
  created_at timestamptz not null default now()
);
create table snapshot.refrigerant_handler (
  handler_id      uuid primary key default gen_random_uuid(),
  company_id      uuid not null default snapshot.current_company_id() references snapshot.companies(company_id),
  name text, company_name text, company_address text, phone_number text, licence_number text,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- Triggers
-- =============================================================================
create or replace function snapshot.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

create trigger trg_installation_touch before update on snapshot.installation
  for each row execute function snapshot.touch_updated_at();
create trigger trg_premises_touch before update on snapshot.premises
  for each row execute function snapshot.touch_updated_at();
create trigger trg_consumer_touch before update on snapshot.consumer_details
  for each row execute function snapshot.touch_updated_at();

-- Child tables inherit company_id from their installation / premises
create or replace function snapshot.fill_company_from_installation() returns trigger
language plpgsql security definer set search_path = snapshot, public as $$
begin
  if new.company_id is null then
    select company_id into new.company_id from snapshot.installation where installation_id = new.installation_id;
  end if;
  return new;
end $$;
create trigger trg_decom_company before insert on snapshot.decommissioning
  for each row execute function snapshot.fill_company_from_installation();

create or replace function snapshot.history_before_write() returns trigger
language plpgsql security definer set search_path = snapshot, public as $$
begin
  if new.company_id is null then
    select company_id into new.company_id from snapshot.premises where premises_id = new.premises_id;
  end if;
  -- "trigger 02": recalculate the declaration type whenever it is cleared
  if new.statutory_declaration_type is null then
    new.statutory_declaration_type := case
      when new.statutory_declaration_id is not null then 'statutory_declaration'
      when new.ducted_installed + new.non_ducted_installed = 0 then 'none_required'
      else 'evidence_required'
    end;
  end if;
  return new;
end $$;
create trigger trg_history_before before insert or update on snapshot.installation_history
  for each row execute function snapshot.history_before_write();

-- only one "latest" history row per premises
create or replace function snapshot.history_single_latest() returns trigger
language plpgsql security definer set search_path = snapshot, public as $$
begin
  if new.is_latest then
    update snapshot.installation_history
       set is_latest = false
     where premises_id = new.premises_id
       and installation_history_id <> new.installation_history_id
       and is_latest;
  end if;
  return null;
end $$;
create trigger trg_history_latest after insert or update of is_latest on snapshot.installation_history
  for each row execute function snapshot.history_single_latest();

-- Profiles: block privilege escalation
create or replace function snapshot.profiles_guard() returns trigger
language plpgsql security definer set search_path = snapshot, public as $$
begin
  if auth.uid() is null or snapshot.is_global_admin() then
    return new;            -- service role / SQL editor / global admin: unrestricted
  end if;

  if new.is_global_admin and (tg_op = 'INSERT' or not old.is_global_admin) then
    raise exception 'Only a global admin can grant global admin';
  end if;

  if tg_op = 'UPDATE' then
    if new.company_id <> old.company_id then
      raise exception 'Users cannot be moved between companies';
    end if;
    if not snapshot.is_company_admin(old.company_id) and
       (new.is_admin <> old.is_admin or new.active <> old.active) then
      raise exception 'Only an admin can change roles or activation';
    end if;
    if new.user_id = auth.uid() and (new.is_admin <> old.is_admin or new.active <> old.active) then
      raise exception 'You cannot change your own role or activation';
    end if;
  end if;
  return new;
end $$;
create trigger trg_profiles_guard before insert or update on snapshot.profiles
  for each row execute function snapshot.profiles_guard();

-- Mark profile confirmed when the auth user confirms their email
create or replace function snapshot.sync_profile_confirmed() returns trigger
language plpgsql security definer set search_path = snapshot, public as $$
begin
  update snapshot.profiles
     set confirmed = (new.email_confirmed_at is not null), email = new.email
   where user_id = new.id;
  return new;
end $$;
create trigger trg_auth_user_confirmed after insert or update of email_confirmed_at, email on auth.users
  for each row execute function snapshot.sync_profile_confirmed();

create or replace function snapshot.profile_set_confirmed() returns trigger
language plpgsql security definer set search_path = snapshot, public as $$
begin
  select (email_confirmed_at is not null) into new.confirmed from auth.users where id = new.user_id;
  new.confirmed := coalesce(new.confirmed, false);
  return new;
end $$;
create trigger trg_profile_confirmed before insert on snapshot.profiles
  for each row execute function snapshot.profile_set_confirmed();

-- =============================================================================
-- RPCs used by the front-end
-- =============================================================================

-- Global admin: create a company with its first version
create or replace function snapshot.create_new_company(input_name text, input_address text)
returns uuid language plpgsql security definer set search_path = snapshot, public as $$
declare _cid uuid;
begin
  if not snapshot.is_global_admin() then
    raise exception 'Only global admins can create companies' using errcode = '42501';
  end if;
  insert into snapshot.companies default values returning company_id into _cid;
  insert into snapshot.company_versions (company_id, name, address) values (_cid, input_name, input_address);
  return _cid;
end $$;

-- Step 1 of a job: create installation + an empty draft premises
create or replace function snapshot.fn_create_installation_with_premises(
  _company uuid, _activity_type text, _prem_type text)
returns table (installation_id uuid, premises_id uuid)
language plpgsql security definer set search_path = snapshot, public as $$
declare _iid uuid; _pid uuid;
begin
  if _company is null then _company := snapshot.current_company_id(); end if;
  if not snapshot.can_access_company(_company) then
    raise exception 'Not allowed for this company' using errcode = '42501';
  end if;
  insert into snapshot.premises (company_id, premises_type, is_draft)
    values (_company, _prem_type, true) returning premises.premises_id into _pid;
  insert into snapshot.installation (company_id, user_id, activity_type, premises_id)
    values (_company, auth.uid(), _activity_type, _pid) returning installation.installation_id into _iid;
  return query select _iid, _pid;
end $$;

create or replace function snapshot._assert_installation(_installation uuid)
returns snapshot.installation language plpgsql stable security definer set search_path = snapshot, public as $$
declare r snapshot.installation;
begin
  select * into r from snapshot.installation where installation_id = _installation;
  if r is null then raise exception 'Installation not found' using errcode = 'P0002'; end if;
  if not snapshot.can_access_company(r.company_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return r;
end $$;

create or replace function snapshot.fn_create_consumer_draft(_installation uuid)
returns uuid language plpgsql security definer set search_path = snapshot, public as $$
declare r snapshot.installation; _cid uuid;
begin
  r := snapshot._assert_installation(_installation);
  if r.consumer_id is not null then return r.consumer_id; end if;
  insert into snapshot.consumer_details (company_id, is_draft) values (r.company_id, true)
    returning consumer_id into _cid;
  update snapshot.installation set consumer_id = _cid where installation_id = _installation;
  return _cid;
end $$;

create or replace function snapshot.fn_set_consumer_details(
  _installation uuid, _first_name text, _last_name text, _phone_number text,
  _email_address text, _source_consumer uuid default null)
returns uuid language plpgsql security definer set search_path = snapshot, public as $$
declare r snapshot.installation; src snapshot.consumer_details; _cid uuid;
begin
  r := snapshot._assert_installation(_installation);
  _cid := coalesce(r.consumer_id, snapshot.fn_create_consumer_draft(_installation));
  if _source_consumer is not null then
    select * into src from snapshot.consumer_details where consumer_id = _source_consumer;
    if src is null or not snapshot.can_access_company(src.company_id) then
      raise exception 'Source customer not accessible' using errcode = '42501';
    end if;
    _first_name := src.first_name; _last_name := src.last_name;
    _phone_number := src.phone_number; _email_address := src.email_address;
  end if;
  update snapshot.consumer_details
     set first_name = _first_name, last_name = _last_name,
         phone_number = _phone_number, email_address = _email_address
   where consumer_id = _cid;
  return _cid;
end $$;

-- Create/update the installation's premises, or re-link to an existing finished one
create or replace function snapshot.fn_upsert_premises(
  _company_input uuid, _activity_type text, _installation uuid,
  _full_address text, _premises_type text, _other_fields jsonb default '{}'::jsonb,
  _reuse_existing boolean default false, _copy_building_docs boolean default false)
returns table (premises_id uuid, reused boolean)
language plpgsql security definer set search_path = snapshot, public as $$
declare r snapshot.installation; _pid uuid; _old uuid;
begin
  r := snapshot._assert_installation(_installation);
  _old := r.premises_id;

  if _reuse_existing then
    select p.premises_id into _pid from snapshot.premises p
     where p.company_id = r.company_id and not p.is_draft
       and lower(trim(p.full_address)) = lower(trim(_full_address))
       and p.premises_type = _premises_type
     order by p.created_at limit 1;
    if _pid is not null then
      update snapshot.installation set premises_id = _pid where installation_id = _installation;
      -- drop the now-orphaned draft premises
      if _old is not null and _old <> _pid then
        delete from snapshot.premises p where p.premises_id = _old and p.is_draft
          and not exists (select 1 from snapshot.installation i where i.premises_id = _old);
      end if;
      if _copy_building_docs then
        perform snapshot.fn_link_latest_docs_for_premises(_installation, _pid);
      end if;
      return query select _pid, true;
      return;
    end if;
  end if;

  if _old is null then
    insert into snapshot.premises (company_id, full_address, premises_type, is_draft)
      values (r.company_id, _full_address, _premises_type, true) returning premises.premises_id into _pid;
    update snapshot.installation set premises_id = _pid where installation_id = _installation;
  else
    _pid := _old;
    update snapshot.premises p
       set full_address  = coalesce(_full_address, p.full_address),
           premises_type = coalesce(_premises_type, p.premises_type),
           building_age_check = coalesce((_other_fields->>'building_age_check')::boolean, p.building_age_check)
     where p.premises_id = _pid;
  end if;
  return query select _pid, false;
end $$;

create or replace function snapshot.fn_attach_building_document(
  _installation uuid, _doc_type text, _file_url text, _file_name text,
  _doc_date date default null, _content_hash text default null)
returns uuid language plpgsql security definer set search_path = snapshot, public as $$
declare r snapshot.installation; _did uuid;
begin
  r := snapshot._assert_installation(_installation);
  if r.premises_id is null then raise exception 'Installation has no premises yet'; end if;
  insert into snapshot.building_documents (premises_id, company_id, doc_type, file_url, file_name, doc_date, content_hash)
    values (r.premises_id, r.company_id, _doc_type, _file_url, _file_name, _doc_date, _content_hash)
  on conflict (premises_id, doc_type, file_url) do update
    set file_name = excluded.file_name,
        doc_date = coalesce(excluded.doc_date, building_documents.doc_date),
        content_hash = coalesce(excluded.content_hash, building_documents.content_hash)
  returning building_documents_id into _did;
  insert into snapshot.installation_documents (installation_id, building_documents_id, company_id)
    values (_installation, _did, r.company_id) on conflict do nothing;
  return _did;
end $$;

create or replace function snapshot.fn_link_existing_doc(_installation uuid, _doc_id uuid)
returns void language plpgsql security definer set search_path = snapshot, public as $$
declare r snapshot.installation; d snapshot.building_documents;
begin
  r := snapshot._assert_installation(_installation);
  select * into d from snapshot.building_documents where building_documents_id = _doc_id;
  if d is null or d.company_id <> r.company_id then raise exception 'Document not accessible' using errcode = '42501'; end if;
  insert into snapshot.installation_documents (installation_id, building_documents_id, company_id)
    values (_installation, _doc_id, r.company_id) on conflict do nothing;
end $$;

create or replace function snapshot.fn_link_latest_docs_for_premises(_installation uuid, _premises uuid)
returns int language plpgsql security definer set search_path = snapshot, public as $$
declare r snapshot.installation; n int;
begin
  r := snapshot._assert_installation(_installation);
  insert into snapshot.installation_documents (installation_id, building_documents_id, company_id)
    select _installation, d.building_documents_id, r.company_id
      from snapshot.building_documents d
     where d.premises_id = _premises and d.company_id = r.company_id
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table snapshot.companies              enable row level security;
alter table snapshot.company_versions       enable row level security;
alter table snapshot.profiles               enable row level security;
alter table snapshot.premises               enable row level security;
alter table snapshot.consumer_details       enable row level security;
alter table snapshot.installation           enable row level security;
alter table snapshot.building_documents     enable row level security;
alter table snapshot.installation_documents enable row level security;
alter table snapshot.installation_history   enable row level security;
alter table snapshot.decommissioning        enable row level security;
alter table snapshot.activity_6_registry    enable row level security;
alter table snapshot.licenced_plumber       enable row level security;
alter table snapshot.registered_plumber     enable row level security;
alter table snapshot.electrician            enable row level security;
alter table snapshot.refrigerant_handler    enable row level security;

-- companies
create policy companies_select on snapshot.companies for select to authenticated
  using (snapshot.can_access_company(company_id));
create policy companies_update on snapshot.companies for update to authenticated
  using (snapshot.is_global_admin()) with check (snapshot.is_global_admin());

-- company_versions
create policy cv_select on snapshot.company_versions for select to authenticated
  using (snapshot.can_access_company(company_id));
create policy cv_insert on snapshot.company_versions for insert to authenticated
  with check (snapshot.is_global_admin() or snapshot.is_company_admin(company_id));

-- profiles: everyone may read their own row (needed to discover inactive status)
create policy profiles_select on snapshot.profiles for select to authenticated
  using (user_id = auth.uid() or snapshot.can_access_company(company_id));
create policy profiles_insert on snapshot.profiles for insert to authenticated
  with check (snapshot.is_global_admin() or snapshot.is_company_admin(company_id));
create policy profiles_update on snapshot.profiles for update to authenticated
  using (user_id = auth.uid() or snapshot.is_global_admin() or snapshot.is_company_admin(company_id))
  with check (user_id = auth.uid() or snapshot.is_global_admin() or snapshot.is_company_admin(company_id));

-- company-scoped data tables: full CRUD inside your own company
do $$
declare t text;
begin
  foreach t in array array['premises','consumer_details','installation','building_documents',
                           'installation_documents','installation_history','decommissioning',
                           'licenced_plumber','registered_plumber','electrician','refrigerant_handler']
  loop
    execute format('create policy %1$s_rw on snapshot.%1$I for all to authenticated
                      using (snapshot.can_access_company(company_id))
                      with check (snapshot.can_access_company(company_id))', t);
  end loop;
end $$;

-- registry: read-only for staff
create policy registry_read on snapshot.activity_6_registry for select to authenticated using (true);

grant select, insert, update, delete on all tables in schema snapshot to authenticated;
grant all on all tables in schema snapshot to service_role;
revoke insert, update, delete on snapshot.activity_6_registry from authenticated;
revoke delete on snapshot.companies, snapshot.company_versions from authenticated;

-- =============================================================================
-- Storage: "uploads" bucket for building documents & job evidence
-- =============================================================================
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', true)
  on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'staff can read uploads') then
    create policy "staff can read uploads" on storage.objects for select to authenticated
      using (bucket_id = 'uploads');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'active staff can upload') then
    create policy "active staff can upload" on storage.objects for insert to authenticated
      with check (bucket_id = 'uploads' and snapshot.current_company_id() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'active staff can overwrite') then
    create policy "active staff can overwrite" on storage.objects for update to authenticated
      using (bucket_id = 'uploads' and snapshot.current_company_id() is not null);
  end if;
end $$;
