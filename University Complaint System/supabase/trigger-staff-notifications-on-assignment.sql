-- Faculty/staff in-app notifications when a complaint is assigned to a department.
-- Run in Supabase SQL Editor AFTER add-staff-notifications.sql.
--
-- Why: client-side inserts from the admin browser can fail silently (RLS / role checks).
-- This uses SECURITY DEFINER (same pattern as add-admin-notifications.sql) so rows are
-- inserted reliably for every staff user whose profile.department matches complaints.assigned_department.

CREATE OR REPLACE FUNCTION public.notify_staff_on_complaint_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg text;
  short_id text;
  due_text text;
BEGIN
  IF NEW.assigned_department IS NULL OR BTRIM(NEW.assigned_department::text) = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_department IS NOT DISTINCT FROM OLD.assigned_department THEN
      RETURN NEW;
    END IF;
  END IF;

  short_id := CASE
    WHEN length(NEW.id::text) > 12 THEN substring(NEW.id::text from 1 for 8) || '…'
    ELSE NEW.id::text
  END;

  -- Do not use NEW.due_at directly: some DBs never ran staff-panel-deadlines.sql and have no due_at column.
  -- to_jsonb(NEW) only includes existing columns, so this stays safe.
  due_text := to_jsonb(NEW)->>'due_at';
  IF due_text IS NOT NULL AND BTRIM(due_text) <> '' THEN
    BEGIN
      msg := 'New complaint assigned: ' || short_id || '. Deadline: ' ||
        to_char(due_text::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC.';
    EXCEPTION WHEN OTHERS THEN
      msg := 'New complaint assigned: ' || short_id || '.';
    END;
  ELSE
    msg := 'New complaint assigned: ' || short_id || '.';
  END IF;

  INSERT INTO public.notifications (user_type, user_id, complaint_id, message, is_read)
  SELECT
    'staff',
    sp.id,
    NEW.id,
    msg,
    false
  FROM public.profiles sp
  WHERE sp.role = 'staff'
    AND sp.department IS NOT NULL
    AND lower(trim(sp.department::text)) = lower(trim(NEW.assigned_department::text));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_staff_complaint_assignment ON public.complaints;
CREATE TRIGGER tr_notify_staff_complaint_assignment
  AFTER INSERT OR UPDATE OF assigned_department ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_staff_on_complaint_assignment();
