-- Portal functions are callable by signed-in staff only; helper/key functions not at all.
do $$ begin
  if exists (select 1 from pg_views where schemaname = 'snapshot' and viewname = 'activity_6_registry') then
    execute 'alter view snapshot.activity_6_registry set (security_invoker = true)';
  end if;
end $$;
revoke execute on all functions in schema snapshot from public, anon;
grant execute on all functions in schema snapshot to authenticated;
revoke execute on function snapshot._pii_key() from authenticated;
revoke execute on function snapshot.pii_encrypt(text) from authenticated;
revoke execute on function snapshot._demo_job(uuid,uuid,uuid,text,text,text,text,text,text,jsonb,date,timestamptz,text,boolean) from authenticated;
alter default privileges in schema snapshot revoke execute on functions from public;
