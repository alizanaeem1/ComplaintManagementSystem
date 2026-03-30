import { useState, useEffect, useCallback, useMemo } from 'react'
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AdminComplaintDrawer } from '../components/AdminComplaintDrawer.jsx'
import { AdminSidebar } from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'
import { Header } from '../components/Header'
import { ProfilePageLayout } from '../components/ProfilePageLayout.jsx'
import { StatusBadge } from '../components/StatusBadge'
import {
  fetchComplaints,
  fetchProfileSummaries,
  fetchStaffProfiles,
  fetchAssignedLoginAccounts,
  createUserByAdmin,
  updateUserByAdmin,
  deleteUserByAdmin,
  updateComplaint,
  fetchComplaintById,
  getFileAccessUrl,
  getFileUrl,
  subscribeComplaints
} from '../lib/complaints.js'
import {
  getProfileDisplayName,
  getProfileSecondaryLabel,
  formatProfileForAdminDrawer
} from '../lib/profileDisplay.js'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabaseClient.js'
import {
  fetchAdminNotificationsForCurrentAdmin,
  subscribeAdminNotifications
} from '../lib/adminNotifications.js'
import { AdminNotificationPanel } from '../components/AdminNotificationPanel.jsx'
import { AdminReportsView } from './AdminReports.jsx'
import { AdminAddonPage } from './AdminAddonPage.jsx'
import { useReferenceData } from '../contexts/ReferenceDataContext.jsx'
import { motion, LayoutGroup } from 'framer-motion'
import { AnimatedCounter } from '../components/ui/AnimatedCounter.jsx'
import { TableRowsSkeleton } from '../components/ui/Skeleton.jsx'

const ADMIN_COMPLAINT_STATUSES = ['', 'pending', 'assigned', 'in_progress', 'resolved']
/** Used for overview cards “needs action” counts — not for All Complaints status tabs */
const PENDING_ACTION_STATUSES = ['pending', 'submitted', 'verified', 'assigned']

/** Framer Motion — admin complaints table */
const adminTableStaggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.042, delayChildren: 0.06 } }
}
const adminTableStaggerRow = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 30 } }
}

/** Lists (staff directory, etc.) */
const adminListStaggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } }
}
const adminListStaggerItem = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } }
}

const adminHeadingMainClass =
  'inline-flex items-center gap-2 rounded-lg border border-sky-400/25 bg-sky-500/[0.07] px-3 py-1 text-lg font-extrabold tracking-tight bg-gradient-to-r from-sky-200 via-violet-200 to-fuchsia-200 bg-clip-text text-transparent drop-shadow-[0_0_16px_rgba(56,189,248,0.24)]'
const adminHeadingSectionClass =
  'inline-flex items-center gap-2 rounded-md border border-sky-400/20 bg-sky-500/[0.06] px-2.5 py-1 text-sm font-bold tracking-tight bg-gradient-to-r from-sky-200 via-violet-200 to-fuchsia-200 bg-clip-text text-transparent'

const MOCK_COMPLAINTS = [
  {
    id: '1024',
    user_id: 'u1',
    title: 'WiFi connectivity in Block C',
    category: 'IT',
    status: 'in_progress',
    assigned_department: 'IT',
    priority: 'high',
    created_at: '2025-03-14T09:00:00.000Z',
    updated_at: '2025-03-16T11:20:00.000Z'
  },
  {
    id: '1023',
    user_id: 'u2',
    title: 'Hostel water supply',
    category: 'Hostel',
    status: 'pending',
    assigned_department: null,
    priority: 'medium',
    created_at: '2025-03-16T08:00:00.000Z',
    updated_at: '2025-03-16T08:00:00.000Z'
  },
  {
    id: '1022',
    user_id: 'u3',
    title: 'Lab equipment repair',
    category: 'Academic',
    status: 'resolved',
    assigned_department: 'Academic',
    priority: 'medium',
    created_at: '2025-03-10T12:00:00.000Z',
    updated_at: '2025-03-15T16:45:00.000Z'
  },
  {
    id: '1021',
    user_id: 'u4',
    title: 'Broken Lab Equipment - Room 402',
    category: 'Academic',
    status: 'assigned',
    assigned_department: 'Academic',
    priority: 'low',
    created_at: '2025-03-12T10:00:00.000Z',
    updated_at: '2025-03-13T14:10:00.000Z'
  }
]

