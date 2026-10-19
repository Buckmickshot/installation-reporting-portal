-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Adds: delete-draft-job, and the "Reset demo data" button. Only touches the portal's snapshot schema.

-- delete support for the encrypted customer view
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

-- delete a draft / cancelled job (creator or admin)
create or replace function snapshot.fn_delete_installation(_installation uuid)
returns void language plpgsql security definer set search_path = snapshot, public as $$
declare r snapshot.installation;
begin
  r := snapshot._assert_installation(_installation);
  if r.status not in ('draft','cancelled') then
    raise exception 'Only draft or cancelled jobs can be deleted' using errcode = '42501';
  end if;
  if not (r.user_id = auth.uid() or snapshot.is_global_admin() or snapshot.is_company_admin(r.company_id)) then
    raise exception 'Only the creator or an admin can delete this job' using errcode = '42501';
  end if;
  delete from snapshot.installation where installation_id = _installation;
  delete from snapshot.premises p where p.premises_id = r.premises_id and p.is_draft
    and not exists (select 1 from snapshot.installation i where i.premises_id = p.premises_id);
  delete from snapshot.consumer_details c where c.consumer_id = r.consumer_id and c.is_draft
    and not exists (select 1 from snapshot.installation i where i.consumer_id = c.consumer_id);
end $$;

create or replace function snapshot.fn_reset_demo(_asset_base text default 'https://buckmickshot.github.io/installation-reporting-portal')
returns int language plpgsql security definer set search_path = snapshot, public as $$
declare
  northside uuid := '1a0f0000-0000-4000-8000-000000000002';
  bayside   uuid := '1a0f0000-0000-4000-8000-000000000003';
  olivia uuid := '2b0f0000-0000-4000-8000-000000000011';
  jack   uuid := '2b0f0000-0000-4000-8000-000000000012';
  priya  uuid := '2b0f0000-0000-4000-8000-000000000013';
  prem uuid[]; cons uuid[];
