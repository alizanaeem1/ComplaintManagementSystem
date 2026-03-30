-- Run this in Supabase SQL Editor to enforce: only one admin; students unlimited.
-- (If you already ran schema.sql, re-run this to update the trigger.)

create or replace function public.handle_new_user()
returns trigger as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
  final_role text := requested_role;
  requested_department text := new.raw_user_meta_data->>'department';
begin
  if requested_role = 'admin' and exists (select 1 from public.profiles where role = 'admin') then
    final_role := 'student';
  end if;
  insert into public.profiles (id, role, full_name, email, department)
  values (
    new.id,
    final_role,
    new.raw_user_meta_data->>'full_name',
    new.email,
    case when final_role = 'staff' then requested_department else null end
  );

  -- Keep the role in JWT (user_metadata) in sync, so policies can rely on JWT
  update auth.users
  set raw_user_meta_data = jsonb_set(
    coalesce(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(final_role),
    true
  )
  where id = new.id;

  return new;
end;
$$ language plpgsql security definer;
