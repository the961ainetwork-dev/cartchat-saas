-- Migration 002 — add email to profiles (needed by the admin panel).
-- Run this ONLY if you already ran the original db/schema.sql.
-- Fresh installs: just run db/schema.sql (it now includes this).

alter table public.profiles add column if not exists email text;

-- Updated trigger: also copy the email on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, store, phone, platform, country)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'store',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'platform',
    new.raw_user_meta_data->>'country'
  );
  return new;
end $$;

-- Backfill emails for any users created before this migration.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;
