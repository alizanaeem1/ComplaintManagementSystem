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

## Deployment
Live Link:
https://cuiresolve.vercel.app/

## Credentials
## Admin:
faimch04@gmail.com
Fatima@123

## Faculty:
Administration Department:
aliza@gmail.com
Aliza116

Maintenance Department:
zeenat@gmail.com
zeenat

## Student:
aliraza@gmail.com
Ali@053

amina@gmail.com
Amina@117

maida@gmail.com
Maida@128

tehseen@gmail.com
Tehseen#151