/** Demo mode: name + registration so admin UI matches production disambiguation */
const MOCK_PROFILE_SUMMARIES = {
  u1: { full_name: 'Ahmed Khan', role: 'student', department: '', registration_number: 'FA24-BCS-101' },
  u2: { full_name: 'Sara Ali', role: 'student', department: '', registration_number: 'FA24-BCE-045' },
  u3: { full_name: 'Omar Hassan', role: 'student', department: '', registration_number: 'SP23-ME-201' },
  u4: { full_name: 'Fatima Noor', role: 'student', department: '', registration_number: 'FA24-BBA-312' }
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function formatSize(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AdminOverviewCards({ total, pending, resolved, highPriority, activeDepts }) {
  const successRate = total > 0 ? Math.round((resolved / total) * 100) : 0
  const cardMotion =
    'admin-panel-static relative h-full overflow-hidden rounded-2xl border border-slate-700/50 bg-admin-card p-5 shadow-admin-card transition-shadow duration-300'
  const lift = {
    y: -5,
    boxShadow: '0 12px 40px -10px rgba(59, 130, 246, 0.2), 0 8px 32px -12px rgba(0, 0, 0, 0.55)'
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <NavLink to="/admin/complaints" className="block">
        <motion.div
          className={cardMotion}
          whileHover={lift}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        >
          <div className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/15 ring-1 ring-sky-500/20">
            <span className="material-symbols-outlined text-xl text-sky-400">forum</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total complaints</p>
          <p className="mt-1 bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-3xl font-bold text-transparent">
            <AnimatedCounter value={total} />
          </p>
          <p className="mt-2 flex items-center gap-1 text-sm text-emerald-400/90">
            <span className="material-symbols-outlined text-base">trending_up</span>
            University-wide
          </p>
        </motion.div>
      </NavLink>
      <NavLink to="/admin/complaints?status=pending" className="block">
        <motion.div
          className={cardMotion}
          whileHover={lift}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        >
          <div className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-500/25">
            <span className="material-symbols-outlined text-xl text-amber-400">pending_actions</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Needs action</p>
          <p className="mt-1 bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-3xl font-bold text-transparent">
            <AnimatedCounter value={pending} />
          </p>
          <p className="mt-2 flex items-center gap-1 text-sm text-amber-300/90">
            <span className="material-symbols-outlined text-base">priority_high</span>
            {highPriority > 0 ? (
              <>
                High priority: <AnimatedCounter value={highPriority} />
              </>
            ) : (
              'Awaiting routing or review'
            )}
          </p>
        </motion.div>
      </NavLink>
      <NavLink to="/admin/complaints?status=resolved" className="block">
        <motion.div
          className={cardMotion}
          whileHover={lift}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        >
          <div className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/25">
            <span className="material-symbols-outlined text-xl text-emerald-400">check_circle</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resolved</p>
          <p className="mt-1 bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-3xl font-bold text-transparent">
            <AnimatedCounter value={resolved} />
          </p>
          <p className="mt-2 flex items-center gap-1 text-sm text-emerald-400/90">
            <span className="material-symbols-outlined text-base">check</span>
            <AnimatedCounter value={successRate} />% closed successfully
          </p>
        </motion.div>
      </NavLink>
      <NavLink to="/admin/staff" className="block">
        <motion.div
          className={cardMotion}
          whileHover={lift}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        >
          <div className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/25">
            <span className="material-symbols-outlined text-xl text-violet-400">apartment</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Departments engaged</p>
          <p className="mt-1 bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-3xl font-bold text-transparent">
            <AnimatedCounter value={activeDepts} />
          </p>
          <p className="mt-2 text-sm text-slate-500">Across campus units</p>
        </motion.div>
      </NavLink>
    </div>
  )
}

/** Short label for overview “Recent action” from current complaint state */
function getRecentActionDescription(c) {
  const st = (c.status || '').toLowerCase()
  if (st === 'resolved') return 'Resolved'
  if (st === 'closed') return 'Closed'
  if (st === 'in_progress') return 'In progress'
  if (st === 'assigned') {
    return c.assigned_department ? `Assigned · ${c.assigned_department}` : 'Assigned to department'
  }
  if (st === 'pending' || st === 'submitted' || st === 'verified') return 'Pending review'
  return st ? st.replace(/_/g, ' ') : 'Updated'
}

function AdminRecentActions({ complaints, profileSummaries, loading, onViewComplaint }) {
  const recent = useMemo(() => {
    return [...(complaints || [])]
      .filter((c) => c?.id != null)
      .sort((a, b) => {
        const ta = Date.parse(a.updated_at || a.created_at || 0) || 0
        const tb = Date.parse(b.updated_at || b.created_at || 0) || 0
        return tb - ta
      })
      .slice(0, 10)
  }, [complaints])

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className={adminHeadingMainClass}>
            <span className="material-symbols-outlined text-sky-300">history</span>
            Recent action
          </h2>
          <p className="text-sm text-slate-400">Latest complaint updates, newest first.</p>
        </div>
      </div>
      <div className="admin-panel-static overflow-hidden rounded-2xl border border-slate-700/50 shadow-admin-card">
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading activity…</p>
        ) : recent.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No recent activity yet.</p>
        ) : (
          <motion.ul
            className="divide-y divide-slate-800/80"
            variants={adminListStaggerParent}
            initial="hidden"
            animate="show"
          >
            {recent.map((c) => {
              const when = formatDate(c.updated_at || c.created_at)
              const complainant = c.is_anonymous
                ? 'Anonymous'
                : getProfileDisplayName(profileSummaries[c.user_id])
              return (
                <motion.li
                  key={c.id}
                  variants={adminListStaggerItem}
                  className="flex flex-col gap-3 px-4 py-3.5 transition-colors duration-200 hover:bg-sky-500/[0.06] sm:flex-row sm:items-center sm:justify-between"
                  whileHover={{ y: -1, transition: { duration: 0.15 } }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-sky-400/90">
                        {getRecentActionDescription(c)}
                      </span>
                      <StatusBadge status={c.status} variant="admin" />
                    </div>
                    <p className="mt-1 line-clamp-2 font-medium text-slate-100">{c.title || '—'}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {complainant}
                      {getProfileSecondaryLabel(profileSummaries[c.user_id]) && !c.is_anonymous
                        ? ` · ${getProfileSecondaryLabel(profileSummaries[c.user_id])}`
                        : ''}{' '}
                      · {when}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewComplaint?.(c.id)}
                    className="shrink-0 self-start rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-sky-300 transition-colors hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-200 sm:self-center"
                  >
                    View details
                  </button>
                </motion.li>
              )
            })}
          </motion.ul>
        )}
      </div>
    </div>
  )
}

const ADMIN_STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' }
]

