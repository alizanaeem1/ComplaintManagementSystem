import { supabase } from './supabaseClient.js'
import {
  createStaffComplaintProgressNotification,
  createStaffComplaintStatusNotification
} from './adminNotifications.js'
import {
  notifyStudentComplaintAssigned,
  notifyStudentComplaintProgress,
  notifyStudentComplaintStatus
} from './studentNotifications.js'
import { notifyStaffComplaintRated } from './staffNotifications.js'
import { FALLBACK_CATEGORIES } from './addonReference.js'

const BUCKET = 'complaint-attachments'

/** @deprecated Prefer `useReferenceData().categories` (DB + fallback). Kept for legacy imports. */
export const CATEGORIES = FALLBACK_CATEGORIES
// Complaint lifecycle statuses (keep `pending` for legacy/backward compatibility with old rows/UI).
export const STATUSES = ['pending', 'submitted', 'verified', 'assigned', 'in_progress', 'resolved', 'closed']
export const PRIORITIES = ['low', 'medium', 'high']

/**
 * Fetch complaints for current user (student: own; admin: all; staff: by assigned_department)
 */
/** Get profile display names for user IDs (e.g. for admin table) */
export async function fetchProfileNames(userIds) {
  if (!supabase || !userIds?.length) return {}
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', userIds)
  const map = {}
  ;(data || []).forEach((p) => { map[p.id] = p.full_name || p.id.slice(0, 8) })
  return map
}

/**
 * Rich profile rows for admin/staff tables (name + registration / department).
 * Falls back if `registration_number` column is not migrated yet.
 */
export async function fetchProfileSummaries(userIds) {
  if (!supabase || !userIds?.length) return {}
  const selectFull = 'id, full_name, role, department, registration_number'
  let res = await supabase.from('profiles').select(selectFull).in('id', userIds)
  if (res.error && /registration_number|column|schema cache/i.test(res.error.message || '')) {
    res = await supabase.from('profiles').select('id, full_name, role, department').in('id', userIds)
  }
  const map = {}
  ;(res.data || []).forEach((p) => {
    map[p.id] = {
      full_name: p.full_name || '',
      role: p.role || 'student',
      department: p.department || '',
      registration_number: p.registration_number || ''
    }
  })
  return map
}

