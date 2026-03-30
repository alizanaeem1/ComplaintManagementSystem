-- Conversation: sender_role on complaint_responses + RLS (student / faculty reply; admin read-only in app).
-- Canonical migration (single source of truth). Run once in Supabase SQL Editor. Safe to re-run.

ALTER TABLE public.complaint_responses
ADD COLUMN IF NOT EXISTS sender_role text;

UPDATE public.complaint_responses SET sender_role = 'faculty' WHERE sender_role IS NULL;

ALTER TABLE public.complaint_responses DROP CONSTRAINT IF EXISTS complaint_responses_sender_role_check;
ALTER TABLE public.complaint_responses
ADD CONSTRAINT complaint_responses_sender_role_check CHECK (sender_role IN ('student', 'faculty', 'admin'));

ALTER TABLE public.complaint_responses ALTER COLUMN sender_role SET DEFAULT 'faculty';
ALTER TABLE public.complaint_responses ALTER COLUMN sender_role SET NOT NULL;

DROP POLICY IF EXISTS "Users can insert responses" ON public.complaint_responses;
DROP POLICY IF EXISTS "Staff and admin can insert responses" ON public.complaint_responses;

-- Students: complainant only, sender_role = student. Faculty: assigned department match, sender_role = faculty.
-- Admins: no INSERT (monitoring only in the app).
CREATE POLICY "Users can insert responses" ON public.complaint_responses FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (
        sender_role = 'student'
        AND EXISTS (
          SELECT 1 FROM public.complaints c
          WHERE c.id = complaint_id AND c.user_id = auth.uid()
        )
      )
      OR (
        sender_role = 'faculty'
        AND EXISTS (
          SELECT 1
          FROM public.profiles p
          INNER JOIN public.complaints c ON c.id = complaint_id
          WHERE p.id = auth.uid()
            AND p.role = 'staff'
            AND c.assigned_department IS NOT NULL
            AND p.department IS NOT NULL
            AND lower(trim(c.assigned_department::text)) = lower(trim(p.department::text))
        )
      )
    )
  );
