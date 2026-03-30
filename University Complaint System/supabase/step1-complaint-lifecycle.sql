-- STEP 1: Complaint lifecycle + unified activity log
-- Run this SQL in Supabase SQL Editor AFTER your existing setup.

-- 1) Expand complaint status values (keep `pending` for legacy/backward compatibility)
alter table public.complaints
  alter column status set default 'submitted';

-- Drop the old unnamed/auto-generated check constraint if it exists.
-- (Constraint names can differ between projects; this covers the common default name.)
alter table public.complaints
  drop constraint if exists complaints_status_check;

alter table public.complaints
  add constraint complaints_status_check
  check (status in ('pending', 'submitted', 'verified', 'assigned', 'in_progress', 'resolved', 'closed'));

-- 2) Complaint status history table (timeline source)
create table if not exists public.complaint_status_history (
  id uuid primary key default uuid_generate_v4(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  changed_by uuid not null references auth.users(id) on delete cascade,
  from_status text,
  to_status text not null,
  assigned_department text,
  created_at timestamptz default now()
);

create index if not exists idx_complaint_status_history_complaint_id_created_at
  on public.complaint_status_history(complaint_id, created_at);

-- 3) RLS
alter table public.complaint_status_history enable row level security;

drop policy if exists "Users can view complaint status history they can access" on public.complaint_status_history;
drop policy if exists "Admin and staff can insert complaint status history" on public.complaint_status_history;
drop policy if exists "Admin/staff/student can insert complaint status history" on public.complaint_status_history;

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

