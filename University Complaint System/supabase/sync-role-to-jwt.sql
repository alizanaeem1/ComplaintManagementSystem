-- Run in Supabase SQL Editor (optional).
-- Sync auth.users.user_metadata.role with public.profiles.role for existing users.
-- This helps after changing RLS policies to rely on JWT claims.

update auth.users u
set raw_user_meta_data = jsonb_set(
  coalesce(u.raw_user_meta_data, '{}'::jsonb),
  '{role}',
  to_jsonb(p.role),
  true
)
from public.profiles p
where p.id = u.id;

