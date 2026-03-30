-- Extend notifications table for staff notifications + policies
-- After this, run trigger-staff-notifications-on-assignment.sql so assignment alerts are inserted reliably (DB trigger).
-- Supports:
-- - user_type = 'student' or 'staff'
-- - unread/read flow per staff user
-- - admin assignment notifications to staff
-- - student-triggered notifications to assigned staff (e.g., rating updates)

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_type text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Widen user_type check constraint to include staff.
alter table public.notifications drop constraint if exists notifications_user_type_check;
alter table public.notifications
  add constraint notifications_user_type_check check (user_type in ('student', 'staff'));

create index if not exists idx_notifications_user_created on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications (user_id) where is_read = false;
create index if not exists idx_notifications_complaint on public.notifications (complaint_id);

alter table public.notifications enable row level security;

-- Staff can read/update only own rows with user_type='staff'
drop policy if exists "Staff read own notifications" on public.notifications;
create policy "Staff read own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid() and user_type = 'staff');

drop policy if exists "Staff update own notifications" on public.notifications;
create policy "Staff update own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid() and user_type = 'staff')
  with check (user_id = auth.uid() and user_type = 'staff');

-- Admin can insert staff notifications when complaint is assigned to that staff's department
drop policy if exists "Admins insert staff notifications" on public.notifications;
create policy "Admins insert staff notifications"
  on public.notifications for insert to authenticated
  with check (
    user_type = 'staff'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    and exists (
      select 1
      from public.complaints c
      join public.profiles sp on sp.id = user_id and sp.role = 'staff'
      where c.id = complaint_id
        and c.assigned_department is not null
        and sp.department is not null
        and lower(trim(c.assigned_department::text)) = lower(trim(sp.department::text))
    )
  );

-- Student can insert staff notifications for their own complaint assigned department (e.g. rating ping)
drop policy if exists "Students insert staff notifications for own complaint" on public.notifications;
create policy "Students insert staff notifications for own complaint"
  on public.notifications for insert to authenticated
  with check (
    user_type = 'staff'
    and exists (
      select 1
      from public.complaints c
      join public.profiles sp on sp.id = user_id and sp.role = 'staff'
      where c.id = complaint_id
        and c.user_id = auth.uid()
        and c.assigned_department is not null
        and sp.department is not null
        and lower(trim(c.assigned_department::text)) = lower(trim(sp.department::text))
    )
  );

-- Optional realtime: enable replication for table `notifications`
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Supabase Realtime uses a publication (default: `supabase_realtime`).
-- This block keeps it safe if the publication doesn't exist in your project.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;
