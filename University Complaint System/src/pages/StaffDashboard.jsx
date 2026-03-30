import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { StaffSidebar } from '../components/Sidebar'
import { Header } from '../components/Header'
import { ProfilePageLayout } from '../components/ProfilePageLayout.jsx'
import { StatusBadge, PriorityBadge } from '../components/StatusBadge'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useLocation, useNavigate, NavLink, Routes, Route, useSearchParams } from 'react-router-dom'
import {
  fetchComplaints,
  fetchComplaintById,
  fetchProfileSummaries,
  updateComplaint,
  addResponse,
  getFileUrl,
  getFileAccessUrl,
  subscribeComplaints
} from '../lib/complaints.js'
import {
  fetchStaffNotificationsForCurrentUser,
  subscribeStaffNotifications,
  countUnreadStaffNotifications
} from '../lib/staffNotifications.js'
import { StaffNotificationPanel, StaffNotificationsPageView } from '../components/StaffNotificationPanel.jsx'
import { useReferenceData } from '../contexts/ReferenceDataContext.jsx'
import {
  getProfileDisplayName,
  getProfileSecondaryLabel,
  formatProfileForAdminDrawer
} from '../lib/profileDisplay.js'
import { supabase } from '../lib/supabaseClient.js'
import { getLastDepartmentRoutedBy } from '../lib/complaintActors.js'
import {
  getStaffDisplayStatus,
  isComplaintOverdue,
  isResolvedLike,
  formatCountdown,
  sortStaffComplaints,
  computeOnTimeRate,
  weeklyResolvedCounts,
  monthlyResolvedCounts
} from '../lib/staffUtils.js'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { AnimatedCounter } from '../components/ui/AnimatedCounter.jsx'
import {
  StaffStatCardsSkeleton,
  StaffComplaintListSkeleton,
  TableRowsSkeleton
} from '../components/ui/Skeleton.jsx'
import { ComplaintConversation } from '../components/ComplaintConversation.jsx'

const staffArchivedStaggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } }
}
const staffArchivedStaggerRow = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 30 } }
}

const staffHeadingMainClass =
  'inline-flex items-center gap-2 rounded-lg border border-sky-400/25 bg-sky-500/[0.07] px-3 py-1 text-lg font-extrabold tracking-tight bg-gradient-to-r from-sky-200 via-violet-200 to-fuchsia-200 bg-clip-text text-transparent drop-shadow-[0_0_16px_rgba(56,189,248,0.26)]'
const staffHeadingSectionClass =
  'inline-flex items-center gap-2 rounded-md border border-sky-400/20 bg-sky-500/[0.06] px-2.5 py-1 text-sm font-bold tracking-tight bg-gradient-to-r from-sky-200 via-violet-200 to-fuchsia-200 bg-clip-text text-transparent'

const MOCK_STUDENT_SUMMARIES = {
  u1: { full_name: 'Ahmed Khan', role: 'student', department: '', registration_number: 'FA24-BCS-101' },
  u2: { full_name: 'Sara Ali', role: 'student', department: '', registration_number: 'FA24-BCE-045' }
}