function AdminComplaintsTable({ complaints, profileSummaries, loading, searchQuery, statusFilter, pulseRowId, onViewComplaint }) {
  const navigate = useNavigate()

  const setStatusFromTab = (value) => {
    if (value) navigate(`/admin/complaints?status=${encodeURIComponent(value)}`, { replace: true })
    else navigate('/admin/complaints', { replace: true })
  }

  const filtered = complaints.filter((c) => {
    const q = (searchQuery || '').toLowerCase()
    const summary = c.is_anonymous ? null : profileSummaries[c.user_id]
    const searchable = c.is_anonymous
      ? 'anonymous'
      : [getProfileDisplayName(summary), summary?.registration_number, summary?.department]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
    const matchSearch =
      (c.title || '').toLowerCase().includes(q) ||
      searchable.includes(q) ||
      (c.id || '').toString().toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q) ||
      (c.assigned_department || '').toLowerCase().includes(q)
    // Tabs: strict match — Pending = only pending, Assigned = only assigned, etc.
    const matchStatus = (() => {
      if (!statusFilter) return true
      if (statusFilter === 'pending') return c.status === 'pending'
      return c.status === statusFilter
    })()
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className={adminHeadingMainClass}>
            <span className="material-symbols-outlined text-sky-300">assignment</span>
            Complaints
          </h2>
          <p className="text-sm text-slate-400">
            {loading ? 'Loading…' : `${filtered.length} complaint${filtered.length === 1 ? '' : 's'} in this view`}
          </p>
        </div>
      </div>

      <LayoutGroup id="admin-complaints-status-tabs">
        <div className="relative flex flex-wrap gap-1 rounded-2xl border border-slate-700/60 bg-[#0c1424] p-1 shadow-inner">
          {ADMIN_STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.value
            return (
              <button
                key={tab.value || 'all'}
                type="button"
                onClick={() => setStatusFromTab(tab.value)}
                className={`relative z-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors duration-200 sm:px-4 ${
                  active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="admin-complaints-status-pill"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-sky-600 to-violet-600 shadow-lg shadow-indigo-950/40"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    aria-hidden
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </LayoutGroup>

      <div className="admin-panel-static overflow-hidden rounded-2xl border border-slate-700/50 shadow-admin-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="admin-table-head">
                <th className="px-4 py-3.5">ID</th>
                <th className="px-4 py-3.5">Complainant</th>
                <th className="px-4 py-3.5">Title</th>
                <th
                  className="px-4 py-3.5 max-w-[140px]"
                  title="Shows assigned department when set; otherwise the category from the complaint"
                >
                  Category / Dept
                </th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            {loading ? (
              <TableRowsSkeleton rows={8} columns={6} variant="admin" />
            ) : (
              <motion.tbody
                key={`complaints-${statusFilter}-${searchQuery}-${filtered.length}`}
                variants={adminTableStaggerParent}
                initial="hidden"
                animate="show"
              >
                {filtered.map((c) => (
                  <motion.tr
                    key={c.id}
                    variants={adminTableStaggerRow}
                    className="admin-table-row cursor-pointer border-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f1a]"
                    tabIndex={0}
                    aria-label={`Open complaint details: ${(c.title || 'complaint').slice(0, 120)}`}
                    onClick={() => onViewComplaint?.(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onViewComplaint?.(c.id)
                      }
                    }}
                    whileHover={{
                      y: -1,
                      boxShadow: '0 12px 32px -14px rgba(56, 189, 248, 0.12)',
                      transition: { duration: 0.2 }
                    }}
                  >
                    <td className="px-4 py-3.5 font-mono text-xs font-medium text-slate-400">
                      #{String(c.id).slice(0, 8)}
                    </td>
                    <td className="max-w-[min(200px,32vw)] px-4 py-3.5 text-slate-200">
                      {c.is_anonymous ? (
                        'Anonymous'
                      ) : (
                        <div className="min-w-0">
                          <div className="truncate font-medium">{getProfileDisplayName(profileSummaries[c.user_id])}</div>
                          {getProfileSecondaryLabel(profileSummaries[c.user_id]) && (
                            <div className="truncate text-xs text-slate-500">
                              {getProfileSecondaryLabel(profileSummaries[c.user_id])}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="max-w-[min(280px,40vw)] px-4 py-3.5 font-medium text-slate-100">
                      <span className="line-clamp-2">{c.title}</span>
                    </td>
                    <td className="max-w-[min(160px,28vw)] px-4 py-3.5">
                      {c.assigned_department ? (
                        <span className="inline-flex rounded-md border border-violet-500/35 bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-200">
                          {c.assigned_department}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md border border-slate-600/50 bg-slate-800/60 px-2 py-0.5 text-xs font-medium text-slate-300">
                          {c.category || '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <motion.span
                        className="inline-flex rounded-lg"
                        key={`${c.id}-${c.status}`}
                        initial={{ opacity: 0.85, scale: 0.94 }}
                        animate={
                          pulseRowId != null && String(pulseRowId) === String(c.id)
                            ? {
                                opacity: 1,
                                scale: [1, 1.08, 1],
                                boxShadow: [
                                  '0 0 0 0 rgba(56, 189, 248, 0.45)',
                                  '0 0 0 12px rgba(56, 189, 248, 0)',
                                  '0 0 0 0 rgba(56, 189, 248, 0)'
                                ]
                              }
                            : { opacity: 1, scale: 1, boxShadow: '0 0 0 0 transparent' }
                        }
                        transition={{ duration: 0.75, ease: 'easeOut' }}
                      >
                        <StatusBadge status={c.status} variant="admin" glow />
                      </motion.span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewComplaint?.(c.id)
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-sky-300 shadow-sm transition-all duration-200 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-200"
                      >
                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        View details
                      </motion.button>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            )}
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">No complaints match your filters.</p>
        )}
      </div>
    </div>
  )
}

function AdminStaffView({ departmentsList = [] }) {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [staffError, setStaffError] = useState('')

  const allDeptNames = useMemo(() => {
    const ordered = [...departmentsList]
    const seen = new Set(ordered.map((d) => d.toLowerCase()))
    for (const s of staff) {
      const d = (s.department || '').trim()
      if (!d) continue
      const key = d.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        ordered.push(d)
      }
    }
    return ordered
  }, [departmentsList, staff])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await fetchStaffProfiles()
      if (!cancelled) {
        setLoading(false)
        if (!error && data?.length) {
          setStaff(data)
          setStaffError('')
        } else {
          setStaff([])
          setStaffError(error?.message || '')
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const byDept = allDeptNames.map((d) => ({
    name: d,
    members: staff.filter((s) => (s.department || '').toLowerCase() === d.toLowerCase())
  }))

  return (
    <div className="space-y-6">
      <h2 className={adminHeadingMainClass}>
        <span className="material-symbols-outlined text-violet-300">groups</span>
        Faculty &amp; departments
      </h2>
      <p className="text-slate-400">
        {staff.length > 0
          ? `${staff.length} faculty / staff account(s) grouped by department.`
          : 'Faculty (staff role) appear here once accounts are created in the system.'}
      </p>
      {staffError ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {staffError}
        </div>
      ) : null}
      {loading ? (
        <p className="text-slate-500">Loading directory…</p>
      ) : (
        <div className="space-y-4">
          {byDept.map(({ name, members }) => (
            <div key={name} className="admin-panel-static overflow-hidden rounded-2xl">
              <div className="flex items-center gap-3 border-b border-slate-700/60 bg-[#0c1424] px-6 py-3">
                <span className="material-symbols-outlined text-xl text-violet-400">apartment</span>
                <h3 className={adminHeadingSectionClass}>{name}</h3>
                <span className="text-sm text-slate-500">({members.length})</span>
              </div>
              {members.length === 0 ? (
                <p className="px-6 py-4 text-sm text-slate-500">No staff assigned to this department yet.</p>
              ) : (
                <motion.ul
                  className="divide-y divide-slate-800/80"
                  variants={adminListStaggerParent}
                  initial="hidden"
                  animate="show"
                >
                  {members.map((s) => (
                    <motion.li
                      key={s.id}
                      variants={adminListStaggerItem}
                      className="flex items-center gap-3 px-6 py-3 transition-colors duration-200 hover:bg-sky-500/[0.05]"
                      whileHover={{ x: 4, transition: { type: 'spring', stiffness: 400, damping: 28 } }}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-600/40 to-violet-600/40 text-sm font-bold text-sky-100">
                        {(s.full_name || 'S').slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-100">{s.full_name || 'Staff'}</p>
                        <p className="text-xs text-slate-500">Faculty / staff • {s.department || '—'}</p>
                      </div>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Shown when .env has no Supabase — user tables require a live project for add/edit/delete */
const CONFIG_SUPABASE_REQUIRED =
  'Connect your live project: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then deploy Edge Functions admin-create-user, admin-update-user, and admin-delete-user (see supabase/SETUP.md).'

/** Main title on Config page */
function ConfigPageHeading({ children }) {
  return (
    <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
      <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-violet-300 bg-clip-text text-transparent drop-shadow-sm">
        {children}
      </span>
    </h2>
  )
}

/** Section card title (Add user, Students, Faculty, etc.) */
function ConfigSectionHeading({ children, accent = 'sky' }) {
  const border =
    accent === 'violet'
      ? 'border-violet-400'
      : accent === 'amber'
        ? 'border-amber-400'
        : 'border-sky-400'
  return (
    <h3
      className={`text-lg font-bold tracking-tight text-slate-50 sm:text-xl border-l-4 ${border} pl-3 py-0.5`}
    >
      {children}
    </h3>
  )
}

function AdminConfigView({ departmentsList = [] }) {
  const { showToast } = useToast()
  const [addUserRole, setAddUserRole] = useState('student')
  const [addEmail, setAddEmail] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addFullName, setAddFullName] = useState('')
  const [addDepartment, setAddDepartment] = useState(() => departmentsList[0] || '')
  const [addRegistrationNumber, setAddRegistrationNumber] = useState('')
  const [creating, setCreating] = useState(false)
  const [addError, setAddError] = useState('')
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountsError, setAccountsError] = useState('')
  const [accounts, setAccounts] = useState([])
  const [bulkRows, setBulkRows] = useState('')
  const [bulkRole, setBulkRole] = useState('staff')
  const [bulkFileName, setBulkFileName] = useState('')
  const [bulkCreating, setBulkCreating] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkSummary, setBulkSummary] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editFullName, setEditFullName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRegistrationNumber, setEditRegistrationNumber] = useState('')
  const [editDepartment, setEditDepartment] = useState(() => departmentsList[0] || '')
  const [editNewPassword, setEditNewPassword] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (addUserRole !== 'staff' || !departmentsList.length) return
    if (!addDepartment || !departmentsList.includes(addDepartment)) {
      setAddDepartment(departmentsList[0])
    }
  }, [addUserRole, departmentsList, addDepartment])

  const reloadAccounts = useCallback(async () => {
    if (!supabase) {
      setAccounts([])
      return
    }
    const { data, error } = await fetchAssignedLoginAccounts()
    if (!error) setAccounts(data || [])
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadAccounts() {
      setAccountsLoading(true)
      setAccountsError('')
      if (!supabase) {
        if (!cancelled) {
          setAccountsLoading(false)
          setAccounts([])
          setAccountsError(CONFIG_SUPABASE_REQUIRED)
        }
        return
      }
      const { data, error } = await fetchAssignedLoginAccounts()
      if (cancelled) return
      setAccountsLoading(false)
      if (error) {
        setAccountsError(error.message || 'Failed to load assigned accounts.')
        setAccounts([])
        return
      }
      setAccounts(data || [])
    }
    loadAccounts()
    return () => { cancelled = true }
  }, [])

  async function handleCreateUser(e) {
    e.preventDefault()
    setAddError('')
    if (!addEmail.trim() || !addPassword || !addFullName.trim()) {
      setAddError('Email, password and full name are required.')
      return
    }
    if (addPassword.length < 6) {
      setAddError('Password must be at least 6 characters.')
      return
    }
    if (addUserRole === 'student' && !addRegistrationNumber.trim()) {
      setAddError('Registration number is required for student accounts.')
      return
    }
    setCreating(true)
    try {
      const { error } = await createUserByAdmin({
        email: addEmail.trim(),
        password: addPassword,
        full_name: addFullName.trim(),
        role: addUserRole,
        department: addUserRole === 'staff' ? addDepartment : undefined,
        registration_number: addUserRole === 'student' ? addRegistrationNumber : undefined
      })
      if (error) {
        setAddError(error.message)
        return
      }
      showToast('Account created. Share the email and password with the user.', 'success')
      setAddEmail('')
      setAddPassword('')
      setAddFullName('')
      setAddRegistrationNumber('')
      await reloadAccounts()
    } catch (e) {
      setAddError(e?.message || 'Failed to create user.')
    } finally {
      setCreating(false)
    }
  }

  function parseBulkLinesForRole(lines, role) {
    const parsed = []
    for (let i = 0; i < lines.length; i += 1) {
      const parts = lines[i].split(',').map((p) => p.trim())
      if (parts.length !== 4) {
        return { error: `Line ${i + 1}: Use 4 values (comma separated).` }
      }
      const [full_name, email, password, fourth] = parts
      if (!full_name || !email || !password || !fourth) {
        return { error: `Line ${i + 1}: all 4 fields are required.` }
      }
      if (password.length < 6) {
        return { error: `Line ${i + 1}: password must be at least 6 characters.` }
      }
      if (role === 'staff') {
        if (!departmentsList.includes(fourth)) {
          return { error: `Line ${i + 1}: department must be one of ${departmentsList.join(', ')}.` }
        }
        parsed.push({ full_name, email, password, role: 'staff', department: fourth })
      } else {
        parsed.push({ full_name, email, password, role: 'student', registration_number: fourth })
      }
    }
    return { parsed }
  }

  async function handleBulkFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBulkError('')
    setBulkSummary(null)
    setBulkFileName(file.name || '')
    try {
      const text = await file.text()
      const rawLines = String(text)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
      if (!rawLines.length) {
        setBulkError('CSV file is empty.')
        return
      }
      // Allow header row.
      const header = rawLines[0].toLowerCase()
      const hasHeader = header.includes('full') && header.includes('email')
      const lines = hasHeader ? rawLines.slice(1) : rawLines
      setBulkRows(lines.join('\n'))
    } catch (err) {
      setBulkError(err?.message || 'Could not read CSV file.')
    } finally {
      e.target.value = ''
    }
  }

  async function handleBulkCreateAccounts(e) {
    e.preventDefault()
    setBulkError('')
    setBulkSummary(null)

    const lines = bulkRows
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (!lines.length) {
      setBulkError('Please add at least one row.')
      return
    }

    const result = parseBulkLinesForRole(lines, bulkRole)
    if (result.error) {
      setBulkError(result.error)
      return
    }
    const parsed = result.parsed || []

    setBulkCreating(true)
    let success = 0
    const failed = []

    for (const item of parsed) {
      const { error } = await createUserByAdmin({
        email: item.email,
        password: item.password,
        full_name: item.full_name,
        role: item.role,
        department: item.role === 'staff' ? item.department : undefined,
        registration_number: item.role === 'student' ? item.registration_number : undefined
      })
      if (error) failed.push(`${item.email}: ${error.message || 'Failed'}`)
      else success += 1
    }

    const failedCount = failed.length
    setBulkSummary({ total: parsed.length, success, failed: failedCount, failedItems: failed })
    if (success > 0) {
      showToast(`${success} ${bulkRole === 'staff' ? 'faculty' : 'student'} account(s) created successfully.`, 'success')
      await reloadAccounts()
    }
    if (failedCount === 0) {
      setBulkRows('')
      setBulkFileName('')
    }
    setBulkCreating(false)
  }

  const studentAccounts = useMemo(() => accounts.filter((a) => a.role === 'student'), [accounts])
  const facultyAccounts = useMemo(() => accounts.filter((a) => a.role === 'staff'), [accounts])

  const downloadCsvFile = (filename, header, rows) => {
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const dateSlug = new Date().toISOString().slice(0, 10)

  const downloadStudentsCsv = () => {
    const header = ['Full Name', 'Registration Number', 'Email', 'Created At']
    const rows = studentAccounts.map((a) => [
      a.full_name || '',
      a.registration_number || '',
      a.email || '',
      a.created_at ? new Date(a.created_at).toLocaleString() : ''
    ])
    downloadCsvFile(`students-${dateSlug}.csv`, header, rows)
  }

  const downloadFacultyCsv = () => {
    const header = ['Full Name', 'Department', 'Email', 'Created At']
    const rows = facultyAccounts.map((a) => [
      a.full_name || '',
      a.department || '',
      a.email || '',
      a.created_at ? new Date(a.created_at).toLocaleString() : ''
    ])
    downloadCsvFile(`faculty-staff-${dateSlug}.csv`, header, rows)
  }

  function openEditAccount(row) {
    setEditTarget(row)
    setEditFullName(row.full_name || '')
    setEditEmail(row.email || '')
    setEditRegistrationNumber(row.registration_number || '')
    setEditDepartment(row.department || departmentsList[0] || '')
    setEditNewPassword('')
    setEditError('')
  }

  function closeEditAccount() {
    setEditTarget(null)
    setEditError('')
  }

  async function saveEditAccount(e) {
    e.preventDefault()
    setEditError('')
    if (!editTarget) return
    if (!editFullName.trim()) {
      setEditError('Full name is required.')
      return
    }
    if (!editEmail.trim()) {
      setEditError('Email is required.')
      return
    }
    if (editNewPassword && editNewPassword.length < 6) {
      setEditError('New password must be at least 6 characters.')
      return
    }

    setEditSaving(true)
    try {
      if (!supabase) {
        setEditError(CONFIG_SUPABASE_REQUIRED)
        showToast('Supabase not configured — cannot save changes.', 'error')
        return
      }

      const payload = {
        user_id: editTarget.id,
        full_name: editFullName.trim(),
        email: editEmail.trim()
      }
      if (editNewPassword) payload.new_password = editNewPassword
      if (editTarget.role === 'student') {
        payload.registration_number = editRegistrationNumber.trim()
      }
      if (editTarget.role === 'staff') {
        payload.department = editDepartment
      }

      const { error } = await updateUserByAdmin(payload)
      if (error) {
        setEditError(error.message || 'Update failed.')
        return
      }
      showToast('User updated.', 'success')
      closeEditAccount()
      await reloadAccounts()
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteAccount(row) {
    const ok = window.confirm(
      `Delete ${row.role} account ${row.email}? This removes their login and related records. This cannot be undone.`
    )
    if (!ok) return
    if (!supabase) {
      showToast(CONFIG_SUPABASE_REQUIRED, 'error')
      return
    }
    setDeletingId(row.id)
    const { error } = await deleteUserByAdmin(row.id)
    setDeletingId(null)
    if (error) {
      showToast(error.message || 'Delete failed.', 'error')
      return
    }
    showToast('User deleted.', 'success')
    await reloadAccounts()
  }

  return (
    <div className="space-y-6">
      <div>
        <ConfigPageHeading>Configuration</ConfigPageHeading>
        <p className="mt-2 text-slate-400">System settings and manage student & faculty accounts.</p>
      </div>

      <div className="admin-panel-static overflow-hidden rounded-2xl">
        <div className="px-6 py-4 border-b border-slate-700/60">
          <ConfigSectionHeading>Add User (Student / Faculty)</ConfigSectionHeading>
          <p className="text-sm text-slate-500 mt-1">Assign email and password.</p>
        </div>
        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Role</label>
            <select
              value={addUserRole}
              onChange={(e) => setAddUserRole(e.target.value)}
              className="admin-input px-4 py-2.5"
            >
              <option value="student">Student</option>
              <option value="staff">Faculty (Staff)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Full name</label>
            <input
              type="text"
              value={addFullName}
              onChange={(e) => setAddFullName(e.target.value)}
              className="admin-input px-4 py-2.5"
              placeholder="Full name"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Email</label>
            <input
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              className="admin-input px-4 py-2.5"
              placeholder="user@university.edu"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Password</label>
            <input
              type="password"
              value={addPassword}
              onChange={(e) => setAddPassword(e.target.value)}
              className="admin-input px-4 py-2.5"
              placeholder="••••••••"
              required
              minLength={6}
            />
            <p className="text-xs text-slate-500 mt-1">Give this password to the user securely.</p>
          </div>
          {addUserRole === 'student' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Registration number</label>
              <input
                type="text"
                value={addRegistrationNumber}
                onChange={(e) => setAddRegistrationNumber(e.target.value)}
                className="admin-input px-4 py-2.5"
                placeholder="e.g. FA24-BCS-001"
                required
              />
              <p className="text-xs text-slate-500 mt-1">Shown to admin and assigned faculty so same-name students can be told apart.</p>
            </div>
          )}
          {addUserRole === 'staff' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Department</label>
              <select
                value={addDepartment}
                onChange={(e) => setAddDepartment(e.target.value)}
                className="admin-input px-4 py-2.5"
              >
                {departmentsList.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
          {addError && (
            <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">{addError}</p>
          )}
          <button type="submit" disabled={creating} className="admin-gradient-btn disabled:cursor-not-allowed disabled:opacity-50">
            {creating ? 'Creating...' : 'Create account'}
          </button>
        </form>
      </div>

      <div className="admin-panel-static overflow-hidden rounded-2xl border border-slate-700/50 shadow-admin-card">
        <div className="flex flex-col gap-2 border-b border-slate-700/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <ConfigSectionHeading>Students</ConfigSectionHeading>
            <p className="mt-2 text-sm text-slate-500">Name, registration number, email — edit or remove accounts.</p>
          </div>
          <button
            type="button"
            onClick={downloadStudentsCsv}
            disabled={accountsLoading || studentAccounts.length === 0}
            className="shrink-0 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-300 transition-colors hover:bg-sky-500/15 disabled:opacity-50"
          >
            Export students (CSV)
          </button>
        </div>
        {accountsLoading ? (
          <p className="px-6 py-6 text-sm text-slate-500">Loading…</p>
        ) : accountsError ? (
          <p className="px-6 py-6 text-sm text-red-400">{accountsError}</p>
        ) : studentAccounts.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500">No student accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="admin-table-head">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Registration number</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <motion.tbody variants={adminTableStaggerParent} initial="hidden" animate="show">
                {studentAccounts.map((a) => (
                  <motion.tr key={a.id} variants={adminTableStaggerRow} className="admin-table-row text-slate-200">
                    <td className="px-4 py-3 font-medium">{a.full_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{a.registration_number || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{a.email || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditAccount(a)}
                          className="rounded-lg border border-sky-500/35 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300 hover:bg-sky-500/15"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(a)}
                          disabled={deletingId === a.id}
                          className="rounded-lg border border-red-500/35 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/15 disabled:opacity-50"
                        >
                          {deletingId === a.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-panel-static overflow-hidden rounded-2xl border border-slate-700/50 shadow-admin-card">
        <div className="flex flex-col gap-2 border-b border-slate-700/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <ConfigSectionHeading accent="violet">Faculty (staff)</ConfigSectionHeading>
            <p className="mt-2 text-sm text-slate-500">Name, department, email — edit or remove accounts.</p>
          </div>
          <button
            type="button"
            onClick={downloadFacultyCsv}
            disabled={accountsLoading || facultyAccounts.length === 0}
            className="shrink-0 rounded-lg border border-violet-500/35 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-200 transition-colors hover:bg-violet-500/15 disabled:opacity-50"
          >
            Export faculty (CSV)
          </button>
        </div>
        {accountsLoading ? (
          <p className="px-6 py-6 text-sm text-slate-500">Loading…</p>
        ) : accountsError ? (
          <p className="px-6 py-6 text-sm text-red-400">{accountsError}</p>
        ) : facultyAccounts.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500">No faculty accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="admin-table-head">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <motion.tbody variants={adminTableStaggerParent} initial="hidden" animate="show">
                {facultyAccounts.map((a) => (
                  <motion.tr key={a.id} variants={adminTableStaggerRow} className="admin-table-row text-slate-200">
                    <td className="px-4 py-3 font-medium">{a.full_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{a.department || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{a.email || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditAccount(a)}
                          className="rounded-lg border border-sky-500/35 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300 hover:bg-sky-500/15"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(a)}
                          disabled={deletingId === a.id}
                          className="rounded-lg border border-red-500/35 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/15 disabled:opacity-50"
                        >
                          {deletingId === a.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-panel-static overflow-hidden rounded-2xl">
        <div className="px-6 py-4 border-b border-slate-700/60">
          <ConfigSectionHeading accent="violet">Bulk Import (CSV / Lines)</ConfigSectionHeading>
          <p className="text-sm text-slate-500 mt-1">
            Upload CSV or paste rows. One row per line, comma-separated.
          </p>
        </div>
        <form onSubmit={handleBulkCreateAccounts} className="p-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Import role</label>
            <select
              value={bulkRole}
              onChange={(e) => setBulkRole(e.target.value)}
              className="admin-input px-4 py-2.5"
            >
              <option value="staff">Faculty (Staff)</option>
              <option value="student">Student</option>
            </select>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-700/60 bg-[#0c1424] p-4">
            <label className="block text-sm font-medium text-slate-300">Upload CSV file</label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-300 hover:bg-sky-500/15">
              <span className="material-symbols-outlined text-base">upload_file</span>
              Choose file
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleBulkFileChange} />
            </label>
            {bulkFileName && <p className="text-xs text-slate-500">Loaded: {bulkFileName}</p>}
            <p className="text-xs text-slate-500">
              {bulkRole === 'staff'
                ? 'Format: Full Name, Email, Password, Department'
                : 'Format: Full Name, Email, Password, Registration Number'}
            </p>
            {bulkRole === 'staff' && (
              <p className="text-xs text-slate-500">Allowed departments: {departmentsList.join(', ')}</p>
            )}
          </div>
          <textarea
            value={bulkRows}
            onChange={(e) => setBulkRows(e.target.value)}
            className="admin-input min-h-40 px-4 py-3"
            placeholder={
              bulkRole === 'staff'
                ? `Ali Khan, ali.it@university.edu, pass1234, IT\nSara Ahmed, sara.hostel@university.edu, pass1234, Hostel`
                : `Maryam Tanveer, maryam@university.edu, pass1234, FA23-BSE-117\nTehseen Fatima, tehseen@university.edu, pass1234, FA23-BSE-128`
            }
          />
          {bulkError && (
            <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">{bulkError}</p>
          )}
          {bulkSummary && (
            <div className="space-y-2 rounded-lg border border-slate-700/60 bg-[#0c1424] p-3 text-sm">
              <p className="text-slate-300">
                Processed: {bulkSummary.total} | Success: {bulkSummary.success} | Failed: {bulkSummary.failed}
              </p>
              {bulkSummary.failedItems?.length > 0 && (
                <ul className="space-y-1 text-xs text-red-300">
                  {bulkSummary.failedItems.slice(0, 8).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={bulkCreating}
            className="admin-gradient-btn disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkCreating ? 'Creating accounts...' : `Create ${bulkRole === 'staff' ? 'faculty' : 'student'} accounts`}
          </button>
        </form>
      </div>

      {editTarget && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            aria-label="Close dialog"
            onClick={closeEditAccount}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-title"
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700/80 bg-[#0f172a] p-6 shadow-2xl"
          >
            <h3 id="edit-user-title" className={adminHeadingMainClass}>
              <span className="material-symbols-outlined text-sky-300">edit_square</span>
              Edit {editTarget.role === 'staff' ? 'faculty' : 'student'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">Update profile and sign-in. Leave password blank to keep the current one.</p>
            <form onSubmit={saveEditAccount} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Full name</label>
                <input
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="admin-input w-full px-4 py-2.5"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="admin-input w-full px-4 py-2.5"
                  required
                />
              </div>
              {editTarget.role === 'student' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Registration number</label>
                  <input
                    value={editRegistrationNumber}
                    onChange={(e) => setEditRegistrationNumber(e.target.value)}
                    className="admin-input w-full px-4 py-2.5"
                    placeholder="e.g. FA24-BCS-001"
                  />
                </div>
              )}
              {editTarget.role === 'staff' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Department</label>
                  <select
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="admin-input w-full px-4 py-2.5"
                  >
                    {departmentsList.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">New password (optional)</label>
                <input
                  type="password"
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  className="admin-input w-full px-4 py-2.5"
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                />
              </div>
              {editError && (
                <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">{editError}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={editSaving}
                  className="admin-gradient-btn disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {editSaving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={closeEditAccount}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminProfileView() {
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const displayName = profile?.full_name || 'Administrator'
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdError, setPwdError] = useState('')

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwdError('')
    if (!supabase) {
      const msg = 'Demo mode: password change is not available.'
      setPwdError(msg)
      showToast(msg, 'error')
      return
    }
    if (!user?.email) {
      setPwdError('No email on account.')
      return
    }
    if (!currentPassword) {
      setPwdError('Current password is required.')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      setPwdError('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwdError('Passwords do not match.')
      return
    }
    setPwdSaving(true)
    try {
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      })
      if (reauthErr) {
        setPwdError(reauthErr.message || 'Current password is incorrect.')
        showToast('Failed to update password.', 'error')
        return
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
      if (updateErr) {
        setPwdError(updateErr.message || 'Failed to update password.')
        showToast('Failed to update password.', 'error')
        return
      }
      showToast('Password updated successfully.', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPwdError(err?.message || 'Failed.')
      showToast('Failed to update password.', 'error')
    } finally {
      setPwdSaving(false)
    }
  }

  return (
    <ProfilePageLayout
      variant="admin"
      roleBadge="University administrator"
      title={displayName}
      subtitle="Account overview and security for your admin access to the complaint management system."
    >
      <div className="admin-panel-static overflow-hidden rounded-2xl">
        <div className="px-6 py-4 border-b border-slate-700/60">
          <h2 className={adminHeadingMainClass}>
            <span className="material-symbols-outlined text-sky-300">badge</span>
            Account summary
          </h2>
        </div>
        <dl className="px-6 py-5 space-y-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email</dt>
            <dd className="text-sm text-slate-100 mt-1">{user?.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Role</dt>
            <dd className="text-sm text-slate-100 mt-1 capitalize">{profile?.role || 'admin'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Display name</dt>
            <dd className="text-sm text-slate-100 mt-1">{displayName}</dd>
          </div>
        </dl>
      </div>

      <div className="admin-panel-static overflow-hidden rounded-2xl">
        <div className="border-b border-slate-700/60 bg-[#0c1424] px-6 py-4">
          <h2 className={adminHeadingMainClass}>
            <span className="material-symbols-outlined text-amber-300">lock</span>
            Change password
          </h2>
          <p className="mt-1 text-xs text-slate-500">Re-enter your current password to set a new one.</p>
        </div>
        <form onSubmit={handleChangePassword} className="p-6 space-y-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="admin-input px-3 py-2"
            placeholder="Current password"
            autoComplete="current-password"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="admin-input px-3 py-2"
            placeholder="New password"
            autoComplete="new-password"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="admin-input px-3 py-2"
            placeholder="Confirm new password"
            autoComplete="new-password"
          />
          {pwdError && <p className="text-sm text-red-600 dark:text-red-400">{pwdError}</p>}
          <button
            type="submit"
            disabled={pwdSaving}
            className="admin-gradient-btn w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pwdSaving ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </ProfilePageLayout>
  )
}

function AdminBottomNav() {
  const links = [
    { to: '/admin', end: true, icon: 'dashboard', label: 'Overview' },
    { to: '/admin/complaints', icon: 'assignment', label: 'Complaints' },
    { to: '/admin/staff', icon: 'groups', label: 'Staff' },
    { to: '/admin/config', icon: 'settings', label: 'Config' },
    { to: '/admin/reports', icon: 'analytics', label: 'Reports' },
    { to: '/admin/categories-departments', icon: 'category', label: 'Cat. & depts.' },
    { to: '/admin/profile', icon: 'person', label: 'Profile' }
  ]
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-start gap-0.5 overflow-x-auto border-t border-slate-800/90 bg-admin-sidebar px-2 py-2 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.5)] md:hidden scrollbar-hide">
      {links.map(({ to, end, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-w-[4.25rem] shrink-0 flex-col items-center gap-0.5 rounded-lg py-1 transition-colors duration-200 ${
              isActive ? 'font-semibold text-sky-400' : 'text-slate-500'
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
          <span className="text-[9px] font-bold leading-tight">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function AdminDashboard() {
  const { departments } = useReferenceData()
  const { showToast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [complaints, setComplaints] = useState([])
  const [profileSummaries, setProfileSummaries] = useState({})
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [pulseRowId, setPulseRowId] = useState(null)
  const location = useLocation()

  const triggerRowPulse = useCallback((id) => {
    setPulseRowId(id)
    window.setTimeout(() => setPulseRowId(null), 1600)
  }, [])
  const adminHeaderTitle = useMemo(() => {
    const p = location.pathname
    if (p.endsWith('/profile')) return 'My profile'
    if (p.endsWith('/complaints') || p.includes('/admin/complaints')) return 'All Complaints'
    if (p.endsWith('/config')) return 'Configuration'
    if (p.endsWith('/categories-departments')) return 'Categories & departments'
    if (p.endsWith('/reports')) return 'Reports'
    if (p.endsWith('/staff')) return 'Staff'
    return 'Admin overview'
  }, [location.pathname])

  const refreshDetailInDrawer = useCallback(async (complaintId) => {
    if (complaintId == null) return
    const { data, error } = await fetchComplaintById(complaintId)
    if (!error && data) {
      setDetail((d) => (d && String(d.id) === String(complaintId) ? data : d))
    }
  }, [])

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detail, setDetail] = useState(null)
  const [attachmentUrls, setAttachmentUrls] = useState({})
  const [assignableDepartments, setAssignableDepartments] = useState([])
  const [notifications, setNotifications] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifLoadError, setNotifLoadError] = useState(null)
  const [notifReady, setNotifReady] = useState(false)
  const [notifPanelOpen, setNotifPanelOpen] = useState(false)

  const loadNotifs = useCallback(async () => {
    if (!supabase) return
    setNotifLoading(true)
    setNotifLoadError(null)
    const { data, error } = await fetchAdminNotificationsForCurrentAdmin()
    setNotifLoading(false)
    setNotifReady(true)
    if (error) {
      setNotifLoadError(error)
      setNotifications([])
      return
    }
    setNotifications(data || [])
  }, [])

  useEffect(() => {
    if (!supabase) return undefined
    void loadNotifs()
    const unsub = subscribeAdminNotifications(() => {
      void loadNotifs()
    })
    return unsub
  }, [supabase, loadNotifs])

  const adminLastSeenAt = Number(sessionStorage.getItem('adminLastSeenAt') || 0)
  const isUnread = (c) => {
    const created = c?.created_at ? Date.parse(c.created_at) : 0
    const updated = c?.updated_at ? Date.parse(c.updated_at) : 0
    return Math.max(created, updated) > adminLastSeenAt
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchComplaints({
      role: 'admin',
      search: searchQuery || undefined
    })
    setLoading(false)
    if (error) return
    setComplaints(data || [])
    // Avoid fetching student names for anonymous complaints.
    const userIds = [...new Set((data || []).filter((c) => !c.is_anonymous).map((c) => c.user_id).filter(Boolean))]
    if (userIds.length) {
      const map = await fetchProfileSummaries(userIds)
      setProfileSummaries(map)
    } else {
      setProfileSummaries({})
    }
  }, [searchQuery])

  useEffect(() => {
    if (location.pathname !== '/admin/complaints') {
      setStatusFilter('')
      return
    }
    const raw = (new URLSearchParams(location.search).get('status') || '').trim()
    const next = ADMIN_COMPLAINT_STATUSES.includes(raw) ? raw : ''
    setStatusFilter((prev) => (prev === next ? prev : next))
  }, [location.pathname, location.search])

  useEffect(() => {
    if (supabase) {
      load()
      const unsub = subscribeComplaints(load)
      return unsub
    }
    setComplaints(MOCK_COMPLAINTS)
    setProfileSummaries(MOCK_PROFILE_SUMMARIES)
    setLoading(false)
  }, [load])

  useEffect(() => {
    let cancelled = false
    async function loadAssignableDepartments() {
      if (!supabase) {
        setAssignableDepartments(departments.length ? [...departments] : [])
        return
      }
      const { data, error } = await fetchStaffProfiles()
      if (cancelled) return
      const fromStaff = error ? [] : [...new Set((data || []).map((s) => (s.department || '').trim()).filter(Boolean))]
      const merged = [...new Set([...(departments || []), ...fromStaff])]
      setAssignableDepartments(merged)
    }
    loadAssignableDepartments()
    return () => { cancelled = true }
  }, [departments])

  const total = complaints.length
  const pending = complaints.filter((c) => PENDING_ACTION_STATUSES.includes(c.status)).length
  const resolved = complaints.filter((c) => c.status === 'resolved').length
  const highPriority = complaints.filter((c) => PENDING_ACTION_STATUSES.includes(c.status) && (c.priority === 'high')).length
  const activeDepts =
    [...new Set(complaints.map((c) => c.assigned_department).filter(Boolean))].length ||
    (departments.length || 1)

  const pendingAll = complaints.filter((c) => c.status === 'pending' || c.status === 'assigned')
  const unreadComplaints = pendingAll.filter((c) => isUnread(c))
  const unreadCount = unreadComplaints.length
  const notifUnread = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications])
  const headerBadgeCount =
    supabase && notifReady && !notifLoadError ? notifUnread : unreadCount

  async function handleViewComplaint(id) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError('')
    setDetail(null)
    setAttachmentUrls({})

    const { data, error } = await fetchComplaintById(id)
    if (error) {
      setDetailError(error.message || 'Failed to load complaint details.')
      setDetailLoading(false)
      return
    }
    setDetail(data)
    setDetailLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    async function loadAttachmentUrls() {
      const items = detail?.attachments || []
      if (!items.length) {
        if (!cancelled) setAttachmentUrls({})
        return
      }
      const entries = await Promise.all(
        items.map(async (a) => {
          const url = await getFileAccessUrl(a.file_path)
          return [a.id, url || getFileUrl(a.file_path) || '#']
        })
      )
      if (!cancelled) setAttachmentUrls(Object.fromEntries(entries))
    }
    loadAttachmentUrls()
    return () => { cancelled = true }
  }, [detail?.id, detail?.attachments])

  async function handleAssign(id, assigned_department, deadlineDate) {
    if (!assigned_department) return
    if (!deadlineDate) {
      showToast('Please select a deadline before assigning.', 'error')
      return
    }
    if (!assignableDepartments.includes(assigned_department)) {
      showToast('Please assign only configured departments.', 'error')
      return
    }
    const dueCandidate = new Date(`${deadlineDate}T23:59:59`)
    if (Number.isNaN(dueCandidate.getTime())) {
      showToast('Please provide a valid deadline date.', 'error')
      return
    }
    const dueAt = dueCandidate.toISOString()
    if (!supabase) {
      setComplaints((prev) =>
        prev.map((c) => (String(c.id) === String(id) ? { ...c, assigned_department, status: 'assigned', due_at: dueAt } : c))
      )
      setDetail((d) =>
        d && String(d.id) === String(id) ? { ...d, assigned_department, status: 'assigned', due_at: dueAt } : d
      )
      triggerRowPulse(id)
      showToast('Department assigned with deadline.', 'success')
      return
    }
    setUpdatingId(id)
    const { error } = await updateComplaint(id, { assigned_department, status: 'assigned', due_at: dueAt })
    setUpdatingId(null)
    if (error) {
      showToast(error.message || 'Failed to assign department.', 'error')
      return
    }
    triggerRowPulse(id)
    showToast('Department assigned with deadline.', 'success')
    void refreshDetailInDrawer(id)
    load()
  }

  async function handleStatusChange(id, status) {
    if (!supabase) {
      setComplaints((prev) => prev.map((c) => (String(c.id) === String(id) ? { ...c, status } : c)))
      setDetail((d) => (d && String(d.id) === String(id) ? { ...d, status } : d))
      triggerRowPulse(id)
      showToast('Status updated successfully.', 'success')
      return
    }
    setUpdatingId(id)
    const { error } = await updateComplaint(id, { status })
    setUpdatingId(null)
    if (error) {
      showToast(error.message || 'Failed to update status.', 'error')
      return
    }
    triggerRowPulse(id)
    showToast('Status updated successfully.', 'success')
    void refreshDetailInDrawer(id)
    load()
  }

  return (
    <div className="admin-app flex h-screen overflow-hidden">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-admin-bg">
        <Header
          variant="admin"
          title={adminHeaderTitle}
          showSearch
          searchPlaceholder="Search complaints..."
          onSearch={setSearchQuery}
          onMenuClick={() => setSidebarOpen(true)}
          notificationCount={headerBadgeCount}
          onNotificationsClick={() => {
            setNotifPanelOpen((o) => !o)
            void loadNotifs()
          }}
        />
        <AdminNotificationPanel
          open={notifPanelOpen}
          onClose={() => setNotifPanelOpen(false)}
          notifications={notifications}
          loading={notifLoading}
          error={notifLoadError}
          onRefresh={loadNotifs}
          onOpenComplaint={handleViewComplaint}
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          <motion.div
            className="min-h-full bg-admin-bg"
            key={location.pathname + location.search}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
          <Routes>
            <Route
              index
              element={
                <>
                  <AdminOverviewCards
                    total={total}
                    pending={pending}
                    resolved={resolved}
                    highPriority={highPriority}
                    activeDepts={activeDepts}
                  />
                  <AdminRecentActions
                    complaints={complaints}
                    profileSummaries={profileSummaries}
                    loading={loading}
                    onViewComplaint={handleViewComplaint}
                  />
                  <div className="mt-6">
                    <NavLink
                      to="/admin/complaints"
                      className="admin-link-accent inline-flex items-center gap-2 hover:underline"
                    >
                      View all complaints
                      <span className="material-symbols-outlined text-lg text-sky-400">arrow_forward</span>
                    </NavLink>
                  </div>
                </>
              }
            />
            <Route
              path="complaints"
              element={
                <AdminComplaintsTable
                  complaints={complaints}
                  profileSummaries={profileSummaries}
                  loading={loading}
                  searchQuery={searchQuery}
                  statusFilter={statusFilter}
                  pulseRowId={pulseRowId}
                  onViewComplaint={handleViewComplaint}
                />
              }
            />
            <Route path="alerts" element={<Navigate to="/admin/complaints?status=pending" replace />} />
            <Route path="staff" element={<AdminStaffView departmentsList={departments} />} />
            <Route path="config" element={<AdminConfigView departmentsList={departments} />} />
            <Route path="addon" element={<Navigate to="/admin/categories-departments" replace />} />
            <Route path="categories-departments" element={<AdminAddonPage />} />
            <Route
              path="reports"
              element={<AdminReportsView complaints={complaints} loading={loading} departmentsList={departments} />}
            />
            <Route path="profile" element={<AdminProfileView />} />
          </Routes>
          </motion.div>
          <AdminComplaintDrawer
            open={detailOpen}
            onClose={() => setDetailOpen(false)}
            detail={detail}
            loading={detailLoading}
            error={detailError}
            attachmentUrls={attachmentUrls}
            assignableDepartments={assignableDepartments}
            onAssign={handleAssign}
            onStatusChange={handleStatusChange}
            updatingId={updatingId}
            studentDisplayName={
              detail
                ? detail.is_anonymous
                  ? 'Anonymous'
                  : formatProfileForAdminDrawer(profileSummaries[detail.user_id], false)
                : ''
            }
          />
        </div>
      </main>
      <AdminBottomNav />
    </div>
  )
}
