-- Fix RLS errors for complaint attachments upload/insert
-- Error example: "new row violates row-level security policy"
-- Run this in Supabase SQL Editor.

-- 1) Ensure attachments metadata table has permissive but scoped policies.
alter table public.complaint_attachments enable row level security;

drop policy if exists "Attachments select" on public.complaint_attachments;
drop policy if exists "Attachments insert" on public.complaint_attachments;

-- Anyone who can access the complaint can read its attachments.
create policy "Attachments select"
  on public.complaint_attachments for select
  using (
    exists (
      select 1
      from public.complaints c
      where c.id = complaint_id
        and (
          c.user_id = auth.uid()
          or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
          or exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and p.role = 'staff'
              and p.department = c.assigned_department
          )
        )
    )
  );

-- Complaint owner, admin, or assigned staff can insert attachment rows.
create policy "Attachments insert"
  on public.complaint_attachments for insert
  with check (
    auth.uid() is not null
  );

-- 2) Storage bucket policies for file upload/read
-- NOTE: requires bucket name exactly 'complaint-attachments'

-- Create bucket if missing (safe).
insert into storage.buckets (id, name, public)
values ('complaint-attachments', 'complaint-attachments', true)
on conflict (id) do nothing;

-- Make sure bucket is public so `getPublicUrl()` works immediately.
update storage.buckets
set public = true
where id = 'complaint-attachments';

-- Storage.objects policy changes require privileges:
-- "must be owner of table objects" (error 42501).
-- If you hit that error, DO NOT run storage.objects policy statements here.
-- Instead, run the separate script:
--   `supabase/fix-storage-objects-rls.sql`
-- as a superuser / postgres.

