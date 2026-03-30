-- Student in-app notifications (assignment + staff updates).
-- Run in Supabase SQL Editor after `complaints` and `profiles` exist.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type text NOT NULL DEFAULT 'student' CHECK (user_type = 'student'),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  complaint_id uuid NOT NULL REFERENCES public.complaints (id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_complaint ON public.notifications (complaint_id);

COMMENT ON TABLE public.notifications IS 'Per-user notifications (students): routing and staff updates on complaints.';

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Students: read own notifications
CREATE POLICY "Students read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND user_type = 'student');

-- Students: mark own as read (and only own rows)
CREATE POLICY "Students update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND user_type = 'student');

-- Admins: insert for the complainant on that complaint
CREATE POLICY "Admins insert student notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_type = 'student'
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.user_id = user_id
    )
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Staff: insert for student when complaint is assigned to their department
CREATE POLICY "Staff insert student notifications for assigned complaints"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_type = 'student'
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.user_id = user_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.complaints c
      JOIN public.profiles pr ON pr.id = auth.uid() AND pr.role = 'staff'
      WHERE c.id = complaint_id
        AND c.assigned_department IS NOT NULL
        AND pr.department IS NOT NULL
        AND lower(trim(c.assigned_department::text)) = lower(trim(pr.department::text))
    )
  );

-- Optional: Realtime — Dashboard → Database → Replication → enable `notifications`
