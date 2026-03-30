-- Student registration number (unique ID on campus) for admin/staff to tell same-name students apart.
-- Faculty continues to use `department` on profiles.

alter table public.profiles
  add column if not exists registration_number text;

comment on column public.profiles.registration_number is 'University registration / roll number (students). Shown to admin and staff next to name.';

-- Recreate signup trigger to copy registration_number from auth metadata for new students.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
  final_role text := requested_role;
  requested_department text := new.raw_user_meta_data->>'department';
  requested_reg text := nullif(trim(new.raw_user_meta_data->>'registration_number'), '');
begin
  if requested_role = 'admin' and exists (select 1 from public.profiles where role = 'admin') then
    final_role := 'student';
  end if;
  insert into public.profiles (id, role, full_name, email, department, registration_number)
  values (
    new.id,
    final_role,
    new.raw_user_meta_data->>'full_name',
    new.email,
    case when final_role = 'staff' then requested_department else null end,
    case when final_role = 'student' then requested_reg else null end
  );

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
