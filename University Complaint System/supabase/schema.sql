-- University Complaint Management System - Supabase Schema
-- Run this in Supabase SQL Editor after creating your project.
-- Enable Realtime: Database > Replication > enable for table "complaints".

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles: extended user data and role (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'admin', 'staff')),
  full_name text,
  email text,
  department text,  -- for staff: e.g. 'IT', 'Academic', 'Hostel'
  registration_number text,  -- for students: university reg / roll no. (disambiguate same names)
  penalty_points integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Complaints
create table if not exists public.complaints (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- When true, staff/admin should not see the student's identity in UI.
  -- We still store `user_id` for ownership & access controls.
  is_anonymous boolean not null default false,
  title text not null,
  category text not null check (category in ('Academic', 'Hostel', 'IT', 'Administration', 'Other')),
  description text not null,
  status text not null default 'submitted' check (status in ('pending', 'submitted', 'verified', 'assigned', 'in_progress', 'resolved', 'closed')),
  assigned_department text,
  assigned_at timestamptz,
  due_at timestamptz,
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Complaint status/activity history (timeline source).
-- Note: assignment events are derived from status transitions to `assigned`.
create table if not exists public.complaint_status_history (
  id uuid primary key default uuid_generate_v4(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  changed_by uuid not null references auth.users(id) on delete cascade,
  from_status text,
  to_status text not null,
  assigned_department text,
  created_at timestamptz default now()
);

-- Responses (staff/admin replies on a complaint)
create table if not exists public.complaint_responses (
  id uuid primary key default uuid_generate_v4(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null default 'faculty' check (sender_role in ('student', 'faculty', 'admin')),
  body text not null,
  created_at timestamptz default now()
);

-- Attachments metadata (files stored in Storage bucket 'complaint-attachments')
create table if not exists public.complaint_attachments (
  id uuid primary key default uuid_generate_v4(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  response_id uuid references public.complaint_responses(id) on delete set null,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_complaints_user_id on public.complaints(user_id);
create index if not exists idx_complaints_status on public.complaints(status);
create index if not exists idx_complaints_assigned_department on public.complaints(assigned_department);
create index if not exists idx_complaint_status_history_complaint_id_created_at on public.complaint_status_history(complaint_id, created_at);
create index if not exists idx_complaint_responses_complaint_id on public.complaint_responses(complaint_id);
create index if not exists idx_complaint_attachments_complaint_id on public.complaint_attachments(complaint_id);

-- RLS
alter table public.profiles enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_status_history enable row level security;
alter table public.complaint_responses enable row level security;
alter table public.complaint_attachments enable row level security;

-- Profiles: users can read/update own profile; admin can view all (e.g. to list staff)
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Admin can view all profiles" on public.profiles for select using (
  coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() ->> 'role') = 'admin'
);
-- Staff: read complainant profile only when that student has a complaint assigned to staff's department
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
-- Names of admins/staff who updated status or responded (for "Assigned by" on complaint detail)
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
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Complaints: students see own; admin sees all; staff see assigned to their department
create policy "Students can view own complaints" on public.complaints for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'staff' and p.department = complaints.assigned_department)
  );
create policy "Students can insert complaints" on public.complaints for insert
  with check (auth.uid() = user_id);
create policy "Admin and staff can update complaints" on public.complaints for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff'))
  );
create policy "Admin can do all" on public.complaints for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Complaint status history (timeline events)
create policy "Users can view complaint status history they can access" on public.complaint_status_history for select
  using (
    exists (
      select 1
      from public.complaints c
      where c.id = complaint_status_history.complaint_id
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

create policy "Admin/staff/student can insert complaint status history" on public.complaint_status_history for insert
  with check (
    changed_by = auth.uid()
    and (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'staff'
          and p.department = (
            select c.assigned_department from public.complaints c where c.id = complaint_status_history.complaint_id
          )
      )
      or (
        exists (
          select 1
          from public.complaints c
          where c.id = complaint_status_history.complaint_id
            and c.user_id = auth.uid()
        )
        and to_status = 'submitted'
      )
    )
  );

-- Responses: readable by anyone who can read the complaint; insert by staff/admin
create policy "Responses select" on public.complaint_responses for select using (
  exists (select 1 from public.complaints c where c.id = complaint_id and (
    c.user_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'staff' and p.department = c.assigned_department)
  ))
);
create policy "Users can insert responses" on public.complaint_responses for insert
  with check (
    auth.uid() = user_id
    and (
      (
        sender_role = 'student'
        and exists (select 1 from public.complaints c where c.id = complaint_id and c.user_id = auth.uid())
      )
      or (
        sender_role = 'faculty'
        and exists (
          select 1
          from public.profiles p
          inner join public.complaints c on c.id = complaint_id
          where p.id = auth.uid()
            and p.role = 'staff'
            and c.assigned_department is not null
            and p.department is not null
            and lower(trim(c.assigned_department::text)) = lower(trim(p.department::text))
        )
      )
    )
  );

-- Attachments: same as complaints for select; insert by complaint owner or staff/admin
create policy "Attachments select" on public.complaint_attachments for select using (
  exists (select 1 from public.complaints c where c.id = complaint_id and (
    c.user_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'staff' and p.department = c.assigned_department)
  ))
);
create policy "Attachments insert" on public.complaint_attachments for insert
  with check (auth.uid() is not null);

-- Trigger: create profile on signup (only one admin allowed; further admin signups become students)
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
  insert into public.profiles (id, role, full_name, email, department, registration_number)
  values (
    new.id,
    final_role,
    new.raw_user_meta_data->>'full_name',
    new.email,
    case when final_role = 'staff' then requested_department else null end,
    case when final_role = 'student' then nullif(trim(new.raw_user_meta_data->>'registration_number'), '') else null end
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Storage bucket (run in Dashboard or via API): create bucket 'complaint-attachments' (public or private with signed URLs).
-- Policy: authenticated users can upload/list/read in complaint-attachments.
-- Example policy for storage.objects:
-- (bucket_id = 'complaint-attachments' and auth.role() = 'authenticated')
