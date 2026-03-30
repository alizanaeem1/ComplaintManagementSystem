-- Run in Supabase SQL Editor if admin cannot see staff on the Staff page.
-- This lets the admin role read all profiles (e.g. to list staff by department).

drop policy if exists "Admin can view all profiles" on public.profiles;
create policy "Admin can view all profiles" on public.profiles for select using (
  coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() ->> 'role') = 'admin'
);
