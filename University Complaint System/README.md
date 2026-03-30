# University Complaint Management System

A fully functional **React + TailwindCSS** web app with **Supabase** backend. Three roles: **Student**, **Admin**, **Department Staff**.

## Features

- **Authentication**: Supabase email/password login, role-based access, student registration
- **Student Dashboard**: Submit complaints (title, category, description, file upload), view history, track status, real-time updates
- **Admin Dashboard**: View all complaints, assign to department, update status, filter/search, real-time updates
- **Staff Dashboard**: See assigned complaints (by department), view detail, update status, add responses, attach files, notifications count
- **UI**: Sidebar navigation, responsive header with search/notifications/profile dropdown, complaint cards, detail view with response history, tables with sorting/filtering, mobile bottom nav
- **Theme**: Primary blue (#0a47c2), light gray (#f5f6f8), dark (#101622), Public Sans, status badges (Pending=yellow, In Progress=blue, Resolved=green)

## Tech Stack

- **React 19** + **Vite 8**
- **Tailwind CSS 4**
- **React Router 7**
- **Supabase** (Auth, Database, Storage, Realtime)

## Project Structure

```
src/
  components/     # Reusable: Sidebar, Header, StatusBadge
  contexts/       # AuthContext
  hooks/          # useComplaints
  lib/
    supabaseClient.js   # Supabase client (primary)
    supabase.js         # Re-export
    complaints.js       # CRUD, subscriptions, file upload
  pages/
    Login.jsx
    StudentDashboard.jsx
    AdminDashboard.jsx
    StaffDashboard.jsx
  App.jsx
  main.jsx
supabase/
  schema.sql       # Tables, RLS, trigger
```

## Setup

### 1. Clone and install

```bash
cd "University Complaint System"
npm install
```

### 2. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the contents of `supabase/schema.sql` to create tables, RLS, and the profile trigger.
3. In **Storage**, create a bucket named `complaint-attachments` (public or private). If private, use signed URLs in app.
   - Policies: allow `authenticated` to upload and read (e.g. `bucket_id = 'complaint-attachments'` and `auth.role() = 'authenticated'`).
4. In **Authentication > URL Configuration**, add your app URL (e.g. `http://localhost:5173`) to Redirect URLs.

### 3. Environment variables

Copy `.env.example` to `.env` and set:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Get both from Supabase **Settings > API**.

### 4. Create roles (first time)

- **Admin/Staff**: Sign up as a student (or create a user in Supabase Auth), then in **Table Editor > profiles** set `role` to `admin` or `staff`. For staff, set `department` (e.g. `IT`, `Academic`, `Hostel`, `Administration`, `Maintenance`).
- **Students**: Register from the app; the trigger creates a profile with `role = 'student'`.

### 5. Run the app

```bash
npm run dev
```

Open the URL shown (e.g. `http://localhost:5173`). Sign up (student) or sign in with the role you configured.

## Demo mode (no Supabase)

If `.env` is not set, the app runs in demo mode: on the login page choose **Sign in as** (Student / Admin / Department Staff) and sign in with any email/password to open the matching dashboard with mock data.

## Deployment

### Build

```bash
npm run build
```

Output is in `dist/`.

### Deploy to Vercel / Netlify / etc.

1. Connect the repo and set **Build command**: `npm run build`, **Output directory**: `dist`.
2. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. In Supabase **Authentication > URL Configuration**, add the production URL (e.g. `https://your-app.vercel.app`) to Redirect URLs.

## Supabase details

- **profiles**: `id` (auth.users), `role`, `full_name`, `department` (for staff). Created by trigger on signup.
- **complaints**: `user_id`, `title`, `category`, `status`, `assigned_department`, `priority`, timestamps.
- **complaint_responses**: staff/admin replies; linked to complaint and optional response_id for attachments.
- **complaint_attachments**: file_path (in bucket), file_name, file_size; linked to complaint and optionally to a response.
- **Realtime**: Subscriptions on `complaints` so list views update when data changes. In Supabase **Database > Replication**, enable replication for the `complaints` table.
- **Storage**: Bucket `complaint-attachments`; paths like `{complaint_id}/{response_id|complaint}_{ts}_{i}.{ext}`.

## License

MIT
