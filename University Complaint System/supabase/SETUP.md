# Supabase Tables Setup

**Error:** "Could not find the table 'public.complaints' in the schema cache"  
**Fix:** Create the tables by running the schema in Supabase.

## Steps

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) and select your project.

2. In the left sidebar, click **SQL Editor**.

3. Click **New query**.

4. Copy **all** the SQL from the file `schema.sql` in this folder (same folder as this SETUP.md), or copy from below.

5. Paste into the SQL Editor and click **Run** (or press Ctrl+Enter).

6. You should see "Success. No rows returned" — that means the tables and policies were created.

7. (Optional) Enable Realtime for live updates:
   - Go to **Database** → **Replication**.
   - Find the **complaints** table and turn replication **ON**.

8. Restart your app (`npm run dev`) or refresh the browser. The error should be gone.

## Production / “live” deployment (Vercel, Netlify, etc.)

So the **student portal** (My complaints, detail drawer, attachments, timeline) works on your **hosted** site, not only on localhost:

1. **Environment variables** on the host (same names as `.env`):
   - `VITE_SUPABASE_URL` — your project URL (`https://xxxxx.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY` — **anon** public key (not the service role)

2. **SQL you may still need** (run once in Supabase SQL Editor if not already applied):
   - **`add-workflow-actor-profiles-policy.sql`** — timeline shows *who* changed status / replied (RLS-safe profile reads).
   - **`fix-attachments-rls.sql`** + **`fix-storage-objects-rls.sql`** (as **postgres** if needed) — uploads and **signed / public URLs** for files in **`complaint-attachments`**.

3. **Live updates without refresh (optional):** Dashboard → **Database** → **Replication** → enable:
   - **`complaints`** (student list + dashboard counts)
   - **`complaint_responses`**, **`complaint_status_history`**, **`complaint_attachments`** — detail drawer **auto-refreshes** when staff updates the same complaint (uses `subscribeComplaintDetailUpdates` in the app).
   - Plus **`notifications`** / **`admin_notifications`** if you use those panels with Realtime.

4. Rebuild and redeploy the frontend after changing env vars (`npm run build`).

## Tables created

- **profiles** – user role and name (linked to auth)
- **complaints** – student complaints
- **complaint_responses** – staff/admin replies
- **complaint_attachments** – file references (files go in Storage bucket `complaint-attachments`)

## Storage (optional, for file uploads)

- Go to **Storage** → **New bucket** → name: `complaint-attachments`.
- Add a policy so **authenticated** users can upload and read (e.g. policy: `bucket_id = 'complaint-attachments'` and `auth.role() = 'authenticated'`).

## Admin creates users (Student / Faculty)

Only the admin assigns email and password to students and faculty; no one can sign up or change role from the login page.

1. **Deploy Edge Functions** so the admin can create, update, and delete student/faculty accounts from the app:
   - Install Supabase CLI: `npm i -g supabase`
   - Log in: `supabase login`
   - Link project: `supabase link --project-ref YOUR_REF`
   - Deploy (each uses `--no-verify-jwt` like `admin-create-user`; `config.toml` in each folder sets `verify_jwt = false`):
     - `supabase functions deploy admin-create-user --no-verify-jwt`
     - `supabase functions deploy admin-update-user --no-verify-jwt`
     - `supabase functions deploy admin-delete-user --no-verify-jwt`
   - In Dashboard → **Project Settings** → **Edge Functions**, ensure env includes `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (or `SERVICE_ROLE_KEY`).

2. **In the app:** Admin → **Config** → **Add User** to create accounts. Below that, use the **Students** and **Faculty** tables to **Edit** (name, email, registration number / department, optional new password) or **Delete** users. **Export students (CSV)** / **Export faculty (CSV)** download lists separately. Admin → **Reports** has analytics and exports.

3. **If your database was created before registration numbers:** run **`add-student-registration-number.sql`** once in the SQL Editor (adds `profiles.registration_number` and updates the signup trigger).

4. **So faculty can see student registration on assigned complaints:** run **`add-staff-view-complainant-profiles.sql`** once (RLS: staff may read complainant profiles only when that student has a complaint assigned to the staff member’s department).

5. **So “Assigned by (name)” works in complaint details:** run **`add-workflow-actor-profiles-policy.sql`** once (RLS: students and faculty can read `profiles` only for users who appear on that complaint’s status history or responses).

6. **Alternative (no Edge Function):** Create users in Supabase Dashboard → **Authentication** → **Users** → **Add user**. Then in **SQL Editor** run:
   ```sql
   insert into public.profiles (id, role, full_name, department, registration_number)
   values ('USER_UUID_HERE', 'student', 'Full Name', null, 'FA24-BCS-001');
   -- or role = 'staff', department = 'IT', registration_number = null
   ```

## Admin in-app notifications

1. Run **`add-admin-notifications.sql`** once in the SQL Editor. It creates:
   - **`admin_notifications`** — `id`, `complaint_id`, `message`, `created_at`
   - **`admin_notification_reads`** — per-admin read state (so each admin has their own “read” flag in the UI)
   - **RLS** — admins read notifications; staff can insert rows (status/progress alerts); admins insert read receipts
   - **Trigger** — on each new row in **`complaints`**, inserts *“New complaint from Student …”* (registration number when present, else user id; anonymous → “Anonymous”)

2. **Staff alerts** are created in the app when faculty **changes status** or adds a **response / attachment** (`complaints.js`).

3. **Admin UI** — bell opens the notifications panel; unread rows are highlighted; opening a row marks it read for the signed-in admin and opens the complaint drawer.

4. **Realtime (optional):** Dashboard → **Database** → **Replication** → enable **`admin_notifications`** so the admin list updates without refresh.

## Student in-app notifications

1. Run **`add-student-notifications.sql`** once in the SQL Editor. It creates:
   - **`notifications`** — `id`, `user_type` (`'student'`), `user_id`, `complaint_id`, `message`, `is_read`, `created_at`
   - **RLS** — students **SELECT** / **UPDATE** (mark read) their own rows; **INSERT** allowed for **admins** (assignment to a department) and **staff** (for complaints assigned to their department, for status/progress messages)

2. **Triggers in the app** (`complaints.js`):
   - When an **admin** changes **`assigned_department`**, the complainant gets: *Your complaint … has been assigned to staff …*
   - When **staff** changes **status**, the student gets: *Staff updated your complaint … to …*
   - When **staff** adds a **response or attachment**, the student gets a **progress** line.

3. **Student UI** — header bell and **Sidebar → Notifications**; unread rows use a violet highlight; opening a row marks it read and filters **My complaints** to that complaint id.

4. **Realtime (optional):** enable replication on **`notifications`** so the student list updates without refresh.

5. **Note:** There is no Express server in this repo; see **`docs/admin-notifications-api.md`** for how this maps to REST-style operations.

## Admin: Categories & departments (Postgres / Supabase)

Complaint **categories** and **departments** are stored in **`public.categories`** and **`public.departments`** (not MySQL). The admin **Categories & departments** page lists, adds, edits, and deletes rows; RLS allows all authenticated users to read names, and **only admins** to insert, update, or delete.

1. Run **`add-addon-categories-departments.sql`** once in the SQL Editor (creates tables, policies, and seeds defaults). New installs include **UPDATE** policies for admins.
2. If you ran an **older** version of that script without admin **UPDATE**, run **`patch-categories-departments-admin-update.sql`** once so **Edit** works in the app.
3. The React app loads merged lists via Supabase (`ReferenceDataContext`).

## Staff panel: deadlines & penalty points

If you already ran `schema.sql` before these features were added, run **`staff-panel-deadlines.sql`** once in the SQL Editor. It adds:

- `complaints.assigned_at` / `complaints.due_at` — set automatically when admin assigns a department (default **7-day** SLA).
- `profiles.penalty_points` — incremented in the app when staff marks a complaint **resolved after** the deadline.

New installs: these columns are included in `schema.sql`.