/** Fetch all staff profiles (admin only; requires RLS policy "Admin can view staff profiles") */
export async function fetchStaffProfiles() {
  if (!supabase) {
    return {
      data: [],
      error: { message: 'Supabase not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.' }
    }
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, department, created_at')
    .eq('role', 'staff')
    .order('department', { ascending: true })
  return { data: data || [], error }
}

/** Fetch student/staff login accounts assigned by admin (from profiles). */
export async function fetchAssignedLoginAccounts() {
  if (!supabase) {
    return {
      data: [],
      error: { message: 'Supabase not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env for live user management.' }
    }
  }
  const selectFull = 'id, role, full_name, email, department, registration_number, created_at'
  let { data, error } = await supabase
    .from('profiles')
    .select(selectFull)
    .in('role', ['student', 'staff'])
    .order('created_at', { ascending: false })
  if (error && /registration_number|column|schema cache/i.test(error.message || '')) {
    const r2 = await supabase
      .from('profiles')
      .select('id, role, full_name, email, department, created_at')
      .in('role', ['student', 'staff'])
      .order('created_at', { ascending: false })
    data = r2.data
    error = r2.error
  }
  return { data: data || [], error }
}

/** Create a student or faculty user (admin only). Calls Edge Function admin-create-user. */
export async function createUserByAdmin({ email, password, full_name, role, department, registration_number }) {
  if (!supabase) {
    return {
      error: {
        message:
          'Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env and deploy admin-create-user (see supabase/SETUP.md).'
      }
    }
  }
  try {
    // If access token is near expiry, refresh it before calling the Edge Function.
    // (Prevents "Invalid JWT" due to expired/rotated tokens.)
    if (supabase.auth?.refreshSession) await supabase.auth.refreshSession()
  } catch (_) {}
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return { error: { message: 'Not signed in.' } }

  const accessToken = typeof session.access_token === 'string' ? session.access_token.trim() : session.access_token

  const clientTokenInfo = (() => {
    try {
      const t = accessToken
      const decodePayload = () => {
        try {
          if (typeof t !== 'string') return null
          const parts = t.split('.')
          if (parts.length < 2) return null
          const payloadSeg = parts[1]
          const base64 = payloadSeg.replace(/-/g, '+').replace(/_/g, '/')
          const json = atob(base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '='))
          return JSON.parse(json)
        } catch (_) {
          return null
        }
      }

      const payload = decodePayload()
      return {
        segments: typeof t === 'string' ? t.split('.').length : null,
        length: typeof t === 'string' ? t.length : null,
        iss: payload?.iss || null,
        aud: payload?.aud || null
      }
    } catch (_) {
      return { segments: null, length: null, iss: null, aud: null }
    }
  })()
  if (typeof accessToken !== 'string' || accessToken.split('.').length < 3) {
    return { error: { message: `Invalid access token in session. Please log out/login and try again. ClientTokenInfo: segments=${clientTokenInfo.segments}, length=${clientTokenInfo.length}, iss=${clientTokenInfo.iss}, aud=${clientTokenInfo.aud}` } }
  }

  const payload = {
    email,
    password,
    full_name,
    role,
    department: role === 'staff' ? department : undefined,
    registration_number: role === 'student' ? (registration_number || '').trim() || undefined : undefined
  }

  // Use raw fetch (more predictable for CORS/auth errors).
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl) {
    return { error: { message: 'Missing VITE_SUPABASE_URL in .env' } }
  }

  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/admin-create-user`

  // Prevent UI from getting stuck: abort after timeout.
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
  } catch (e) {
    const msg = e?.name === 'AbortError'
      ? 'Request timed out. Check internet connection and Edge Function deployment.'
      : (e?.message || 'Request failed.')
    const friendly = msg.toLowerCase().includes('failed to fetch')
      ? 'Edge function call blocked (CORS/network). Deploy admin-create-user and ensure VITE_SUPABASE_URL is correct.'
      : msg
    return { error: { message: friendly } }
  } finally {
    clearTimeout(timeoutId)
  }

  const text = await res.text().catch(() => '')
  let json = {}
  try {
    json = text ? JSON.parse(text) : {}
  } catch (_) {
    json = {}
  }

  if (!res.ok) {
    if (res.status === 404) {
      return { error: { message: 'Edge Function not found (404). Deploy `admin-create-user` in Supabase Edge Functions.' } }
    }
    const bodyHint = text ? (text.length > 300 ? `${text.slice(0, 300)}...` : text) : ''
    const tokenInfoPart = json?.tokenInfo
      ? ` TokenInfo: segments=${json.tokenInfo.segments}, length=${json.tokenInfo.length}${json.tokenInfo.envSupabaseUrl ? `, envSupabaseUrl=${json.tokenInfo.envSupabaseUrl}` : ''}`
      : ''
    return {
      error: {
        message:
          (json.error || res.statusText || `Failed to create user (HTTP ${res.status}).`) +
          `${bodyHint ? ` Body: ${bodyHint}` : ''}${tokenInfoPart}`
      }
    }
  }
  return { data: json }
}

/** Call admin Edge Function with current session JWT (same pattern as create user). */
async function invokeAdminEdgeFunction(functionName, payload) {
  if (!supabase) {
    return {
      error: {
        message:
          'Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then deploy Edge Functions (see supabase/SETUP.md).'
      },
      data: null
    }
  }
  try {
    if (supabase.auth?.refreshSession) await supabase.auth.refreshSession()
  } catch (_) {}
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return { error: { message: 'Not signed in.' }, data: null }
  const accessToken = typeof session.access_token === 'string' ? session.access_token.trim() : session.access_token
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl) return { error: { message: 'Missing VITE_SUPABASE_URL in .env' }, data: null }
  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000)
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
  } catch (e) {
    clearTimeout(timeoutId)
    const msg =
      e?.name === 'AbortError'
        ? 'Request timed out. Check deployment and network.'
        : e?.message || 'Request failed.'
    const friendly = msg.toLowerCase().includes('failed to fetch')
      ? `Could not reach Edge Function \`${functionName}\`. Deploy it in Supabase (Dashboard → Edge Functions), confirm \`VITE_SUPABASE_URL\` matches your project (https://…supabase.co — no typo), then rebuild the app. If the URL is correct, check firewall/VPN/ad-blocker or try another network.`
      : msg
    return { error: { message: friendly }, data: null }
  }
  clearTimeout(timeoutId)
  const text = await res.text().catch(() => '')
  let json = {}
  try {
    json = text ? JSON.parse(text) : {}
  } catch (_) {}
  if (!res.ok) {
    if (res.status === 404) {
      return {
        error: { message: `Edge Function not found (404). Deploy \`${functionName}\` in Supabase.` },
        data: null
      }
    }
    return { error: { message: json.error || text || res.statusText || `HTTP ${res.status}` }, data: null }
  }
  return { data: json, error: null }
}

