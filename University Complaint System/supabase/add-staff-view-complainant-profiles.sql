-- Allow faculty (staff) to read complainant profiles for complaints routed to their department
-- so the portal can show registration number / name without exposing all students.

drop policy if exists "Staff can view complainants in assigned department" on public.profiles;

create policy "Staff can view complainants in assigned department" on public.profiles
  for select
  using (
    exists (
      select 1
      from public.complaints c
      inner join public.profiles staff on staff.id = auth.uid() and staff.role = 'staff'
      where c.user_id = profiles.id
        and c.assigned_department is not null
        and c.assigned_department = staff.department
    )
  );
