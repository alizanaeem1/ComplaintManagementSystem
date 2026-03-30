import { supabase } from './supabaseClient.js'

function shortComplaintId(id) {
  const s = String(id ?? '')
  return s.length > 12 ? `${s.slice(0, 8)}…` : s
}

export async function insertStaffNotification({ userId, complaintId, message }) {
  if (!supabase || !userId || !complaintId || !message) return { error: null }
  const { error } = await supabase.from('notifications').insert({
    user_type: 'staff',
    user_id: userId,
    complaint_id: complaintId,
    message: String(message).slice(0, 2000),
    is_read: false
  })
  return { error }
}

function formatDueForMessage(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export async function notifyStaffComplaintAssigned(complaintId, department, dueAt = null) {
  if (!supabase || !complaintId || !department) return { error: null }

  const { data: staffRows, error: staffErr } = await supabase
    .from('profiles')
    .select('id, department')
    .eq('role', 'staff')
    .limit(200)
  if (staffErr) return { error: staffErr }

  const dept = String(department).trim().toLowerCase()
  const staffIds = (staffRows || [])
    .filter((r) => String(r.department || '').trim().toLowerCase() === dept)
    .map((r) => r.id)

  if (!staffIds.length) return { error: null }

  const short = shortComplaintId(complaintId)
  const dueLabel = formatDueForMessage(dueAt)
  const message = dueLabel
    ? `New complaint assigned: ${short}. Deadline: ${dueLabel}.`
    : `New complaint assigned: ${short}.`
  const rows = staffIds.map((uid) => ({
    user_type: 'staff',
    user_id: uid,
    complaint_id: complaintId,
    message,
    is_read: false
  }))
  const { error } = await supabase.from('notifications').insert(rows)
  return { error }
}

export async function notifyStaffComplaintRated(complaintId, department, ratingValue) {
  if (!supabase || !complaintId || !department) return { error: null }

  const { data: staffRows, error: staffErr } = await supabase
    .from('profiles')
    .select('id, department')
    .eq('role', 'staff')
    .limit(200)
  if (staffErr) return { error: staffErr }

  const dept = String(department).trim().toLowerCase()
  const staffIds = (staffRows || [])
    .filter((r) => String(r.department || '').trim().toLowerCase() === dept)
    .map((r) => r.id)

  if (!staffIds.length) return { error: null }

  const short = shortComplaintId(complaintId)
  const label = Number.isFinite(Number(ratingValue)) ? `${Math.round(Number(ratingValue))}/5` : 'new'
  const message = `A student rated complaint ${short} (${label}).`
  const rows = staffIds.map((uid) => ({
    user_type: 'staff',
    user_id: uid,
    complaint_id: complaintId,
    message,
    is_read: false
  }))
  const { error } = await supabase.from('notifications').insert(rows)
  return { error }
}

export async function fetchStaffNotificationsForCurrentUser(limit = 100) {
  if (!supabase) return { data: [], error: null }

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user?.id) return { data: [], error: userErr || { message: 'Not signed in.' } }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, complaint_id, message, is_read, created_at')
    .eq('user_id', userData.user.id)
    .eq('user_type', 'staff')
    .order('created_at', { ascending: false })
    .limit(limit)

  return { data: data || [], error }
}

export async function markStaffNotificationRead(notificationId) {
  if (!supabase) return { error: { message: 'Supabase not configured.' } }

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user?.id) return { error: userErr || { message: 'Not signed in.' } }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userData.user.id)
    .eq('user_type', 'staff')

  return { error }
}

export function countUnreadStaffNotifications(notifications) {
  return (notifications || []).filter((n) => !n.is_read).length
}

export function subscribeStaffNotifications(userId, onEvent) {
  if (!supabase || !userId) return () => {}
  const channel = supabase
    .channel(`staff-notifications-${userId}`)
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
