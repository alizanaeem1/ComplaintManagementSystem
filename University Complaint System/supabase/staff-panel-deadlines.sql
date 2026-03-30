-- Staff panel: deadlines + performance (run once in Supabase SQL Editor)

-- When admin assigns a department, app sets assigned_at / due_at (7-day default SLA).

alter table if exists public.complaints
  add column if not exists assigned_at timestamptz;

alter table if exists public.complaints
  add column if not exists due_at timestamptz;

alter table if exists public.profiles
  add column if not exists penalty_points integer not null default 0;

comment on column public.complaints.assigned_at is 'When complaint was assigned to a department.';
comment on column public.complaints.due_at is 'Staff SLA deadline (e.g. set on assignment).';
comment on column public.profiles.penalty_points is 'Accumulated penalty points for late resolutions (staff).';
