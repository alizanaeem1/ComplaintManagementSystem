import { supabase } from './supabaseClient.js'

export function shortComplaintIdForMessage(id) {
  const s = String(id ?? '')
  return s.length > 12 ? `${s.slice(0, 8)}…` : s
}

/**
 * Insert a row (RLS: admin or staff for that complaint’s student).
 */
export async function insertStudentNotification({ userId, complaintId, message }) {
  if (!supabase || !userId || !complaintId || !message) return { error: null }
  const { error } = await supabase.from('notifications').insert({
    user_type: 'student',
    user_id: userId,
    complaint_id: complaintId,
    message: String(message).slice(0, 2000),
    is_read: false
  })
  return { error }
}

async function pickStaffRepresentativeName(department) {
  if (!supabase || !department?.trim()) return null
  const d = department.trim().toLowerCase()
  const { data: rows, error } = await supabase
    .from('profiles')
    .select('full_name, department')
    .eq('role', 'staff')
    .limit(80)
  if (error || !rows?.length) return null
  const match = rows.find(
    (r) => r.department && String(r.department).trim().toLowerCase() === d
  )
  return match?.full_name?.trim() || null
}

/** After admin assigns a department to the complaint */
export async function notifyStudentComplaintAssigned(complaintId, studentUserId, department) {
  if (!supabase || !studentUserId || !complaintId || !department) return { error: null }
  const short = shortComplaintIdForMessage(complaintId)
  const name = await pickStaffRepresentativeName(department)
  const message = name
    ? `Your complaint ${short} has been assigned to staff ${name}.`
    : `Your complaint ${short} has been assigned to staff (${department} department).`
  return insertStudentNotification({ userId: studentUserId, complaintId, message })
}

/** After staff changes complaint status */
export async function notifyStudentComplaintStatus(complaintId, studentUserId, status) {
  if (!supabase || !studentUserId || !complaintId || !status) return { error: null }
  const short = shortComplaintIdForMessage(complaintId)
  const label = String(status).replace(/_/g, ' ')
  const message = `Staff updated your complaint ${short} to ${label}.`
  return insertStudentNotification({ userId: studentUserId, complaintId, message })
}

/** After staff adds a response / attachment (progress) */
export async function notifyStudentComplaintProgress(complaintId, studentUserId) {
  if (!supabase || !studentUserId || !complaintId) return { error: null }
  const short = shortComplaintIdForMessage(complaintId)
  const message = `Staff updated your complaint ${short} with a progress update.`
  return insertStudentNotification({ userId: studentUserId, complaintId, message })
}

export async function fetchStudentNotificationsForCurrentUser(limit = 100) {
  if (!supabase) return { data: [], error: null }

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user?.id) return { data: [], error: userErr || { message: 'Not signed in.' } }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, complaint_id, message, is_read, created_at')
    .eq('user_id', userData.user.id)
    .eq('user_type', 'student')
    .order('created_at', { ascending: false })
    .limit(limit)

  return { data: data || [], error }
}

export async function markStudentNotificationRead(notificationId) {
  if (!supabase) return { error: { message: 'Supabase not configured.' } }

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user?.id) return { error: userErr || { message: 'Not signed in.' } }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userData.user.id)

  return { error }
}

export function countUnreadStudentNotifications(notifications) {
  return (notifications || []).filter((n) => !n.is_read).length
}

/**
 * Realtime: new/updated notifications for this user (enable replication on `notifications` in Supabase).
 */
export function subscribeStudentNotifications(userId, onEvent) {
  if (!supabase || !userId) return () => {}
  const channel = supabase
    .channel(`student-notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      () => onEvent?.()
    )
    .subscribe()
  return () => {
    try {
      supabase.removeChannel(channel)
    } catch (_) {}
  }
}
