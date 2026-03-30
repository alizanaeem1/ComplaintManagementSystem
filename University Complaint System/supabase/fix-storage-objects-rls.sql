-- Fix storage.objects RLS for file upload
-- REQUIRED: Run as a role that is owner/superuser of storage.objects.
-- Otherwise you'll get: "must be owner of table objects" (SQLSTATE 42501).
--
-- In Supabase Dashboard SQL Editor:
--  - Choose "Run as" => postgres (if available) OR use a privileged role.

-- This bucket must exist and can be public.
insert into storage.buckets (id, name, public)
values ('complaint-attachments', 'complaint-attachments', true)
on conflict (id) do nothing;

update storage.buckets
set public = true
where id = 'complaint-attachments';

-- Enable RLS explicitly.
alter table storage.objects enable row level security;

-- Drop old policies by common names (safe if they don't exist).
drop policy if exists "Authenticated users can upload complaint files" on storage.objects;
drop policy if exists "Authenticated users can read complaint files" on storage.objects;
drop policy if exists "Authenticated users can update own complaint files" on storage.objects;
drop policy if exists "Authenticated users can delete own complaint files" on storage.objects;

-- Upload policy: allow authenticated users to insert into this bucket.
create policy "Authenticated users can upload complaint files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'complaint-attachments');

-- Read policy: allow authenticated users to read from this bucket.
create policy "Authenticated users can read complaint files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'complaint-attachments');

-- Update/delete owner-scoped (optional safety).
create policy "Authenticated users can update own complaint files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'complaint-attachments' and owner = auth.uid())
  with check (bucket_id = 'complaint-attachments' and owner = auth.uid());

create policy "Authenticated users can delete own complaint files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'complaint-attachments' and owner = auth.uid());

