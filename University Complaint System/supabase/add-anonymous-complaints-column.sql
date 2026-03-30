-- Adds `is_anonymous` column to public.complaints for existing databases.
-- Run in Supabase SQL editor.

alter table public.complaints
add column if not exists is_anonymous boolean not null default false;

