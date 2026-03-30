-- Let students and faculty read only the name/role of users who appear on their complaint's
-- workflow (status history + responses), so "Assigned by …" can load without exposing all profiles.

drop policy if exists "View workflow actors on accessible complaints" on public.profiles;

create policy "View workflow actors on accessible complaints" on public.profiles
  for select
  using (
    exists (
      select 1
      from public.complaint_status_history h
      inner join public.complaints c on c.id = h.complaint_id
      where h.changed_by = profiles.id
        and (
          c.user_id = auth.uid()
          or exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
          or exists (
            select 1 from public.profiles me
            where me.id = auth.uid()
              and me.role = 'staff'
              and me.department is not null
              and c.assigned_department = me.department
          )
        )
    )
    or exists (
      select 1
      from public.complaint_responses r
      inner join public.complaints c on c.id = r.complaint_id
      where r.user_id = profiles.id
        and (
          c.user_id = auth.uid()
          or exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
          or exists (
            select 1 from public.profiles me
            where me.id = auth.uid()
              and me.role = 'staff'
              and me.department is not null
              and c.assigned_department = me.department
          )
        )
    )
  );