begin
  if auth.uid() is not null and not snapshot.is_global_admin() then
    raise exception 'Only a global admin can reset demo data' using errcode = '42501';
  end if;
  if not exists (select 1 from snapshot.profiles where user_id = jack) then
    raise exception 'Demo accounts are missing';
  end if;

  select array_agg(premises_id), array_agg(consumer_id) into prem, cons from snapshot.installation where is_demo;
  delete from snapshot.installation where is_demo;
  delete from snapshot.premises p where p.premises_id = any(coalesce(prem, '{}'))
    and not exists (select 1 from snapshot.installation i where i.premises_id = p.premises_id);
  delete from snapshot.consumer_records c where c.consumer_id = any(coalesce(cons, '{}'))
    and not exists (select 1 from snapshot.installation i where i.consumer_id = c.consumer_id);

  -- 1. complete application, waiting for review (the showcase job)
  perform snapshot._demo_job(northside, jack, jack, 'ready_for_review', 'Alex', 'Morgan', '0412 555 019', 'alex.morgan@example.com',
    '17 Banksia Street, Brunswick VIC 3056', '{"rooms": [], "COESNo": "COES-2026-104221", "VBARequired": false, "COESRequired": true, "typeOfBenefit": "Price reduction", "amountOfBenefit": "1150", "electricianName": "Sam O''Brien", "electricianPhone": "0400 111 303", "installationDate": "2026-10-14", "accredittedPerson": "ASAP Rebates", "priceBeforeVeec": "3500", "consumerPayment": "2350", "repairScope": "none", "decommissionSteps": {}, "installedProducts": [{"brand": "Bonaire", "model": "CRC6911050/CRC6911150", "serialNo": "BN52-2410-008731", "coPayment": "1000", "matchSize": null, "unitMount": "Wall Hung", "areaBucket": "41-60", "sizeReason": "", "productType": "Non-Ducted", "factSheetRec": true, "minCoPayment": 1000, "selectedArea": null, "selectedRooms": [], "coolingCapacity": 5.2, "heatingCapacity": 5.2, "productCategory": "6E(i)", "unitConfiguration": "Single split system"}], "installerTasksDone": true, "licencedPlumberName": "Daniel Rossi", "electricianLicenseNo": "REC-26874", "licencedPlumberPhone": "0400 111 301", "postInstallinfoGiven": true, "registeredPlumberName": "Mei Lin", "decommissionedProducts": [{"brand": "Fujitsu", "model": "ASTA09LCC", "removed": true, "ductReplacement": "N/A", "decommissionMethod": "Refrigerant recovered by licensed handler (ARC), unit isolated, disconnected and removed", "decommissionScenario": "vi"}], "electricianCompanyName": "Brunswick Electrical Services", "refrigerantHandlerName": "Daniel Rossi", "registeredPlumberPhone": "0400 111 302", "refrigerantHandlerPhone": "0400 111 301", "licencedPlumberLicenseNo": "PL-38291", "electricianCompanyAddress": "48 Sydney Road, Brunswick VIC 3056", "licencedPlumberCompanyName": "Northside Climate Solutions Pty Ltd", "refrigerantHandlerLicenseNo": "L157023", "registeredPlumberCompanyName": "Northside Climate Solutions Pty Ltd", "licencedPlumberCompanyAddress": "48 Sydney Road, Brunswick VIC 3056", "refrigerantHandlerCompanyName": "Northside Climate Solutions Pty Ltd", "registeredPlumberCompanyAddress": "48 Sydney Road, Brunswick VIC 3056", "registeredPlumberRegistrationNo": "RP-55120", "refrigerantHandlerCompanyAddress": "48 Sydney Road, Brunswick VIC 3056"}'::jsonb, date '2026-10-14', now() - interval '6 days', _asset_base, true);
  -- 2. an older job already approved
  perform snapshot._demo_job(northside, jack, jack, 'approved', 'Hannah', 'Lee', '0413 220 784', 'hannah.lee@example.com',
    '9 Rowe Street, Fitzroy North VIC 3068', '{"rooms": [], "COESNo": "COES-2026-104221", "VBARequired": false, "COESRequired": true, "typeOfBenefit": "Price reduction", "amountOfBenefit": "1100", "electricianName": "Sam O''Brien", "electricianPhone": "0400 111 303", "installationDate": "2026-09-22", "accredittedPerson": "ASAP Rebates", "priceBeforeVeec": "3500", "consumerPayment": "2350", "repairScope": "none", "decommissionSteps": {}, "installedProducts": [{"brand": "Braemar", "model": "TCHV50T1S/TSHV50T1S", "serialNo": "BRM-50T-2309-114562", "coPayment": "1000", "matchSize": null, "unitMount": "Wall Hung", "areaBucket": "21-40", "sizeReason": "", "productType": "Non-Ducted", "factSheetRec": true, "minCoPayment": 1000, "selectedArea": null, "selectedRooms": [], "coolingCapacity": 5.2, "heatingCapacity": 5.2, "productCategory": "6E(i)", "unitConfiguration": "Single split system"}], "installerTasksDone": true, "licencedPlumberName": "Daniel Rossi", "electricianLicenseNo": "REC-26874", "licencedPlumberPhone": "0400 111 301", "postInstallinfoGiven": true, "registeredPlumberName": "Mei Lin", "decommissionedProducts": [{"brand": "Mitsubishi Electric", "model": "MSZ-GE25VA", "removed": true, "ductReplacement": "N/A", "decommissionMethod": "Refrigerant recovered by licensed handler (ARC), unit isolated, disconnected and removed", "decommissionScenario": "vi"}], "electricianCompanyName": "Brunswick Electrical Services", "refrigerantHandlerName": "Daniel Rossi", "registeredPlumberPhone": "0400 111 302", "refrigerantHandlerPhone": "0400 111 301", "licencedPlumberLicenseNo": "PL-38291", "electricianCompanyAddress": "48 Sydney Road, Brunswick VIC 3056", "licencedPlumberCompanyName": "Northside Climate Solutions Pty Ltd", "refrigerantHandlerLicenseNo": "L157023", "registeredPlumberCompanyName": "Northside Climate Solutions Pty Ltd", "licencedPlumberCompanyAddress": "48 Sydney Road, Brunswick VIC 3056", "refrigerantHandlerCompanyName": "Northside Climate Solutions Pty Ltd", "registeredPlumberCompanyAddress": "48 Sydney Road, Brunswick VIC 3056", "registeredPlumberRegistrationNo": "RP-55120", "refrigerantHandlerCompanyAddress": "48 Sydney Road, Brunswick VIC 3056"}'::jsonb, date '2026-09-22', now() - interval '28 days', _asset_base, true);
  -- 3. a fresh draft (only the customer captured so far)
  perform snapshot._demo_job(northside, olivia, null, 'draft', 'Tom', 'Nguyen', '0421 663 905', 'tom.nguyen@example.com',
    '22 Elm Grove, Thornbury VIC 3071', '{}'::jsonb, null, now() - interval '1 day', _asset_base, false);
  -- 4. another company's job (invisible to Northside users)
  perform snapshot._demo_job(bayside, priya, null, 'draft', 'Grace', 'Walker', '0438 019 552', 'grace.walker@example.com',
    '3 Esplanade, Brighton VIC 3186', '{}'::jsonb, null, now() - interval '2 days', _asset_base, false);
  return 4;
end $$;
grant execute on function snapshot.fn_reset_demo(text) to authenticated;

select 'done' as result;
