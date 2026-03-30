-- Dynamic complaint categories & assignable departments (Admin: Categories & departments).
-- PostgreSQL / Supabase (not MySQL). Run once in SQL Editor.

-- Allow any category string that exists in app-managed list (drop old enum-style check).
ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_category_check;

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT departments_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_categories_name ON public.categories (name);
CREATE INDEX IF NOT EXISTS idx_departments_name ON public.departments (name);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can read (student submit, staff filters, admin).
CREATE POLICY "Authenticated read categories"
  ON public.categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read departments"
  ON public.departments FOR SELECT TO authenticated USING (true);

-- Only admins can modify
CREATE POLICY "Admins insert categories"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins delete categories"
  ON public.categories FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins update categories"
  ON public.categories FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins insert departments"
  ON public.departments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins delete departments"
  ON public.departments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins update departments"
  ON public.departments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Optional: enable Realtime for live list updates across tabs
-- Dashboard → Database → Replication → categories, departments

-- Seed defaults (ignore if already present)
INSERT INTO public.categories (name) VALUES
  ('Academic'), ('Hostel'), ('IT'), ('Administration'), ('Other')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.departments (name) VALUES
  ('IT'), ('Academic'), ('Hostel'), ('Administration'), ('Maintenance')
ON CONFLICT (name) DO NOTHING;
