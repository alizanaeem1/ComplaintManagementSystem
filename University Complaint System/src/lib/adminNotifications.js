import { supabase } from './supabaseClient.js'

/**
 * List admin notifications with per-current-user is_read (from admin_notification_reads).
 */
export async function fetchAdminNotificationsForCurrentAdmin(limit = 100) {
  if (!supabase) return { data: [], error: null }

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user?.id) return { data: [], error: userErr || { message: 'Not signed in.' } }

  const adminId = userData.user.id

  const { data: rows, error } = await supabase
    .from('admin_notifications')
    .select('id, complaint_id, message, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { data: [], error }

  const { data: reads, error: readErr } = await supabase
    .from('admin_notification_reads')
    .select('notification_id')
    .eq('admin_id', adminId)

  if (readErr) return { data: [], error: readErr }

  const readSet = new Set((reads || []).map((r) => r.notification_id))
  const data = (rows || []).map((r) => ({
    ...r,
    is_read: readSet.has(r.id)
  }))

  return { data, error: null }
}

/**
 * Mark one notification as read for the current admin.
 */
export async function markAdminNotificationRead(notificationId) {
  if (!supabase) return { error: { message: 'Supabase not configured.' } }

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user?.id) return { error: userErr || { message: 'Not signed in.' } }

  const { error } = await supabase.from('admin_notification_reads').upsert(
    {
      notification_id: notificationId,
      admin_id: userData.user.id,
      read_at: new Date().toISOString()
    },
    { onConflict: 'notification_id,admin_id' }
  )

  return { error }
}

/**
 * Staff-only: insert a row when status changes (RLS allows staff INSERT).
 */
export async function createStaffComplaintStatusNotification(complaintId, newStatus) {
  if (!supabase) return { error: null }
  const idStr = String(complaintId)
  const short = idStr.length > 12 ? `${idStr.slice(0, 8)}…` : idStr
  const message = `Staff updated complaint ${short} to ${newStatus}`
  const { error } = await supabase.from('admin_notifications').insert({
    complaint_id: complaintId,
    message
  })
  return { error }
}

/**
 * Staff-only: new response / progress on a complaint.
 */
export async function createStaffComplaintProgressNotification(complaintId) {
  if (!supabase) return { error: null }
  const idStr = String(complaintId)
  const short = idStr.length > 12 ? `${idStr.slice(0, 8)}…` : idStr
  const message = `Staff added a progress update on complaint ${short}`
  const { error } = await supabase.from('admin_notifications').insert({
    complaint_id: complaintId,
    message
  })
  return { error }
}

/**
 * Realtime: new admin_notifications rows.
 */
export function subscribeAdminNotifications(onEvent) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('admin-notifications-feed')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
      () => onEvent?.()
    )
    .subscribe()
  return () => {
    try {
      supabase.removeChannel(channel)
    } catch (_) {}
  }
}