/** Update student/faculty profile + auth (email, optional password). Admin only. */
export async function updateUserByAdmin(payload) {
  return invokeAdminEdgeFunction('admin-update-user', payload)
}

/** Delete student/faculty auth user (profile cascades). Admin only. */
export async function deleteUserByAdmin(user_id) {
  return invokeAdminEdgeFunction('admin-delete-user', { user_id })
}

export async function fetchComplaints(filters = {}) {
  if (!supabase) return { data: [], error: { message: 'Demo mode: add Supabase URL and anon key to .env to load data. See README.' } }
  const { role, department } = filters
  const selectWithAnon =
    'id, user_id, is_anonymous, title, category, description, status, assigned_department, assigned_at, due_at, priority, created_at, updated_at'
  const selectWithoutAnon =
    'id, user_id, title, category, description, status, assigned_department, assigned_at, due_at, priority, created_at, updated_at'
  const selectWithAnonNoDeadline =
    'id, user_id, is_anonymous, title, category, description, status, assigned_department, priority, created_at, updated_at'
  const selectWithoutAnonNoDeadline =
    'id, user_id, title, category, description, status, assigned_department, priority, created_at, updated_at'

  const buildQuery = (selectStr) => {
    let q = supabase.from('complaints').select(selectStr).order('created_at', { ascending: false })
    if (role === 'student' && filters.userId) {
      q = q.eq('user_id', filters.userId)
    }
    if (role === 'staff' && department) {
      q = q.eq('assigned_department', department)
    }
    if (filters.status) q = q.eq('status', filters.status)
    if (filters.search) {
      q = q.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }
    return q
  }

  const selectAttempts = [selectWithAnon, selectWithoutAnon, selectWithAnonNoDeadline, selectWithoutAnonNoDeadline]
  let data = null
  let error = null
  for (const sel of selectAttempts) {
    const res = await buildQuery(sel)
    data = res.data
    error = res.error
    if (!error) break
    const msg = error.message || ''
    const retryable =
      /is_anonymous/i.test(msg) || /assigned_at|due_at|schema cache|column/i.test(msg)
    if (!retryable) break
  }

  const out = data || []
  // Backward compatibility:
  // - Student UI groups `pending` + `assigned`
  // - Admin UI overview/cards also rely on `pending`
  // Store new lifecycle as `submitted`, but display it as `pending` to keep UI functioning.
  if (role === 'student' || role === 'admin') {
    return {
      data: out.map((c) => (c?.status === 'submitted' ? { ...c, status: 'pending' } : c)),
      error
    }
  }

  return { data: out, error }
}

