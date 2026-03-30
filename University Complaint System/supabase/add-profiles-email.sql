-- Add email column in profiles and backfill from auth.users.
-- Run this once if your project already has existing profiles table.

alter table if exists public.profiles
add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');

