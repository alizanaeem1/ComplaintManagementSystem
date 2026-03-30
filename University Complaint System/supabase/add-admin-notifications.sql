-- Admin panel notifications: new student complaints + staff status updates.
-- Run in Supabase SQL Editor after complaints + profiles exist.
-- Per-admin read state via admin_notification_reads.

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints (id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON public.admin_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_complaint ON public.admin_notifications (complaint_id);

COMMENT ON TABLE public.admin_notifications IS 'In-app notifications for university admins (student submit, staff status change).';

-- Per-admin read receipts (replaces a single is_read flag for multi-admin).
CREATE TABLE IF NOT EXISTS public.admin_notification_reads (
  notification_id uuid NOT NULL REFERENCES public.admin_notifications (id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, admin_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_notification_reads_admin ON public.admin_notification_reads (admin_id);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_reads ENABLE ROW LEVEL SECURITY;

-- Admins see all notifications
CREATE POLICY "Admins can read notifications"
  ON public.admin_notifications FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Admins manage their read receipts
CREATE POLICY "Admins can read own receipts"
  ON public.admin_notification_reads FOR SELECT TO authenticated
  USING (admin_id = auth.uid());

CREATE POLICY "Admins can insert own receipts"
  ON public.admin_notification_reads FOR INSERT TO authenticated
  WITH CHECK (
    admin_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Staff can insert notifications (status-update alerts for admins)
CREATE POLICY "Staff can insert admin notifications"
  ON public.admin_notifications FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'staff')
  );

-- Realtime (optional): Dashboard → Database → Replication → enable for admin_notifications

-- Trigger: new complaint → notify admins
CREATE OR REPLACE FUNCTION public.notify_admin_on_new_complaint()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid text;
  anon boolean;
BEGIN
  anon := COALESCE(NEW.is_anonymous, false);
  IF anon THEN
    sid := 'Anonymous';
  ELSE
    SELECT COALESCE(NULLIF(TRIM(registration_number), ''), id::text)
    INTO sid
    FROM public.profiles
    WHERE id = NEW.user_id;
    sid := COALESCE(sid, NEW.user_id::text);
  END IF;

  INSERT INTO public.admin_notifications (complaint_id, message)
  VALUES (NEW.id, 'New complaint from Student ' || sid);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_admin_new_complaint ON public.complaints;
CREATE TRIGGER tr_notify_admin_new_complaint
  AFTER INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_new_complaint();
