/** Staff panel: deadlines, display status, sorting */

export const STAFF_PENDING_STATUSES = ['pending', 'submitted', 'verified', 'assigned']

export function isResolvedLike(c) {
  return c?.status === 'resolved' || c?.status === 'closed'
}

export function isComplaintOverdue(c) {
  if (!c?.due_at || isResolvedLike(c)) return false
  return Date.now() > new Date(c.due_at).getTime()
}

/** UI label: Pending | In Progress | Overdue | Resolved */
export function getStaffDisplayStatus(c) {
  if (isResolvedLike(c)) return 'Resolved'
  if (isComplaintOverdue(c)) return 'Overdue'
  if (c?.status === 'in_progress') return 'In Progress'
  if (STAFF_PENDING_STATUSES.includes(c?.status)) return 'Pending'
  return 'Pending'
}

export function formatCountdown(dueAt) {
  if (!dueAt) return '—'
  const end = new Date(dueAt).getTime()
  const now = Date.now()
  const diff = end - now
  if (diff <= 0) return 'Overdue'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

export function sortStaffComplaints(list, sortBy) {
  const arr = [...(list || [])]
  const ts = (iso) => (iso ? new Date(iso).getTime() : 0)
  if (sortBy === 'deadline') {
    arr.sort((a, b) => {
      const da = ts(a.due_at) || Number.MAX_SAFE_INTEGER
      const db = ts(b.due_at) || Number.MAX_SAFE_INTEGER
      return da - db
    })
  } else if (sortBy === 'assigned') {
    arr.sort((a, b) => ts(b.assigned_at) - ts(a.assigned_at))
  } else {
    arr.sort((a, b) => ts(b.created_at) - ts(a.created_at))
  }
  return arr
}

/** Resolved before/on due_at => on-time (due_at missing counts as on-time) */
export function computeOnTimeRate(resolvedComplaints) {
  const list = resolvedComplaints || []
  if (!list.length) return 100
  let onTime = 0
  for (const c of list) {
    if (!c.due_at) {
      onTime += 1
      continue
    }
    const due = new Date(c.due_at).getTime()
    const done = c.updated_at ? new Date(c.updated_at).getTime() : 0
    if (done && done <= due) onTime += 1
  }
  return Math.round((onTime / list.length) * 100)
}

export function weeklyResolvedCounts(resolvedComplaints, weeks = 8) {
  const now = new Date()
  const buckets = []
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const start = new Date(now)
    start.setDate(start.getDate() - (w + 1) * 7)
    const end = new Date(now)
    end.setDate(end.getDate() - w * 7)
    const label = `${start.getMonth() + 1}/${start.getDate()}`
    let count = 0
    for (const c of resolvedComplaints || []) {
      const t = c.updated_at ? new Date(c.updated_at).getTime() : 0
      if (t >= start.getTime() && t < end.getTime()) count += 1
    }
    buckets.push({ label, count })
  }
  return buckets
}

export function monthlyResolvedCounts(resolvedComplaints, months = 6) {
  const now = new Date()
  const buckets = []
  for (let m = months - 1; m >= 0; m -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1)
    const label = d.toLocaleString(undefined, { month: 'short', year: '2-digit' })
    let count = 0
    for (const c of resolvedComplaints || []) {
      if (!c.updated_at) continue
      const t = new Date(c.updated_at)
      if (t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth()) count += 1
    }
    buckets.push({ label, count })
  }
  return buckets
}
