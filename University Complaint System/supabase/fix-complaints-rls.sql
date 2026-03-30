-- Fix: "new row violates row-level security policy for table complaints"
-- Run this in Supabase SQL Editor after the main schema.

-- 1. Drop existing policies on complaints so we can recreate them correctly
drop policy if exists "Students can view own complaints" on public.complaints;
drop policy if exists "Students can insert complaints" on public.complaints;
drop policy if exists "Admin and staff can update complaints" on public.complaints;
drop policy if exists "Admin can do all" on public.complaints;

-- 2. SELECT: students see own; admin sees all; staff see assigned to their department
create policy "Students can view own complaints"
  on public.complaints for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'staff' and p.department = complaints.assigned_department)
  );

-- 3. INSERT: only when the new row's user_id is the current user (students submit for themselves)
create policy "Users can insert own complaints"
  on public.complaints for insert
  with check (auth.uid() = user_id);

-- 4. UPDATE: admin and staff can update
create policy "Admin and staff can update complaints"
  on public.complaints for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff'))
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff'))
  );

-- 5. Admin can do everything (select/insert/update/delete) with explicit USING and WITH CHECK
create policy "Admin full access complaints"
  on public.complaints for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));