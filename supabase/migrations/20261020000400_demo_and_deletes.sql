-- =============================================================================
-- Showcase support: demo data that a global admin can reset in one click,
-- plus the operations that permanently remove data (deleting draft jobs).
-- =============================================================================

alter table snapshot.installation add column if not exists is_demo boolean not null default false;

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

-- ---------- demo data ---------------------------------------------------------
create or replace function snapshot._demo_job(
  _company uuid, _creator uuid, _assignee uuid, _status text,
  _first text, _last text, _phone text, _email text, _address text,
  _form jsonb, _install_date date, _created timestamptz, _asset_base text, _with_evidence boolean)
returns uuid language plpgsql security definer set search_path = snapshot, public as $$
declare _iid uuid := gen_random_uuid(); _pid uuid := gen_random_uuid(); _cid uuid; _doc uuid; t timestamptz;
begin
  if _form ? 'installedProducts' then
    _form := _form || '{"accredittedPerson":"ASAP Rebates","priceBeforeVeec":"3500","consumerPayment":"2350","repairScope":"none"}'::jsonb;
  end if;
  insert into snapshot.premises (premises_id, company_id, full_address, premises_type, building_age_check, is_draft, created_at)
    values (_pid, _company, _address, 'residential', _first is not null, _status not in ('submitted','approved','paid') , _created);
  insert into snapshot.consumer_details (company_id, first_name, last_name, phone_number, email_address, is_draft)
    values (_company, _first, _last, _phone, _email, _status not in ('submitted','approved','paid'))
    returning consumer_id into _cid;
  insert into snapshot.installation (installation_id, company_id, user_id, activity_type, premises_id, consumer_id, status,
                                     complete, assigned_to, form_data, installation_date, created_at, is_demo,
                                     submitted_at, approved_at)
    values (_iid, _company, _creator, 'activity-6', _pid, _cid, _status, _status in ('submitted','approved','paid'),
            _assignee, coalesce(_form, '{}'::jsonb), _install_date, _created, true,
            case when _status in ('submitted','approved','paid') then _created + interval '3 days' end,
            case when _status in ('approved','paid') then _created + interval '9 days' end);
  update snapshot.job_events set created_at = _created, actor = _creator where installation_id = _iid;

  if _form ? 'installedProducts' then
    insert into snapshot.building_documents (premises_id, company_id, doc_type, file_url, file_name, doc_date, content_hash)
      values (_pid, _company, 'certificate', _asset_base || '/demo/sample-occupancy-certificate.pdf',
              'sample-occupancy-certificate.pdf', date '1998-03-12', 'demo')
      returning building_documents_id into _doc;
    insert into snapshot.installation_documents (installation_id, building_documents_id, company_id) values (_iid, _doc, _company);
    insert into snapshot.installation_history (premises_id, installation_id, company_id, is_latest) values (_pid, _iid, _company, true);
    insert into snapshot.decommissioning (installation_id, company_id, decom_scenario, brand, model, "COES_required", "VBA_required")
      select _iid, _company, d->>'decommissionScenario', d->>'brand', d->>'model', true, false
        from jsonb_array_elements(_form->'decommissionedProducts') d;
    insert into snapshot.job_events (installation_id, company_id, actor, event_type, message, created_at)
      values (_iid, _company, _assignee, 'assignment', 'Assigned to ' || (select name from snapshot.profiles where user_id = _assignee), _created + interval '1 hour');
  end if;

  if _with_evidence then
    t := (_install_date::timestamp + time '10:20') at time zone 'Australia/Melbourne';
    insert into snapshot.job_evidence (installation_id, company_id, kind, file_url, file_name, note, latitude, longitude, accuracy_m, captured_at, captured_by)
    select _iid, _company, k, _asset_base || '/demo/' || f, f, n, -37.76631 + o * 0.00002, 144.96052 + o * 0.00001, 6, t + (o || ' minutes')::interval, _assignee
      from (values ('old_unit','old-unit.jpg',null,0), ('old_unit_nameplate','old-unit-nameplate.jpg',null,2),
                   ('decommissioned_unit','decommissioned-unit.jpg',null,48), ('new_indoor_unit','new-indoor-unit.jpg',null,131),
                   ('new_outdoor_unit','new-outdoor-unit.jpg',null,134), ('new_unit_nameplate','new-unit-nameplate.jpg',null,136),
                   ('installer_signature','installer-signature.png','Daniel Rossi',150),
                   ('customer_signature','customer-signature.png', _first || ' ' || _last,152)) v(k, f, n, o);
    insert into snapshot.job_events (installation_id, company_id, actor, event_type, message, created_at)
      values (_iid, _company, _assignee, 'evidence', 'Added 6 site photos and 2 signatures', t + interval '153 minutes');
  end if;

  if _status <> 'draft' then
    insert into snapshot.job_events (installation_id, company_id, actor, event_type, from_status, to_status, created_at)
      values (_iid, _company, _assignee, 'status_change', 'draft', 'ready_for_review', _created + interval '2 days');
  end if;
  if _status in ('submitted','approved','paid') then
    insert into snapshot.job_events (installation_id, company_id, actor, event_type, from_status, to_status, created_at)
      values (_iid, _company, null, 'status_change', 'ready_for_review', 'submitted', _created + interval '3 days');
  end if;
  if _status in ('approved','paid') then
    insert into snapshot.job_events (installation_id, company_id, actor, event_type, from_status, to_status, message, created_at)
      values (_iid, _company, null, 'status_change', 'submitted', 'approved', 'VEECs created', _created + interval '9 days');
  end if;
  return _iid;
end $$;
revoke execute on function snapshot._demo_job(uuid,uuid,uuid,text,text,text,text,text,text,jsonb,date,timestamptz,text,boolean) from public, anon, authenticated;

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