/**
 * Fetch single complaint with responses and attachments
 */
export async function fetchComplaintById(id) {
  if (!supabase) return { data: null, error: { message: 'Demo mode: add Supabase to .env to view details. See README.' } }
  const { data: complaint, error: e1 } = await supabase
    .from('complaints')
    .select('*')
    .eq('id', id)
    .single()
  if (e1) return { data: null, error: e1 }

  const [res, att, historyRes, ratingRes] = await Promise.all([
    supabase.from('complaint_responses').select('*').eq('complaint_id', id).order('created_at', { ascending: true }),
    supabase.from('complaint_attachments').select('*').eq('complaint_id', id).order('created_at', { ascending: true }),
    supabase
      .from('complaint_status_history')
      .select('id, complaint_id, changed_by, from_status, to_status, assigned_department, created_at')
      .eq('complaint_id', id)
      .order('created_at', { ascending: true }),
    // Graceful fallback: if table isn't migrated yet, this may error; we ignore.
    supabase
      .from('complaint_ratings')
      .select('id, complaint_id, student_id, rating, created_at, updated_at')
      .eq('complaint_id', id)
      .maybeSingle()
  ])

  const statusHistory = historyRes?.data || []
  const statusHistoryErr = historyRes?.error
  const safeStatusHistory = statusHistoryErr ? [] : statusHistory
  const rating = ratingRes?.error ? null : ratingRes?.data || null

  const actorIds = [
    ...new Set([
      ...safeStatusHistory.map((h) => h.changed_by).filter(Boolean),
      ...(res.data || []).map((r) => r.user_id).filter(Boolean)
    ])
  ]
  let actor_names = {}
  if (actorIds.length) {
    const profRes = await supabase.from('profiles').select('id, full_name, role').in('id', actorIds)
    if (!profRes.error && profRes.data?.length) {
      for (const p of profRes.data) {
        const name = (p.full_name || '').trim() || 'User'
        const suffix = p.role === 'admin' ? 'Admin' : p.role === 'staff' ? 'Faculty' : ''
        actor_names[p.id] = suffix ? `${name} (${suffix})` : name
      }
    }
  }

  // Unified chronological activity log for timeline components.
  const activity = [
    ...safeStatusHistory.map((h) => ({
      id: h.id,
      type: h.to_status === 'assigned' ? 'assignment' : 'status',
      created_at: h.created_at,
      from_status: h.from_status,
      to_status: h.to_status,
      assigned_department: h.assigned_department,
      changed_by: h.changed_by
    })),
    ...(res.data || []).map((r) => ({
      id: r.id,
      type: 'response',
      created_at: r.created_at,
      user_id: r.user_id,
      body: r.body,
      sender_role: r.sender_role
    }))
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  return {
    data: {
      ...complaint,
      responses: res.data || [],
      attachments: att.data || [],
      status_history: safeStatusHistory,
      activity,
      actor_names,
      rating
    },
    error: null
  }
}

/**
 * Student rates resolved complaint (1..5), upsert per complaint/student.
 */
export async function upsertComplaintRating({ complaintId, studentId, rating }) {
  if (!supabase) return { data: null, error: { message: 'Demo mode: rating is unavailable without Supabase.' } }
  const value = Number(rating)
  if (!complaintId || !studentId) return { data: null, error: { message: 'Missing complaint or student.' } }
  if (!Number.isFinite(value) || value < 1 || value > 5) {
    return { data: null, error: { message: 'Rating must be between 1 and 5.' } }
  }
  const payload = {
    complaint_id: complaintId,
    student_id: studentId,
    rating: Math.round(value)
  }
  const { data, error } = await supabase
    .from('complaint_ratings')
    .upsert(payload, { onConflict: 'complaint_id,student_id' })
    .select('id, complaint_id, student_id, rating, created_at, updated_at')
    .maybeSingle()

  if (error && /complaint_ratings|schema cache|Could not find the table/i.test(error.message || '')) {
    return {
      data: null,
      error: {
        message: 'Rating is not enabled in database yet. Run supabase/add-complaint-ratings.sql in Supabase SQL Editor.'
      }
    }
  }

  if (!error) {
    try {
      const { data: complaintRow } = await supabase
        .from('complaints')
        .select('assigned_department')
        .eq('id', complaintId)
        .maybeSingle()
      if (complaintRow?.assigned_department) {
        await notifyStaffComplaintRated(complaintId, complaintRow.assigned_department, payload.rating)
      }
    } catch (_) {
      /* non-critical */
    }
  }

  return { data: data || null, error: error || null }
}

/**
 * Create complaint and optionally upload files
 */
export async function createComplaint({ userId, title, category, description, priority = 'medium', files = [], isAnonymous = false }) {
  if (!supabase) return { data: null, error: { message: 'Demo mode: add Supabase to .env to view details. See README.' } }
  const insertWithAnon = { user_id: userId, is_anonymous: !!isAnonymous, status: 'submitted', title, category, description, priority }
  const insertWithoutAnon = { user_id: userId, status: 'submitted', title, category, description, priority }

  const { data: complaint, error: e1 } = await supabase.from('complaints').insert(insertWithAnon).select().single()
  if (e1) {
    // If DB migration hasn't been run yet, `is_anonymous` column might not exist.
    if (/is_anonymous/i.test(e1.message || '')) {
      const retry = await supabase.from('complaints').insert(insertWithoutAnon).select().single()
      if (retry.error) return { data: null, error: { message: `Complaints insert failed: ${retry.error.message || 'unknown error'}` } }
      // Anonymous flag won't be stored, but complaint will be created.
      if (retry.data?.status === 'submitted') {
        try {
          await supabase.from('complaint_status_history').insert({
            complaint_id: retry.data.id,
            changed_by: userId,
            from_status: null,
            to_status: 'submitted',
            assigned_department: null
          })
        } catch (_) {
          // non-critical for UI; ignore
        }
      }
      if (files.length) {
        try {
          const paths = await uploadComplaintFiles(retry.data.id, null, files)
          if (paths.length) {
            const { error: attErr } = await supabase.from('complaint_attachments').insert(
              paths.map(({ path, name, size }) => ({
                complaint_id: retry.data.id,
                file_path: path,
                file_name: name,
                file_size: size
              }))
            )
            if (attErr) return { data: null, error: { message: `Attachment metadata insert failed: ${attErr.message || 'unknown error'}` } }
          }
        } catch (uploadErr) {
          return { data: null, error: { message: `Storage upload failed: ${uploadErr?.message || 'unknown error'}` } }
        }
      }
      return { data: retry.data, error: null }
    }
    // If DB migration hasn't been run yet, `submitted` status might not be allowed.
    if (/submitted/i.test(e1.message || '') || /status/i.test(e1.message || '')) {
      const fallbackWithPendingAnon = { user_id: userId, is_anonymous: !!isAnonymous, status: 'pending', title, category, description, priority }
      const fallbackWithoutAnon = { user_id: userId, status: 'pending', title, category, description, priority }
      const { data: complaint2, error: e2 } = await supabase.from('complaints').insert(fallbackWithPendingAnon).select().single()
      if (!e2) {
        if (files.length) {
          try {
            const paths = await uploadComplaintFiles(complaint2.id, null, files)
            if (paths.length) {
              const { error: attErr } = await supabase.from('complaint_attachments').insert(
                paths.map(({ path, name, size }) => ({
                  complaint_id: complaint2.id,
                  file_path: path,
                  file_name: name,
                  file_size: size
                }))
              )
              if (attErr) return { data: null, error: { message: `Attachment metadata insert failed: ${attErr.message || 'unknown error'}` } }
            }
          } catch (uploadErr) {
            return { data: null, error: { message: `Storage upload failed: ${uploadErr?.message || 'unknown error'}` } }
          }
        }
        return { data: complaint2, error: null }
      }

      const retry = await supabase.from('complaints').insert(fallbackWithoutAnon).select().single()
      if (retry.error) return { data: null, error: { message: `Complaints fallback insert failed: ${retry.error.message || 'unknown error'}` } }
      if (files.length && retry.data?.id) {
        try {
          const paths = await uploadComplaintFiles(retry.data.id, null, files)
          if (paths.length) {
            const { error: attErr } = await supabase.from('complaint_attachments').insert(
              paths.map(({ path, name, size }) => ({
                complaint_id: retry.data.id,
                file_path: path,
                file_name: name,
                file_size: size
              }))
            )
            if (attErr) return { data: null, error: { message: `Attachment metadata insert failed: ${attErr.message || 'unknown error'}` } }
          }
        } catch (uploadErr) {
          return { data: null, error: { message: `Storage upload failed: ${uploadErr?.message || 'unknown error'}` } }
        }
      }
      return { data: retry.data, error: null }
    }
    return { data: null, error: { message: `Complaints insert failed: ${e1.message || 'unknown error'}` } }
  }

  // Initial lifecycle event: student submitted complaint.
  if (complaint?.status === 'submitted') {
    try {
      await supabase.from('complaint_status_history').insert({
        complaint_id: complaint.id,
        changed_by: userId,
        from_status: null,
        to_status: 'submitted',
        assigned_department: null
      })
    } catch (_) {
      // non-critical for UI; ignore
    }
  }

  if (files.length) {
    try {
      const paths = await uploadComplaintFiles(complaint.id, null, files)
      if (paths.length) {
        const { error: attErr } = await supabase.from('complaint_attachments').insert(
          paths.map(({ path, name, size }) => ({
            complaint_id: complaint.id,
            file_path: path,
            file_name: name,
            file_size: size
          }))
        )
        if (attErr) return { data: null, error: { message: `Attachment metadata insert failed: ${attErr.message || 'unknown error'}` } }
      }
    } catch (uploadErr) {
      return { data: null, error: { message: `Storage upload failed: ${uploadErr?.message || 'unknown error'}` } }
    }
  }
  return { data: complaint, error: null }
}

/**
 * Update complaint (status, assigned_department, category, etc.)
 */
export async function updateComplaint(id, updates) {
  if (!supabase) return { error: { message: 'Demo mode: add Supabase to .env to update. See README.' } }

  let current = null
  let currentErr = null
  /** DBs without deadline columns: never PATCH assigned_at/due_at (avoids schema cache errors). */
  let supportsDeadlineFields = true
  const curRes = await supabase
    .from('complaints')
    .select('id, user_id, status, assigned_department, assigned_at, due_at')
    .eq('id', id)
    .single()
  current = curRes.data
  currentErr = curRes.error
  if (currentErr && /assigned_at|due_at|column|schema cache/i.test(currentErr.message || '')) {
    supportsDeadlineFields = false
    const fallback = await supabase
      .from('complaints')
      .select('id, user_id, status, assigned_department')
      .eq('id', id)
      .single()
    current = fallback.data
    currentErr = fallback.error
  }
  if (currentErr) return { error: currentErr }

  const nextStatus = updates?.status
  if (nextStatus === 'closed' && current?.status !== 'resolved') {
    return { error: { message: 'Cannot close complaint before it is resolved.' } }
  }

  const patch = { ...updates, updated_at: new Date().toISOString() }
  const nextDept =
    updates.assigned_department !== undefined ? updates.assigned_department : current?.assigned_department
  const deptChanging =
    updates.assigned_department != null &&
    updates.assigned_department !== current?.assigned_department
  const becomingAssigned = nextStatus === 'assigned'
  if (supportsDeadlineFields && (becomingAssigned || deptChanging) && nextDept) {
    const now = new Date().toISOString()
    const defaultDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    if (patch.assigned_at == null) patch.assigned_at = now
    if (patch.due_at == null) patch.due_at = defaultDue
  }

  let { data: updated, error: updateErr } = await supabase
    .from('complaints')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  // If DB has no assigned_at/due_at but first select oddly succeeded, retry without them.
  if (
    updateErr &&
    /assigned_at|due_at|column|schema cache/i.test(updateErr.message || '') &&
    (patch.assigned_at != null || patch.due_at != null)
  ) {
    const { assigned_at: _a, due_at: _d, ...patchNoDeadline } = patch
    const retry = await supabase.from('complaints').update(patchNoDeadline).eq('id', id).select('*').single()
    updated = retry.data
    updateErr = retry.error
  }

  if (updateErr) return { error: updateErr, data: null }

  // Student notification when admin assigns department (staff use DB trigger — see trigger-staff-notifications-on-assignment.sql).
  if (deptChanging && updates?.assigned_department) {
    try {
      const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: null }))
      const uid = authData?.user?.id
      if (uid) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
        if (prof?.role === 'admin') {
          const studentId = updated?.user_id
          if (studentId) await notifyStudentComplaintAssigned(id, studentId, updates.assigned_department)
        }
      }
    } catch (_) {
      /* non-critical */
    }
  }

  // Write unified status history for timeline/activity log.
  if (nextStatus) {
    const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: null }))
    const changedBy = authData?.user?.id
    const assigned_department = updates?.assigned_department ?? current?.assigned_department

    if (changedBy) {
      try {
        await supabase.from('complaint_status_history').insert({
          complaint_id: id,
          changed_by: changedBy,
          from_status: current?.status,
          to_status: nextStatus,
          assigned_department
        })
      } catch (_) {
        // History is non-critical for core updates; ignore insert failures to keep UI stable.
      }
    }
  }

  // Notify admins when staff changes complaint status
  if (nextStatus && nextStatus !== current?.status) {
    try {
      const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: null }))
      const uid = authData?.user?.id
      if (uid) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
        if (prof?.role === 'staff') {
          await createStaffComplaintStatusNotification(id, nextStatus)
          const studentId = updated?.user_id
          if (studentId) {
            await notifyStudentComplaintStatus(id, studentId, nextStatus)
          }
        }
      }
    } catch (_) {
      /* non-critical */
    }
  }

  return { data: updated, error: null }
}

