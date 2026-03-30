-- Student complaint ratings (visible to student, admin, and assigned faculty)
create table if not exists public.complaint_ratings (
  id uuid primary key default uuid_generate_v4(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (complaint_id, student_id)
);

create index if not exists idx_complaint_ratings_complaint_id on public.complaint_ratings(complaint_id);
create index if not exists idx_complaint_ratings_student_id on public.complaint_ratings(student_id);

alter table public.complaint_ratings enable row level security;

-- Read: student owner, admins, or staff assigned to complaint department
drop policy if exists "Complaint ratings select" on public.complaint_ratings;
create policy "Complaint ratings select"
on public.complaint_ratings
for select
using (
  exists (
    select 1
    from public.complaints c
    where c.id = complaint_ratings.complaint_id
      and (
        c.user_id = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
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

-- Insert/update: only the owning student can rate their own complaint
drop policy if exists "Complaint ratings insert" on public.complaint_ratings;
create policy "Complaint ratings insert"
on public.complaint_ratings
for insert
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.complaints c
    where c.id = complaint_ratings.complaint_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "Complaint ratings update" on public.complaint_ratings;
create policy "Complaint ratings update"
on public.complaint_ratings
for update
using (
  student_id = auth.uid()
  and exists (
    select 1
    from public.complaints c
    where c.id = complaint_ratings.complaint_id
      and c.user_id = auth.uid()
  )
)
with check (
  student_id = auth.uid()
);

create or replace function public.set_complaint_rating_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_complaint_rating_updated_at on public.complaint_ratings;
create trigger set_complaint_rating_updated_at
before update on public.complaint_ratings
for each row execute procedure public.set_complaint_rating_updated_at();