const MOCK_LIST = [
  {
    id: '1024',
    title: 'WiFi connectivity in Block C',
    description: 'The internet has been intermittent...',
    priority: 'high',
    status: 'assigned',
    user_id: 'u1',
    is_anonymous: false,
    assigned_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    due_at: new Date(Date.now() + 3 * 86400000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '1021',
    title: 'Broken Lab Equipment - Room 402',
    description: 'Microscope #12 has a faulty adjustment knob.',
    priority: 'medium',
    status: 'in_progress',
    user_id: 'u2',
    is_anonymous: false,
    assigned_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    due_at: new Date(Date.now() - 86400000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

function normalizeAssignmentDatesForDisplay(complaint) {
  if (!complaint) return complaint
  const fallbackAssignedAt =
    complaint.assigned_at || (complaint.status === 'assigned' && complaint.created_at ? complaint.created_at : null)
  if (!fallbackAssignedAt) return complaint
  const assignedTs = new Date(fallbackAssignedAt).getTime()
  if (Number.isNaN(assignedTs)) return complaint
  return {
    ...complaint,
    assigned_at: fallbackAssignedAt,
    due_at: complaint.due_at || new Date(assignedTs + 7 * 24 * 60 * 60 * 1000).toISOString()
  }
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

function DeadlineCountdown({ dueAt, overdue }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className={overdue ? 'font-semibold text-red-400' : 'text-slate-400'}>
      {formatCountdown(dueAt)}
    </span>
  )
}

function StaffProfilePage({ complaints = [], department }) {
  const { user, profile, updateProfile } = useAuth()
  const { showToast } = useToast()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileErr, setProfileErr] = useState('')

  useEffect(() => {
    setFullName(profile?.full_name || '')
  }, [profile?.full_name])

  const displayName = profile?.full_name || profile?.department || 'Staff'

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setProfileErr('')
    if (!fullName.trim()) {
      setProfileErr('Name is required.')
      return
    }
    setSavingProfile(true)
    const { error } = await updateProfile({ full_name: fullName.trim() })
    setSavingProfile(false)
    if (error) {
      setProfileErr(error.message || 'Update failed.')
      showToast('Could not update profile.', 'error')
      return
    }
    showToast('Profile updated.', 'success')
  }

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
      setPwdError('No user email found.')
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
      variant="portal"
      roleBadge="Faculty / Department staff"
      title={displayName}
      subtitle={`Department: ${department || '—'}. Update your name, password, and review assigned complaint stats.`}
    >
      <div className="admin-panel-static overflow-hidden transition-shadow duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover">
        <div className="border-b border-slate-700/80 bg-[#0c1424] px-6 py-4">
          <h2 className={staffHeadingMainClass}>
            <span className="material-symbols-outlined text-sky-300">badge</span>
            Personal info
          </h2>
          <p className="mt-0.5 text-xs capitalize text-slate-500">Role: staff</p>
        </div>
        <div className="px-6 py-4">
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="admin-input text-sm"
              />
            </div>
            {profileErr && <p className="text-sm text-red-400">{profileErr}</p>}
            <button
              type="submit"
              disabled={savingProfile}
              className="admin-gradient-btn text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile ? 'Saving...' : 'Save changes'}
            </button>
          </form>
        </div>

        <div className="border-t border-slate-700/80 bg-[#0c1424] px-6 py-4">
          <h3 className={`mb-3 ${staffHeadingSectionClass}`}>
            <span className="material-symbols-outlined text-amber-300">lock</span>
            Change password
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="admin-input text-sm"
              placeholder="Current password"
              autoComplete="current-password"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="admin-input text-sm"
              placeholder="New password"
              autoComplete="new-password"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="admin-input text-sm"
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
            {pwdError && <p className="text-sm text-red-400">{pwdError}</p>}
            <button
              type="submit"
              disabled={pwdSaving}
              className="admin-gradient-btn w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pwdSaving ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </ProfilePageLayout>
  )
}

const STAFF_TASKS_STATUS_PARAMS = ['all', 'pending', 'in_progress', 'overdue', 'resolved']

function StaffDashboardHome({ complaints, loading, penaltyPoints }) {
  const total = complaints.length
  const pending = complaints.filter((c) => getStaffDisplayStatus(c) === 'Pending').length
  const inProg = complaints.filter((c) => c.status === 'in_progress').length
  const resolved = complaints.filter((c) => isResolvedLike(c)).length
  const overdue = complaints.filter((c) => isComplaintOverdue(c)).length

  const cardInner =
    'admin-panel-static flex h-full items-start gap-3 p-4 transition-all duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover'

  const cards = [
    { label: 'Total assigned', value: total, icon: 'assignment', color: 'bg-sky-500/15 text-sky-300', to: '/staff/tasks' },
    { label: 'Pending', value: pending, icon: 'schedule', color: 'bg-amber-500/15 text-amber-300', to: '/staff/tasks?status=pending' },
    { label: 'In progress', value: inProg, icon: 'progress_activity', color: 'bg-sky-500/15 text-sky-300', to: '/staff/tasks?status=in_progress' },
    { label: 'Resolved', value: resolved, icon: 'check_circle', color: 'bg-emerald-500/15 text-emerald-300', to: '/staff/tasks?status=resolved' },
    { label: 'Overdue', value: overdue, icon: 'event_busy', color: 'bg-red-500/15 text-red-300', to: '/staff/tasks?status=overdue' },
    { label: 'Penalty points', value: penaltyPoints ?? 0, icon: 'gavel', color: 'bg-violet-500/15 text-violet-300', to: '/staff/reports' }
  ]
  const recentResolved = [...complaints]
    .filter((c) => isResolvedLike(c))
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
    .slice(0, 5)
  const urgentOpen = [...complaints]
    .filter((c) => !isResolvedLike(c))
    .sort((a, b) => new Date(a.due_at || a.created_at || 0) - new Date(b.due_at || b.created_at || 0))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h2 className={staffHeadingMainClass}>
          <span className="material-symbols-outlined text-sky-300">dashboard</span>
          Dashboard
        </h2>
        <p className="mt-1 text-sm text-slate-400">Overview of complaints assigned to your department.</p>
      </div>
      {loading ? (
        <StaffStatCardsSkeleton count={6} variant="portal" />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {cards.map(({ label, value, icon, color, to }) => (
            <NavLink key={label} to={to} className="block">
              <motion.div
                className={cardInner}
                whileHover={{ y: -5, boxShadow: '0 12px 40px -12px rgba(56, 189, 248, 0.15)' }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-white/10 ${color}`}>
                  <span className="material-symbols-outlined">{icon}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                  <p className="text-2xl font-bold text-slate-100">
                    <AnimatedCounter value={value} />
                  </p>
                </div>
              </motion.div>
            </NavLink>
          ))}
        </div>
      )}
      <NavLink
        to="/staff/tasks"
        className="admin-link-accent inline-flex items-center gap-2 text-sm font-medium"
      >
        Open My Assigned Complaints
        <span className="material-symbols-outlined text-lg">arrow_forward</span>
      </NavLink>

      {!loading && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="admin-panel-static p-5 transition-shadow duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className={staffHeadingSectionClass}>
                <span className="material-symbols-outlined text-emerald-300">task_alt</span>
                Recent Resolved
              </h3>
              <NavLink to="/staff/tasks?status=resolved" className="text-xs font-semibold text-sky-300 hover:text-sky-200">
                View all
              </NavLink>
            </div>
            {recentResolved.length === 0 ? (
              <p className="text-sm text-slate-500">No resolved complaints yet.</p>
            ) : (
              <ul className="space-y-2">
                {recentResolved.map((c) => (
                  <li key={c.id} className="rounded-xl border border-slate-700/60 bg-[#0c1424] px-3 py-2.5">
                    <p className="truncate text-sm font-semibold text-slate-100">{c.title}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      #{String(c.id).slice(0, 8)} • {formatDate(c.updated_at || c.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="admin-panel-static p-5 transition-shadow duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className={staffHeadingSectionClass}>
                <span className="material-symbols-outlined text-amber-300">schedule</span>
                Priority Queue
              </h3>
              <NavLink to="/staff/tasks?status=overdue" className="text-xs font-semibold text-sky-300 hover:text-sky-200">
                Open tasks
              </NavLink>
            </div>
            {urgentOpen.length === 0 ? (
              <p className="text-sm text-slate-500">No active complaints.</p>
            ) : (
              <ul className="space-y-2">
                {urgentOpen.map((c) => (
                  <li key={c.id} className="rounded-xl border border-slate-700/60 bg-[#0c1424] px-3 py-2.5">
                    <p className="truncate text-sm font-semibold text-slate-100">{c.title}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Due {formatDate(c.due_at)} • {getStaffDisplayStatus(c)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StaffArchivedView({ complaints, profileSummaries, loading }) {
  const resolved = complaints.filter((c) => isResolvedLike(c))
  const sorted = sortStaffComplaints(resolved, 'created')

  return (
    <div className="space-y-4">
      <h2 className={staffHeadingMainClass}>
        <span className="material-symbols-outlined text-emerald-300">inventory</span>
        Resolved history
      </h2>
      <p className="text-sm text-slate-400">All complaints you resolved or that are closed in your department.</p>
      <div className="admin-panel-static overflow-hidden transition-shadow duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="admin-table-head">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Resolved</th>
                </tr>
              </thead>
              <TableRowsSkeleton rows={6} columns={4} variant="portal" />
            </table>
          </div>
        ) : sorted.length === 0 ? (
          <p className="p-8 text-center text-slate-500">No resolved complaints yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="admin-table-head">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Resolved</th>
                </tr>
              </thead>
              <motion.tbody
                key={sorted.length}
                variants={staffArchivedStaggerParent}
                initial="hidden"
                animate="show"
              >
                {sorted.map((c) => (
                  <motion.tr
                    key={c.id}
                    variants={staffArchivedStaggerRow}
                    className="admin-table-row text-slate-200"
                    whileHover={{ y: -2 }}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">#{String(c.id).slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      {c.is_anonymous ? (
                        'Anonymous'
                      ) : (
                        <div className="min-w-0">
                          <div className="font-medium text-slate-100">
                            {getProfileDisplayName(profileSummaries[c.user_id])}
                          </div>
                          {getProfileSecondaryLabel(profileSummaries[c.user_id]) && (
                            <div className="text-xs text-slate-500">
                              {getProfileSecondaryLabel(profileSummaries[c.user_id])}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-100">{c.title}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(c.updated_at)}</td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StaffReportsView({ complaints, penaltyPoints }) {
  const resolved = complaints.filter((c) => isResolvedLike(c))
  const onTimePct = computeOnTimeRate(resolved)
  const weekly = weeklyResolvedCounts(resolved, 8)
  const monthly = monthlyResolvedCounts(resolved, 6)

  const chartTooltip = {
    contentStyle: {
      backgroundColor: '#111827',
      border: '1px solid rgba(71,85,105,0.65)',
      borderRadius: '8px',
      color: '#e2e8f0',
      fontSize: '12px'
    }
  }

  return (
    <div className="space-y-6">
      <h2 className={staffHeadingMainClass}>
        <span className="material-symbols-outlined text-violet-300">analytics</span>
        Performance
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="admin-panel-static p-5 transition-shadow duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover">
          <p className="text-xs font-semibold uppercase text-slate-500">Penalty points</p>
          <p className="mt-1 text-3xl font-bold text-slate-100">
            <AnimatedCounter value={penaltyPoints ?? 0} />
          </p>
          <p className="mt-2 text-xs text-slate-500">Added when a complaint is marked resolved after the deadline.</p>
        </div>
        <div className="admin-panel-static p-5 transition-shadow duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover">
          <p className="text-xs font-semibold uppercase text-slate-500">On-time completion</p>
          <p className="mt-1 text-3xl font-bold text-emerald-400">
            <AnimatedCounter value={onTimePct} />%
          </p>
          <p className="mt-2 text-xs text-slate-500">Share of resolved complaints closed on or before due date.</p>
        </div>
      </div>

      <div className="admin-panel-static p-5 transition-shadow duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover">
        <h3 className={`mb-4 ${staffHeadingSectionClass}`}>
          <span className="material-symbols-outlined text-sky-300">bar_chart</span>
          Weekly resolved (last 8 weeks)
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" className="opacity-40" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Resolved" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="admin-panel-static p-5 transition-shadow duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover">
        <h3 className={`mb-4 ${staffHeadingSectionClass}`}>
          <span className="material-symbols-outlined text-fuchsia-300">stacked_line_chart</span>
          Monthly resolved (last 6 months)
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" className="opacity-40" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="count" fill="#a78bfa" radius={[4, 4, 0, 0]} name="Resolved" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function StaffTasksView({
  complaints,
  profileSummaries,
  loading,
  user,
  profile,
  updateProfile,
  showToast,
  load,
  searchQuery,
  unreadOnly,
  isUnread,
  categories
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [sortBy, setSortBy] = useState('deadline')
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [statusUpdate, setStatusUpdate] = useState('in_progress')
  const [categoryUpdate, setCategoryUpdate] = useState('')
  const [responseFiles, setResponseFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [replyBusy, setReplyBusy] = useState(false)
  const [attachmentUrls, setAttachmentUrls] = useState({})
  const openIdParam = (searchParams.get('openId') || '').trim()

  const routedBy = useMemo(() => getLastDepartmentRoutedBy(detail), [detail])

  useEffect(() => {
    const raw = (new URLSearchParams(location.search).get('status') || 'all').trim()
    const next = STAFF_TASKS_STATUS_PARAMS.includes(raw) ? raw : 'all'
    setFilterStatus((prev) => (prev === next ? prev : next))
  }, [location.pathname, location.search])

  function setStatusFilterAndUrl(next) {
    setFilterStatus(next)
    const params = new URLSearchParams(location.search)
    if (next === 'all') params.delete('status')
    else params.set('status', next)
    const q = params.toString()
    navigate(q ? `/staff/tasks?${q}` : '/staff/tasks', { replace: true })
  }

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let cancelled = false
    fetchComplaintById(selectedId).then(({ data }) => {
      if (!cancelled) setDetail(normalizeAssignmentDatesForDisplay(data))
    })
    return () => { cancelled = true }
  }, [selectedId])

  useEffect(() => {
    if (!openIdParam) return
    const exists = (complaints || []).some((c) => String(c.id) === String(openIdParam))
    if (exists) setSelectedId(openIdParam)
  }, [openIdParam, complaints])

  useEffect(() => {
    if (!detail?.id) return
    const st = detail.status
    if (st === 'in_progress') setStatusUpdate('in_progress')
    else if (isResolvedLike(detail)) setStatusUpdate('resolved')
    else setStatusUpdate('in_progress')
    setCategoryUpdate('')
  }, [detail?.id, detail?.status])

  useEffect(() => {
    let cancelled = false
    async function loadUrls() {
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
    loadUrls()
    return () => { cancelled = true }
  }, [detail?.id, detail?.attachments])

  const filtered = useMemo(() => {
    const q = (searchQuery || '').toLowerCase()
    let list = complaints.filter((c) => {
      const summary = c.is_anonymous ? null : profileSummaries[c.user_id]
      const profileBlob = c.is_anonymous
        ? 'anonymous'
        : [getProfileDisplayName(summary), summary?.registration_number, summary?.department]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
      const matchSearch =
        (c.title || '').toLowerCase().includes(q) ||
        (c.id || '').toString().toLowerCase().includes(q) ||
        profileBlob.includes(q)
      if (!matchSearch) return false
      if (unreadOnly) return isUnread(c)
      return true
    })

    if (filterPriority !== 'all') {
      list = list.filter((c) => (c.priority || 'medium') === filterPriority)
    }
    if (filterStatus === 'pending') {
      list = list.filter((c) => getStaffDisplayStatus(c) === 'Pending')
    } else if (filterStatus === 'in_progress') {
      list = list.filter((c) => c.status === 'in_progress')
    } else if (filterStatus === 'overdue') {
      list = list.filter((c) => isComplaintOverdue(c))
    } else if (filterStatus === 'resolved') {
      list = list.filter((c) => isResolvedLike(c))
    }

    return sortStaffComplaints(list, sortBy)
  }, [complaints, profileSummaries, searchQuery, unreadOnly, filterStatus, filterPriority, sortBy, isUnread])

  const selected = detail || (selectedId ? complaints.find((c) => c.id === selectedId) : null)

  async function handleFacultyReply(body) {
    if (!selectedId || !supabase || !user?.id) return
    setReplyBusy(true)
    try {
      const { error } = await addResponse({
        complaintId: selectedId,
        userId: user.id,
        body,
        senderRole: 'faculty'
      })
      if (error) {
        showToast(error.message || 'Failed to send message.', 'error')
        return
      }
      showToast('Message sent.', 'success')
      fetchComplaintById(selectedId).then(({ data }) => setDetail(normalizeAssignmentDatesForDisplay(data)))
      load()
    } finally {
      setReplyBusy(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedId || !supabase || !user?.id) return
    setSubmitting(true)
    try {
      const overdueBefore = selected?.due_at && new Date(selected.due_at).getTime() < Date.now() && !isResolvedLike(selected)
      if (statusUpdate) await updateComplaint(selectedId, { status: statusUpdate, ...(categoryUpdate && { category: categoryUpdate }) })
      if (responseFiles.length) {
        const { error: fileErr } = await addResponse({
          complaintId: selectedId,
          userId: user.id,
          body: '(No comment)',
          files: responseFiles.slice(0, 1),
          senderRole: 'faculty'
        })
        if (fileErr) {
          showToast(fileErr.message || 'Failed to attach file.', 'error')
          return
        }
      }
      if (statusUpdate === 'resolved' && overdueBefore) {
        const currentPts = profile?.penalty_points ?? 0
        const { error: pe } = await updateProfile({ penalty_points: currentPts + 10 })
        if (!pe) {
          showToast('Resolved after deadline — +10 penalty points recorded.', 'error')
        }
      } else if (statusUpdate === 'resolved') {
        showToast('Complaint marked resolved.', 'success')
      }
      setResponseFiles([])
      fetchComplaintById(selectedId).then(({ data }) => setDetail(normalizeAssignmentDatesForDisplay(data)))
      load()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <h2 className={staffHeadingMainClass}>
          <span className="material-symbols-outlined text-sky-300">assignment</span>
          My Assigned Complaints
        </h2>
        {unreadOnly && (
          <div className="flex flex-col gap-2 rounded-xl border border-slate-700/70 bg-[#0a1222] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-300">Showing unread tasks only.</p>
            <button
              type="button"
              onClick={() => navigate('/staff/tasks')}
              className="admin-gradient-btn inline-flex items-center justify-center gap-2 px-4 py-2 text-sm shadow-lg shadow-sky-900/20"
            >
              View all
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setStatusFilterAndUrl(e.target.value)}
            className="admin-select w-auto min-w-[9rem] text-sm"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="overdue">Overdue</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="admin-select w-auto min-w-[9rem] text-sm"
          >
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="admin-select w-auto min-w-[10rem] text-sm"
          >
            <option value="deadline">Sort: deadline</option>
            <option value="created">Sort: created date</option>
            <option value="assigned">Sort: assigned date</option>
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 xl:col-span-4 space-y-3">
          <h3 className={`px-1 ${staffHeadingSectionClass}`}>
            <span className="material-symbols-outlined text-sky-300">list</span>
            List
          </h3>
          {loading ? (
            <StaffComplaintListSkeleton count={5} variant="portal" />
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {filtered.map((c) => {
                const disp = getStaffDisplayStatus(c)
                const od = isComplaintOverdue(c)
                return (
                  <motion.button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    whileHover={{ scale: 1.015, y: -2 }}
                    whileTap={{ scale: 0.992 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                    className={`w-full rounded-xl border-2 p-4 text-left shadow-md transition-all duration-300 hover:border-slate-600/60 hover:shadow-lg ${
                      selectedId === c.id
                        ? 'border-sky-500/60 bg-sky-500/[0.08] ring-2 ring-sky-500/25'
                        : 'border-slate-700/60 bg-admin-card'
                    } ${od ? 'border-red-500/40 bg-red-500/[0.06]' : ''}`}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <PriorityBadge priority={c.priority} variant="portal" />
                      <span className="shrink-0 text-xs text-slate-500">{formatDate(c.created_at)}</span>
                    </div>
                    <p className="line-clamp-1 font-bold text-slate-100">{c.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {c.is_anonymous
                        ? 'Anonymous'
                        : formatProfileForAdminDrawer(profileSummaries[c.user_id], false)}{' '}
                      • #{String(c.id).slice(0, 8)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded px-2 py-0.5 font-medium ${
                          od ? 'bg-red-500/15 text-red-300 ring-1 ring-red-500/25' : 'bg-slate-600/30 text-slate-300'
                        }`}
                      >
                        {disp}
                      </span>
                      <span className="text-slate-500">
                        Due: <DeadlineCountdown dueAt={c.due_at} overdue={od} />
                      </span>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}
          {!loading && filtered.length === 0 && <p className="text-sm text-slate-500">No complaints match filters.</p>}
        </div>

        <div className="lg:col-span-7 xl:col-span-8">
          <div className="admin-panel-static flex min-h-[500px] flex-col overflow-hidden transition-shadow duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover">
            {!selected ? (
              <div className="flex flex-1 items-center justify-center p-8 text-slate-500">
                Select a complaint for full details and status updates.
              </div>
            ) : (
              <>
                <div className="border-b border-slate-700/80 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-sky-500/15 px-2 py-0.5 text-xs font-bold text-sky-300 ring-1 ring-sky-500/30">
                          #{String(selected.id).slice(0, 8)}
                        </span>
                        <StatusBadge status={selected.status} variant="portal" />
                        {isComplaintOverdue(selected) && (
                          <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-300 ring-1 ring-red-500/30">
                            OVERDUE
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-bold text-slate-100 md:text-2xl">{selected.title}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Student:{' '}
                        {selected.is_anonymous
                          ? 'Anonymous'
                          : formatProfileForAdminDrawer(profileSummaries[selected.user_id], false)}{' '}
                        • Created {formatDate(selected.created_at)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 border-b border-slate-700/80 bg-[#0c1424] p-6 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-slate-500">Assigned</span>
                    <p className="font-medium text-slate-200">{formatDate(selected.assigned_at)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Deadline</span>
                    <p className={`font-medium text-slate-200 ${isComplaintOverdue(selected) ? 'text-red-400' : ''}`}>
                      {formatDate(selected.due_at)}
                      {selected.due_at && (
                        <span className="mt-0.5 block text-xs">
                          <DeadlineCountdown dueAt={selected.due_at} overdue={isComplaintOverdue(selected)} />
                        </span>
                      )}
                    </p>
                  </div>
                  {isResolvedLike(selected) && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-500">Student rating</span>
                      {detail?.rating?.rating ? (
                        <div className="mt-1 flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span
                              key={i}
                              className={`material-symbols-outlined text-base ${
                                i < Number(detail.rating.rating) ? 'text-amber-300' : 'text-slate-600'
                              }`}
                            >
                              {i < Number(detail.rating.rating) ? 'star' : 'star_border'}
                            </span>
                          ))}
                          <span className="ml-1 text-xs font-semibold text-slate-300">{detail.rating.rating}/5</span>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">Not rated yet</p>
                      )}
                    </div>
                  )}
                </div>

                {detail?.assigned_department && routedBy.assignerLabel && (
                  <div className="border-b border-slate-700/80 bg-[#0c1424]/80 px-6 py-3 text-sm">
                    <span className="text-slate-500">Assigned by </span>
                    <span className="font-semibold text-slate-100">{routedBy.assignerLabel}</span>
                    {routedBy.at && <span className="ml-2 text-xs text-slate-500">· {formatDate(routedBy.at)}</span>}
                  </div>
                )}

                <div className="max-h-[min(70vh,560px)] flex-1 space-y-6 overflow-y-auto p-6">
                  <section>
                    <h4 className={`mb-2 ${staffHeadingSectionClass}`}>
                      <span className="material-symbols-outlined text-sky-300">description</span>
                      Description
                    </h4>
                    <p className="whitespace-pre-line text-slate-400">{selected.description}</p>
                  </section>
                  <section>
                    <h4 className={`mb-3 ${staffHeadingSectionClass}`}>
                      <span className="material-symbols-outlined text-amber-300">attach_file</span>
                      Attachments
                    </h4>
                    <div className="space-y-3">
                      {(detail?.attachments || []).length === 0 && (
                        <p className="text-sm text-slate-500">No attachments.</p>
                      )}
                      {(detail?.attachments || []).filter((a) => !a.response_id).length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Student uploaded</p>
                          <div className="flex flex-wrap gap-4">
                            {(detail?.attachments || []).filter((a) => !a.response_id).map((a) => (
                              <a
                                key={a.id}
                                href={attachmentUrls[a.id] || getFileUrl(a.file_path) || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex max-w-[16rem] items-center gap-3 rounded-lg border border-slate-700/60 bg-[#0c1424] p-3 transition-colors duration-200 hover:border-sky-500/40 hover:bg-sky-500/[0.06]"
                              >
                                <span className="material-symbols-outlined text-sky-400">description</span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-bold text-slate-200">{a.file_name}</p>
                                  <p className="text-[10px] text-slate-500">{formatSize(a.file_size)}</p>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                  <section className="border-t border-slate-700/80 pt-4">
                    <h4 className={`mb-3 ${staffHeadingSectionClass}`}>
                      <span className="material-symbols-outlined text-violet-300">forum</span>
                      Conversation
                    </h4>
                    <ComplaintConversation
                      responses={detail?.responses || []}
                      actorNames={detail?.actor_names || {}}
                      currentUserId={user?.id}
                      currentUserRole="faculty"
                      onReply={handleFacultyReply}
                      loading={replyBusy}
                    />
                  </section>
                </div>

                <div className="rounded-b-2xl border-t border-slate-700/80 bg-[#0c1424] p-6">
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Update status</label>
                        <select
                          value={statusUpdate}
                          onChange={(e) => setStatusUpdate(e.target.value)}
                          className="admin-select w-full text-sm"
                        >
                          <option value="assigned">Pending (assigned)</option>
                          <option value="in_progress">In progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Flow: pending → in progress → resolved. Overdue is shown when past deadline.
                        </p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Category</label>
                        <select
                          value={categoryUpdate || selected.category}
                          onChange={(e) => setCategoryUpdate(e.target.value)}
                          className="admin-select w-full text-sm"
                        >
                          {(categories || []).map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex cursor-pointer items-center gap-1 text-xs font-bold text-slate-500 transition-colors hover:text-slate-400">
                        <span className="material-symbols-outlined text-base">attach_file</span>
                        Attach file (one)
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => setResponseFiles(Array.from(e.target.files || []).slice(0, 1))}
                        />
                      </label>
                      {responseFiles.length > 0 && <span className="text-xs text-slate-500">{responseFiles[0]?.name}</span>}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="admin-gradient-btn text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {submitting ? 'Saving...' : 'Update complaint'}
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function StaffDashboard() {
  const { user, profile, updateProfile } = useAuth()
  const { categories } = useReferenceData()
  const { showToast } = useToast()
  const [allComplaints, setAllComplaints] = useState([])
  const [profileSummaries, setProfileSummaries] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [staffNotifs, setStaffNotifs] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifError, setNotifError] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()
  const department = profile?.department || 'IT'

  const unreadOnly = new URLSearchParams(location.search).get('unread') === '1'
  const staffLastSeenAt = Number(sessionStorage.getItem('staffLastSeenAt') || 0)
  const isUnread = useCallback((c) => {
    const created = c?.created_at ? Date.parse(c.created_at) : 0
    const updated = c?.updated_at ? Date.parse(c.updated_at) : 0
    return Math.max(created, updated) > staffLastSeenAt
  }, [staffLastSeenAt])

  const load = useCallback(async () => {
    if (!supabase || !department) {
      setAllComplaints(MOCK_LIST)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await fetchComplaints({
      role: 'staff',
      department
    })
    setLoading(false)
    if (error) {
      setAllComplaints([])
      return
    }
    setAllComplaints((data || []).map(normalizeAssignmentDatesForDisplay))
  }, [department])

  const loadNotifications = useCallback(async () => {
    if (!supabase || !user?.id) {
      setStaffNotifs([])
      setNotifError(null)
      return
    }
    setNotifLoading(true)
    const { data, error } = await fetchStaffNotificationsForCurrentUser()
    setNotifLoading(false)
    setStaffNotifs(data || [])
    setNotifError(error && !error.message?.includes('Not signed in') ? error : null)
  }, [user?.id])

  useEffect(() => {
    if (supabase && department) {
      load()
      return subscribeComplaints(load)
    }
    setAllComplaints(MOCK_LIST)
    setLoading(false)
  }, [load, department])

  useEffect(() => {
    const ids = [...new Set((allComplaints || []).filter((c) => !c.is_anonymous).map((c) => c.user_id).filter(Boolean))]
    if (!ids.length) return
    if (!supabase || !department) {
      setProfileSummaries((prev) => ({ ...MOCK_STUDENT_SUMMARIES, ...prev }))
      return
    }
    fetchProfileSummaries(ids).then((map) => setProfileSummaries((prev) => ({ ...prev, ...map })))
  }, [allComplaints, supabase, department])

  useEffect(() => {
    if (!supabase || !user?.id) {
      setStaffNotifs([])
      return
    }
    loadNotifications()
    return subscribeStaffNotifications(user.id, () => loadNotifications())
  }, [user?.id, loadNotifications])

  useEffect(() => {
    if (unreadOnly) {
      sessionStorage.setItem('staffLastSeenAt', String(Date.now()))
    }
  }, [unreadOnly])

  const newCount = countUnreadStaffNotifications(staffNotifs)
  const penaltyPoints = profile?.penalty_points ?? 0

  const headerTitle = useMemo(() => {
    const p = location.pathname
    if (p.endsWith('/profile')) return 'Profile & Settings'
    if (p.includes('/reports')) return 'Performance & Reports'
    if (p.includes('/archived')) return 'Complaint History'
    if (p.includes('/notifications')) return 'Notifications'
    if (p.includes('/tasks')) return 'My Assigned Complaints'
    return 'Staff Dashboard'
  }, [location.pathname])

  const openComplaintFromNotif = useCallback((complaintId) => {
    setNotifOpen(false)
    const id = String(complaintId || '').trim()
    if (!id) return
    navigate(`/staff/tasks?openId=${id}`)
  }, [navigate])

  return (
    <div className="portal-app flex h-screen overflow-hidden">
      <StaffSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-admin-bg">
        <Header
          variant="portal"
          title={headerTitle}
          showSearch
          searchPlaceholder="Search complaints..."
          onSearch={setSearchQuery}
          onMenuClick={() => setSidebarOpen(true)}
          notificationCount={newCount}
          onNotificationsClick={() => {
            setNotifOpen(true)
            loadNotifications()
          }}
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <div className="min-h-full space-y-6 bg-admin-bg pb-20 md:pb-6">
            <Routes>
              <Route
                index
                element={
                  <StaffDashboardHome complaints={allComplaints} loading={loading} penaltyPoints={penaltyPoints} />
                }
              />
              <Route
                path="tasks"
                element={
                  <StaffTasksView
                    complaints={allComplaints}
                    profileSummaries={profileSummaries}
                    loading={loading}
                    user={user}
                    profile={profile}
                    updateProfile={updateProfile}
                    showToast={showToast}
                    load={load}
                    searchQuery={searchQuery}
                    unreadOnly={unreadOnly}
                    isUnread={isUnread}
                    categories={categories}
                  />
                }
              />
              <Route
                path="archived"
                element={
                  <StaffArchivedView complaints={allComplaints} profileSummaries={profileSummaries} loading={loading} />
                }
              />
              <Route
                path="reports"
                element={<StaffReportsView complaints={allComplaints} penaltyPoints={penaltyPoints} />}
              />
              <Route
                path="profile"
                element={<StaffProfilePage complaints={allComplaints} department={department} />}
              />
              <Route
                path="notifications"
                element={
                  <StaffNotificationsPageView
                    notifications={staffNotifs}
                    loading={notifLoading}
                    error={notifError}
                    onRefresh={loadNotifications}
                    onOpenComplaint={openComplaintFromNotif}
                  />
                }
              />
            </Routes>
          </div>
        </div>
      </main>

      <StaffNotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={staffNotifs}
        loading={notifLoading}
        error={notifError}
        onRefresh={loadNotifications}
        onOpenComplaint={openComplaintFromNotif}
      />

      <nav className="portal-bottom-nav scrollbar-hide fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-start gap-0.5 overflow-x-auto px-2 py-2 md:hidden">
        <NavLink
          to="/staff"
          end
          className={({ isActive }) =>
            `flex min-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-lg py-1 transition-colors duration-200 ${
              isActive ? 'font-semibold text-sky-400' : 'text-slate-500 hover:text-slate-300'
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">dashboard</span>
          <span className="text-[9px] font-bold leading-tight">Dashboard</span>
        </NavLink>
        <NavLink
          to="/staff/tasks"
          className={({ isActive }) =>
            `flex min-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-lg py-1 transition-colors duration-200 ${
              isActive ? 'font-semibold text-sky-400' : 'text-slate-500 hover:text-slate-300'
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">assignment</span>
          <span className="text-[9px] font-bold leading-tight">Complaints</span>
        </NavLink>
        <NavLink
          to="/staff/reports"
          className={({ isActive }) =>
            `flex min-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-lg py-1 transition-colors duration-200 ${
              isActive ? 'font-semibold text-sky-400' : 'text-slate-500 hover:text-slate-300'
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">analytics</span>
          <span className="text-[9px] font-bold leading-tight">Reports</span>
        </NavLink>
        <NavLink
          to="/staff/notifications"
          className={({ isActive }) =>
            `flex min-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-lg py-1 transition-colors duration-200 ${
              isActive ? 'font-semibold text-sky-400' : 'text-slate-500 hover:text-slate-300'
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          <span className="text-[9px] font-bold leading-tight">Notifs</span>
        </NavLink>
        <NavLink
          to="/staff/profile"
          className={({ isActive }) =>
            `flex min-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-lg py-1 transition-colors duration-200 ${
              isActive ? 'font-semibold text-sky-400' : 'text-slate-500 hover:text-slate-300'
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">person</span>
          <span className="text-[9px] font-bold leading-tight">Profile</span>
        </NavLink>
      </nav>
    </div>
  )
}