/**
 * Add response and optionally attach files.
 * senderRole: 'student' | 'faculty' | 'admin' — must match profiles.role (admin cannot post from app).
 */
export async function addResponse({ complaintId, userId, body, files = [], senderRole: explicitSenderRole }) {
  if (!supabase) return { data: null, error: { message: 'Demo mode: add Supabase to .env to view details. See README.' } }
  const { data: prof, error: pe } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  if (pe) return { data: null, error: pe }
  if (prof?.role === 'admin') {
    return { data: null, error: { message: 'Admins can only view this conversation.' } }
  }

  let sender_role = explicitSenderRole
  if (!sender_role) {
    if (prof?.role === 'student') sender_role = 'student'
    else if (prof?.role === 'staff') sender_role = 'faculty'
    else sender_role = 'faculty'
  }
  if (prof?.role === 'student' && sender_role !== 'student') {
    return { data: null, error: { message: 'Students can only send messages as student.' } }
  }
  if (prof?.role === 'staff' && sender_role !== 'faculty') {
    return { data: null, error: { message: 'Faculty can only send messages as faculty.' } }
  }

  const textBody = body && String(body).trim() ? String(body).trim() : '(No comment)'

  const { data: response, error: e1 } = await supabase
    .from('complaint_responses')
    .insert({ complaint_id: complaintId, user_id: userId, body: textBody, sender_role })
    .select()
    .single()
  if (e1) return { data: null, error: e1 }

  if (files.length) {
    const paths = await uploadComplaintFiles(complaintId, response.id, files)
    if (paths.length) {
      await supabase.from('complaint_attachments').insert(
        paths.map(({ path, name, size }) => ({
          complaint_id: complaintId,
          response_id: response.id,
          file_path: path,
          file_name: name,
          file_size: size
        }))
      )
    }
  }

  try {
    const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: null }))
    const uid = authData?.user?.id
    const hasRealProgress =
      (body && String(body).trim() && String(body).trim() !== '(No comment)') || (files && files.length > 0)
    if (uid && hasRealProgress) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
      if (prof?.role === 'staff') {
        await createStaffComplaintProgressNotification(complaintId)
        const { data: crow } = await supabase
          .from('complaints')
          .select('user_id')
          .eq('id', complaintId)
          .maybeSingle()
        if (crow?.user_id) {
          await notifyStudentComplaintProgress(complaintId, crow.user_id)
        }
      }
    }
  } catch (_) {
    /* non-critical */
  }

  return { data: response, error: null }
}

