-- User administration for the Team & companies page.
--   * fn_company_users      – list a company's users with sign-in / MFA status (admins only)
--   * fn_admin_update_user  – edit name, phone, email, role, active (also blocks/unblocks sign-in)
--   * fn_admin_set_password – set a new password for a user and sign them out everywhere
--   * fn_admin_reset_mfa    – remove a user's authenticator app (lost phone)
-- Rules: global admins manage everyone; company admins manage users in their own company
-- (never global admins); nobody changes their own role or deactivates themselves.

-- profiles guard: email is a mirror of the sign-in email and only changes through
-- fn_admin_update_user; company admins can't touch global admins.
create or replace function snapshot.profiles_guard() returns trigger
language plpgsql security definer set search_path = snapshot, public as $$
begin
  if auth.uid() is null or current_setting('snapshot.via_admin_rpc', true) = 'on' then
    return new;            -- service role / SQL editor / admin RPCs below
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
       (new.is_admin <> old.is_admin or new.active <> old.active or new.is_global_admin <> old.is_global_admin) then
      raise exception 'Only an admin can change roles or activation';
    end if;
    if new.user_id = auth.uid() and (new.is_admin <> old.is_admin or new.active <> old.active) then
      raise exception 'You cannot change your own role or activation';
    end if;
  end if;
  return new;
end $$;

-- may the caller manage this user?
create or replace function snapshot._can_manage_user(_target uuid) returns boolean
language sql stable security definer set search_path = snapshot, public as $$
  select case
    when snapshot.is_global_admin() then true
    else exists (
      select 1 from snapshot.profiles t
      where t.user_id = _target
        and not t.is_global_admin
        and snapshot.is_company_admin(t.company_id)
    )
  end
$$;

create or replace function snapshot.fn_company_users(_company uuid)
returns table (
  user_id uuid, name text, email text, phone text, active boolean,
  is_admin boolean, is_global_admin boolean, created_at timestamptz,
  last_sign_in_at timestamptz, mfa_enabled boolean
)
language plpgsql stable security definer set search_path = snapshot, public as $$
begin
  if not (snapshot.is_global_admin() or snapshot.is_company_admin(_company)) then
    raise exception 'Only admins can view the user list' using errcode = '42501';
  end if;
  return query
    select p.user_id, p.name, coalesce(u.email::text, p.email), p.phone, p.active,
           p.is_admin, p.is_global_admin, p.created_at, u.last_sign_in_at,
           exists (select 1 from auth.mfa_factors f where f.user_id = p.user_id and f.status = 'verified')
    from snapshot.profiles p
    left join auth.users u on u.id = p.user_id
    where p.company_id = _company
    order by p.is_global_admin desc, p.is_admin desc, p.name;
end $$;

create or replace function snapshot.fn_admin_update_user(
  _user uuid, _name text, _phone text, _email text, _role text, _active boolean
) returns void
language plpgsql security definer set search_path = snapshot, public as $$
declare
  t snapshot.profiles;
  new_email text := lower(trim(_email));
  self boolean := _user = auth.uid();
begin
  select * into t from snapshot.profiles where user_id = _user;
  if not found then raise exception 'User not found'; end if;
  if not (self or snapshot._can_manage_user(_user)) then
    raise exception 'You do not have permission to manage this user' using errcode = '42501';
  end if;
  if _role not in ('staff', 'admin', 'global_admin') then raise exception 'Unknown role %', _role; end if;
  if _role = 'global_admin' and not snapshot.is_global_admin() then
    raise exception 'Only a global admin can grant global admin';
  end if;
  if self and (_active is distinct from t.active
               or _role is distinct from (case when t.is_global_admin then 'global_admin' when t.is_admin then 'admin' else 'staff' end)) then
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
    active = _active
  where user_id = _user;
  perform set_config('snapshot.via_admin_rpc', 'off', true);

  -- inactive users can't sign in at all, and their open sessions are revoked
  if _active is distinct from t.active then
    update auth.users set banned_until = case when _active then null else '2999-12-31'::timestamptz end where id = _user;
    if not _active then
      update auth.refresh_tokens set revoked = true, updated_at = now() where user_id = _user::text and not revoked;
      update auth.sessions set not_after = now() where user_id = _user and (not_after is null or not_after > now());
    end if;
  end if;
end $$;

create or replace function snapshot.fn_admin_set_password(_user uuid, _password text) returns void
language plpgsql security definer set search_path = snapshot, public, extensions as $$
begin
  if _user = auth.uid() then raise exception 'Change your own password in Settings'; end if;
  if not snapshot._can_manage_user(_user) then
    raise exception 'You do not have permission to manage this user' using errcode = '42501';
  end if;
  if length(_password) < 10 or _password !~ '[A-Z]' or _password !~ '[a-z]' or _password !~ '[0-9]' or _password !~ '[^A-Za-z0-9]' then
    raise exception 'Password must be at least 10 characters with upper and lower case letters, a number and a symbol';
  end if;
  update auth.users set encrypted_password = crypt(_password, gen_salt('bf')), updated_at = now() where id = _user;
  update auth.refresh_tokens set revoked = true, updated_at = now() where user_id = _user::text and not revoked;
  update auth.sessions set not_after = now() where user_id = _user and (not_after is null or not_after > now());
end $$;

create or replace function snapshot.fn_admin_reset_mfa(_user uuid) returns void
language plpgsql security definer set search_path = snapshot, public as $$
begin
  if _user = auth.uid() then raise exception 'Manage your own two-factor settings in Settings'; end if;
  if not snapshot._can_manage_user(_user) then
    raise exception 'You do not have permission to manage this user' using errcode = '42501';
  end if;
  update auth.mfa_factors set status = 'unverified', updated_at = now() where user_id = _user;
  update auth.refresh_tokens set revoked = true, updated_at = now() where user_id = _user::text and not revoked;
  update auth.sessions set not_after = now() where user_id = _user and (not_after is null or not_after > now());
end $$;

revoke execute on function snapshot._can_manage_user(uuid) from public, anon;
revoke execute on function snapshot.fn_company_users(uuid) from public, anon;
revoke execute on function snapshot.fn_admin_update_user(uuid, text, text, text, text, boolean) from public, anon;
revoke execute on function snapshot.fn_admin_set_password(uuid, text) from public, anon;
revoke execute on function snapshot.fn_admin_reset_mfa(uuid) from public, anon;
grant execute on function snapshot.fn_company_users(uuid) to authenticated;
grant execute on function snapshot.fn_admin_update_user(uuid, text, text, text, text, boolean) to authenticated;
grant execute on function snapshot.fn_admin_set_password(uuid, text) to authenticated;
grant execute on function snapshot.fn_admin_reset_mfa(uuid) to authenticated;
