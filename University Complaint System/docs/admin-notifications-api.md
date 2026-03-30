# Admin notifications — API mapping

This app uses **Supabase** (Postgres + RLS + JS client) instead of a separate Express server. The behavior matches typical REST endpoints:

| REST (conceptual) | Implementation |
|-------------------|----------------|
| `GET /api/admin/notifications` | `fetchAdminNotificationsForCurrentAdmin()` → `select` on `admin_notifications` + read receipts for `auth.uid()` |
| `POST /api/admin/notifications` | **New complaint:** DB trigger `notify_admin_on_new_complaint` on `complaints` insert. **Staff status / progress:** `createStaffComplaintStatusNotification` / `createStaffComplaintProgressNotification` (client insert with staff RLS). |
| `PATCH /api/admin/notifications/:id/read` | `markAdminNotificationRead(id)` → `upsert` into `admin_notification_reads` |

To build an **Express** proxy, use `@supabase/supabase-js` with the **service role key** on the server only, mirror the same table operations, and forward the user JWT for admin-only routes.