/**
 * Upload files to Storage bucket; return list of { path, name, size }
 */
export async function uploadComplaintFiles(complaintId, responseId, files) {
  if (!supabase || !files.length) return []
  const out = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = (file.name || '').split('.').pop() || 'bin'
    const path = `${complaintId}/${responseId || 'complaint'}_${Date.now()}_${i}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
    if (error) {
      // Surface upload failures so UI can show a meaningful message.
      throw new Error(error.message || 'Storage upload failed.')
    }
    out.push({ path, name: file.name, size: file.size })
  }
  return out
}

/**
 * Get public URL for a stored file (if bucket is public). For private bucket use createSignedUrl.
 */
export function getFileUrl(path) {
  if (!supabase) return null
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data?.publicUrl || null
}

/**
 * Get a file URL that works for both private and public buckets.
 * Tries signed URL first; falls back to public URL.
 */
export async function getFileAccessUrl(path, expiresInSeconds = 3600) {
  if (!supabase || !path) return null
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds)
    if (!error && data?.signedUrl) return data.signedUrl
  } catch (_) {
    // ignore and fallback to public URL
  }
  return getFileUrl(path)
}

/**
 * Subscribe to complaints table changes (real-time). Callback is invoked on insert/update/delete.
 */
export function subscribeComplaints(callback) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('complaints-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => callback())
    .subscribe()
  return () => supabase.removeChannel(channel)
}

/**
 * Live updates while viewing one complaint (student detail drawer, etc.).
 * Requires Supabase **Database → Replication** on: `complaints`, `complaint_responses`,
 * `complaint_status_history`, `complaint_attachments` (at minimum `complaints` for status).
 */
export function subscribeComplaintDetailUpdates(complaintId, callback) {
  if (!supabase || !complaintId) return () => {}
  const cid = String(complaintId)
  const base = { event: '*', schema: 'public' }
  const channel = supabase
    .channel(`complaint-detail-live-${cid}`)
    .on('postgres_changes', { ...base, table: 'complaints', filter: `id=eq.${cid}` }, () => callback?.())
    .on('postgres_changes', { ...base, table: 'complaint_responses', filter: `complaint_id=eq.${cid}` }, () =>
      callback?.()
    )
    .on('postgres_changes', { ...base, table: 'complaint_status_history', filter: `complaint_id=eq.${cid}` }, () =>
      callback?.()
    )
    .on('postgres_changes', { ...base, table: 'complaint_attachments', filter: `complaint_id=eq.${cid}` }, () =>
      callback?.()
    )
    .subscribe()
  return () => {
    try {
      supabase.removeChannel(channel)
    } catch (_) {}
  }
}
