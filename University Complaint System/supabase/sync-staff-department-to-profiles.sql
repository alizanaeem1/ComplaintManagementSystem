-- Sync staff `department` in `public.profiles` from auth.users raw user_metadata.
-- Run after updating the handle_new_user trigger for existing staff accounts.
-- (Admin can see all; this script is run in SQL editor with sufficient privileges.)

update public.profiles p
set department = case
  when p.role = 'staff' then u.raw_user_meta_data->>'department'
  else null
end
from auth.users u
where u.id = p.id;

