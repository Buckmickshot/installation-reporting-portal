-- Local emulation of the Supabase platform roles/schemas.
-- On a real Supabase project all of this already exists; it is NOT part of the app migrations.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login password 'postgres' noinherit;
grant anon, authenticated, service_role to authenticator;
create role supabase_auth_admin login password 'postgres' createrole noinherit;
create role supabase_storage_admin login password 'postgres' noinherit;

create schema if not exists auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role, postgres;
alter role supabase_auth_admin set search_path = auth;

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- Minimal storage schema (the real one is managed by Supabase Storage)
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean default false,
  created_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to authenticated, service_role;
grant select on storage.objects, storage.buckets to anon;
