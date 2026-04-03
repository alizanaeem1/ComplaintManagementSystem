import { useState, useEffect, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Routes, Route, NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { StudentSidebar } from '../components/Sidebar'
import { Header } from '../components/Header'
import { StatusBadge } from '../components/StatusBadge'
import { ProfilePageLayout } from '../components/ProfilePageLayout.jsx'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useReferenceData } from '../contexts/ReferenceDataContext.jsx'
import {
  createComplaint,
  fetchComplaints,
  subscribeComplaints,
  fetchComplaintById,
  upsertComplaintRating
} from '../lib/complaints.js'
import {
  countUnreadStudentNotifications,
  fetchStudentNotificationsForCurrentUser,
  subscribeStudentNotifications
} from '../lib/studentNotifications.js'
import { supabase } from '../lib/supabaseClient.js'
import { StudentNotificationPanel, StudentNotificationsPageView } from '../components/StudentNotificationPanel.jsx'
import { StudentComplaintDetailDrawer } from '../components/StudentComplaintDetailDrawer.jsx'
import { AnimatedCounter } from '../components/ui/AnimatedCounter.jsx'
import { TableRowsSkeleton, StatCardsSkeleton } from '../components/ui/Skeleton.jsx'

const studentTableStaggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } }
}
const studentTableStaggerRow = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } }
}

/** Main screen title — gradient highlight (student portal) */
const studentPortalTitleClass =
  'text-xl font-bold tracking-tight bg-gradient-to-r from-sky-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent sm:text-2xl'

/** Section / card titles inside student pages */
const studentPortalSectionTitleClass =
  'text-base font-bold tracking-tight bg-gradient-to-r from-sky-200 via-violet-200 to-fuchsia-200 bg-clip-text text-transparent'

/** Stronger emphasis for primary page headings */
const studentPortalMainHeadingClass =
  `${studentPortalTitleClass} drop-shadow-[0_0_20px_rgba(56,189,248,0.3)]`

const studentHeadingPillClass =
  'inline-flex items-center gap-2 rounded-lg border border-sky-400/25 bg-sky-500/[0.07] px-3 py-1'

const MOCK_COMPLAINTS = [
  {
    id: '1024',
    title: 'WiFi connectivity in Block C',
    category: 'IT',
    status: 'in_progress',
    priority: 'medium',
    description: 'Internet drops every few minutes in Block C study area. Tried restarting phone.',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString()
  },
  {
    id: '1021',
    title: 'Broken Lab Equipment - Room 402',
    category: 'Academic',
    status: 'pending',
    priority: 'medium',
    description: 'Microscope #12 adjustment knob is loose.',
    created_at: new Date(Date.now() - 5 * 3600000).toISOString()
  },
  {
    id: '1018',
    title: 'Parking pass request',
    category: 'Administration',
    status: 'assigned',
    priority: 'low',
    description: 'Need semester parking sticker for Lot B.',
    created_at: new Date(Date.now() - 3 * 3600000).toISOString()
  },
  {
    id: '1019',
    title: 'Library Cooling System',
    category: 'Administration',
    status: 'resolved',
    priority: 'medium',
    description: 'AC was not cooling on level 2. Reported during finals week.',
    created_at: new Date(Date.now() - 86400000).toISOString()
  }
]

const MY_COMPLAINT_TABS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'resolved', label: 'Resolved' }
]

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.round(diff / 86400000)} day(s) ago`
  return d.toLocaleDateString()
}

function SubmitComplaint({ onSuccess }) {
  const { categories } = useReferenceData()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [pictureUrl, setPictureUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!title.trim() || !category || !description.trim()) {
      setError('Please fill title, category, and description.')
      return
    }
    if (!user?.id) {
      setError('You must be signed in to submit a complaint.')
      return
    }
    setSubmitting(true)
    try {
      const timeout = (p, ms) =>
        Promise.race([
          p,
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error('Request timed out. Check connection and try again.')), 15000)
          )
        ])
      const { data, error: err } = await timeout(
        createComplaint({
          userId: user.id,
          title: title.trim(),
          category,
          description: description.trim(),
          pictureUrl,
          videoUrl,
          isAnonymous
        })
      )
      if (err) {
        setError(err.message || 'Failed to submit complaint.')
        return
      }
      setTitle('')
      setCategory('')
      setDescription('')
      setPictureUrl('')
      setVideoUrl('')
      setIsAnonymous(false)
      showToast('Complaint submitted successfully.', 'success')
      onSuccess?.()
      navigate('/student')
    } catch (e) {
      setError(e?.message || 'Failed to submit complaint.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className={studentPortalTitleClass}>
        <span className={studentHeadingPillClass}>
          <span className="material-symbols-outlined text-sky-300">edit_note</span>
          Submit a complaint
        </span>
      </h2>
      <form
        className="admin-panel-static overflow-hidden p-6 space-y-4 transition-shadow duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover"
        onSubmit={handleSubmit}
      >
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="admin-input"
            placeholder="Brief title for your complaint"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="admin-select w-full"
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="admin-input min-h-[6rem]"
            placeholder="Describe your issue in detail..."
            required
          />
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Picture URL (Optional)</label>
            <input
              type="url"
              value={pictureUrl}
              onChange={(e) => setPictureUrl(e.target.value)}
              className="admin-input"
              placeholder="https://example.com/image.jpg"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Video URL (Optional)</label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="admin-input"
              placeholder="https://example.com/video.mp4"
            />
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-slate-700/60 bg-[#0c1424] px-4 py-3 transition-colors duration-200 hover:border-slate-600/80">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-600 bg-[#0f172a] text-sky-500 focus:ring-sky-500/40"
            id="anonymous"
          />
          <label htmlFor="anonymous" className="text-sm leading-relaxed text-slate-300">
            Submit anonymously (Admin/Faculty will see <span className="font-semibold text-slate-100">Anonymous</span>).
          </label>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="admin-gradient-btn flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit complaint'}
          <span className="material-symbols-outlined text-lg">send</span>
        </button>
      </form>
    </div>
  )
}

function MyComplaints({ complaints, searchQuery, loading }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [detailRow, setDetailRow] = useState(null)
  const rawStatus = (searchParams.get('status') || '').toLowerCase()
  const validTab = MY_COMPLAINT_TABS.some((t) => t.id === rawStatus && t.id !== 'all')
  const activeTab = validTab ? rawStatus : 'all'
  const openId = searchParams.get('openId')

  function clearOpenId() {
    if (!searchParams.get('openId')) return
    const params = new URLSearchParams(searchParams)
    params.delete('openId')
    setSearchParams(params, { replace: true })
  }

  function openDetail(c) {
    setDetailRow(c)
    clearOpenId()
  }

  useEffect(() => {
    if (!openId) return
    const match = (complaints || []).find((c) => String(c.id) === String(openId))
    if (match) setDetailRow(match)
  }, [openId, complaints])

  const textMatch = (c) =>
    (c.title || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
    (c.id || '').toString().toLowerCase().includes((searchQuery || '').toLowerCase())

  let filtered = complaints.filter(textMatch)
  if (activeTab === 'pending') {
    filtered = filtered.filter((c) => c.status === 'pending')
  } else if (activeTab === 'assigned') {
    filtered = filtered.filter((c) => c.status === 'assigned')
  } else if (activeTab === 'in_progress') {
    filtered = filtered.filter((c) => c.status === 'in_progress')
  } else if (activeTab === 'resolved') {
    filtered = filtered.filter((c) => c.status === 'resolved')
  }

  return (
    <div className="space-y-4">
      <h2 className={studentPortalTitleClass}>
        <span className={studentHeadingPillClass}>
          <span className="material-symbols-outlined text-sky-300">assignment</span>
          My complaints
        </span>
      </h2>

      <div className="rounded-xl border border-slate-700/70 bg-[#0c1424]/95 p-1 shadow-inner shadow-black/20">
        <div className="flex flex-wrap gap-1">
          {MY_COMPLAINT_TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id === 'all') setSearchParams({})
                  else setSearchParams({ status: tab.id })
                }}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 sm:px-4 ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-600 to-violet-600 text-white shadow-md shadow-indigo-950/50 ring-1 ring-white/10'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="admin-panel-static overflow-hidden transition-shadow duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="admin-table-head">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            {loading ? (
              <TableRowsSkeleton rows={6} columns={5} variant="portal" />
            ) : (
              <motion.tbody
                key={filtered.length + (searchQuery || '') + activeTab}
                variants={studentTableStaggerParent}
                initial="hidden"
                animate="show"
              >
                {filtered.map((c) => (
                  <motion.tr
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    variants={studentTableStaggerRow}
                    className="admin-table-row cursor-pointer text-slate-200 transition-colors hover:bg-sky-500/[0.08]"
                    whileHover={{ y: -1, transition: { duration: 0.15 } }}
                    onClick={() => openDetail(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openDetail(c)
                      }
                    }}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-400">
                      #{String(c.id).slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-100">{c.title}</td>
                    <td className="px-4 py-3 text-slate-300">{c.category}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} variant="portal" />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(c.created_at)}</td>
                  </motion.tr>
                ))}
              </motion.tbody>
            )}
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <p className="py-8 text-center text-slate-500">
            {(searchQuery || '').trim()
              ? 'No complaints match your search.'
              : activeTab === 'all'
                ? 'No complaints yet.'
                : 'No complaints in this category.'}
          </p>
        )}
      </div>

      <StudentComplaintDetailDrawer
        open={!!detailRow}
        summary={detailRow}
        onClose={() => {
          setDetailRow(null)
          clearOpenId()
        }}
      />
    </div>
  )
}

function StatusPage({ complaints, loading }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const reduceMotion = useReducedMotion()
  const statusHeadingClass =
    'inline-flex items-center gap-2 rounded-lg border border-sky-400/25 bg-sky-500/[0.07] px-3 py-1 text-base sm:text-lg font-extrabold tracking-tight bg-gradient-to-r from-sky-200 via-violet-200 to-fuchsia-200 bg-clip-text text-transparent drop-shadow-[0_0_16px_rgba(56,189,248,0.28)]'

  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)

  const [ratingValue, setRatingValue] = useState(0)
  const [ratingSaved, setRatingSaved] = useState(false)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)

  const [selectedComplaintId, setSelectedComplaintId] = useState(null)

  const sortedComplaints = [...(complaints || [])].sort(
    (a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
  )

  const activeComplaint =
    (selectedComplaintId && sortedComplaints.find((c) => String(c.id) === String(selectedComplaintId))) || sortedComplaints[0]

  const normalizedStatus = (s) => {
    const x = String(s || 'pending').toLowerCase()
    if (x === 'submitted') return 'pending'
    if (x === 'verified') return 'in_progress'
    if (x === 'closed') return 'resolved'
    return x
  }

  useEffect(() => {
    if (!sortedComplaints.length) {
      setSelectedComplaintId(null)
      return
    }
    const isValid = selectedComplaintId && sortedComplaints.some((c) => String(c.id) === String(selectedComplaintId))
    if (!isValid) setSelectedComplaintId(sortedComplaints[0]?.id ?? null)
  }, [complaints, selectedComplaintId])

  const statusKey = normalizedStatus(detail?.status ?? activeComplaint?.status)

  const summaryCounts = (() => {
    const list = complaints || []
    const next = { total: list.length, pending: 0, assigned: 0, in_progress: 0, resolved: 0 }
    list.forEach((c) => {
      const k = normalizedStatus(c.status)
      if (k in next) next[k] += 1
    })
    return next
  })()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const id = activeComplaint?.id
      if (!id) {
        setDetail(null)
        setDetailError(null)
        return
      }
      setDetailLoading(true)
      setDetailError(null)
      const { data, error } = await fetchComplaintById(id)
      if (cancelled) return
      setDetailLoading(false)
      if (error) {
        setDetailError(error.message || 'Failed to load complaint.')
        setDetail(null)
        return
      }
      setDetail(data || null)
    }

    if (!loading) load()
    return () => {
      cancelled = true
    }
  }, [activeComplaint?.id, loading])

  useEffect(() => {
    if (!detail?.id) return
    const dbRating = Number(detail?.rating?.rating || 0)
    if (Number.isFinite(dbRating) && dbRating >= 1 && dbRating <= 5) {
      setRatingValue(dbRating)
      setRatingSaved(true)
      return
    }
    setRatingValue(0)
    setRatingSaved(false)
  }, [detail?.id, detail?.rating?.rating, detail?.rating?.updated_at])

  const departmentText = detail?.assigned_department || activeComplaint?.assigned_department || 'Not assigned'

  const submitRating = () => {
    if (!detail?.id || !user?.id) return
    if (!ratingValue) return
    if (statusKey !== 'resolved') {
      showToast('Rating is available once complaint is resolved.', 'error')
      return
    }
    setRatingSubmitting(true)
    upsertComplaintRating({ complaintId: detail.id, studentId: user.id, rating: ratingValue })
      .then(async ({ error }) => {
        if (error) {
          showToast(error.message || 'Could not save rating.', 'error')
          return
        }
        setRatingSaved(true)
        showToast('Thanks for rating!', 'success')
        const { data } = await fetchComplaintById(detail.id)
        setDetail(data || null)
      })
      .finally(() => setRatingSubmitting(false))
  }

  const progress = (() => {
    const pctMap = {
      pending: 25,
      assigned: 50,
      in_progress: 75,
      resolved: 100
    }
    const labelMap = {
      pending: 'Submitted',
      assigned: 'Assigned',
      in_progress: 'In Progress',
      resolved: 'Resolved'
    }
    return {
      percent: pctMap[statusKey] ?? 0,
      stepLabel: labelMap[statusKey] ?? 'Tracking'
    }
  })()

  const trackingSteps = [
    { key: 'pending', label: 'Submitted', icon: 'inventory_2', pct: 25 },
    { key: 'assigned', label: 'Assigned', icon: 'groups', pct: 50 },
    { key: 'in_progress', label: 'In Progress', icon: 'autorenew', pct: 75 },
    { key: 'resolved', label: 'Resolved', icon: 'task_alt', pct: 100 }
  ]

  const etaText = (() => {
    const dept = String(departmentText || '').toLowerCase()
    // Heuristic ETA (UI-only). Backend is unchanged.
    if (dept.includes('it')) return 'Estimated resolution: 2-4 days'
    if (dept.includes('academic')) return 'Estimated resolution: 3-6 days'
    if (dept.includes('hostel')) return 'Estimated resolution: 2-5 days'
    if (dept.includes('administration') || dept.includes('admin')) return 'Estimated resolution: 4-8 days'
    return 'Estimated resolution: 3-7 days'
  })()

  const activityEvents = [...(detail?.status_history || [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 12)

  return (
    <div className="space-y-6">
      <h2 className={studentPortalMainHeadingClass}>
        <span className="inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-sky-300">track_changes</span>
          Complaint Status
        </span>
      </h2>

      {loading || detailLoading ? (
        <div className="space-y-3">
          <div className="h-44 animate-pulse rounded-2xl border border-slate-700/70 bg-[#0d1629]/70" />
          <div className="h-80 animate-pulse rounded-2xl border border-slate-700/70 bg-[#0d1629]/70" />
          <div className="h-40 animate-pulse rounded-2xl border border-slate-700/70 bg-[#0d1629]/70" />
        </div>
      ) : !activeComplaint ? (
        <div className="rounded-2xl border border-slate-700/70 bg-[#0d1629]/85 p-6 text-sm text-slate-500">
          No complaints found.
        </div>
      ) : (
        <>
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-2xl border border-slate-700/70 bg-[#0d1629]/85 p-5 shadow-xl shadow-black/30 backdrop-blur-sm"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className={statusHeadingClass}>
                  <span className="material-symbols-outlined text-sky-300">folder_open</span>
                  Your Cases
                </h3>
                <p className="mt-1 text-xs text-slate-500">Select a complaint to track progress and latest activity.</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{summaryCounts.total}</p>
              </div>
            </div>

            <div className="mt-4 max-h-[18rem] overflow-y-auto pr-1 student-scrollbar">
              <div className="space-y-2">
                {sortedComplaints.map((c) => {
                  const isActive = String(c.id) === String(activeComplaint?.id)
                  const st = normalizedStatus(c.status)
                  const dept = c.assigned_department || 'Not assigned'
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedComplaintId(c.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                        isActive
                          ? 'border-sky-500/35 bg-sky-500/[0.07] shadow-[0_0_24px_rgba(56,189,248,0.10)]'
                          : 'border-slate-700/60 bg-[#0a1222]/40 hover:border-sky-500/20 hover:bg-sky-500/[0.03]'
                      }`}
                      aria-label={`Track complaint ${c.title || c.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-100">{c.title || 'Complaint'}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            #{String(c.id).slice(0, 8)} • {dept}
                          </p>
                        </div>
                        <div className="shrink-0">
                          <StatusBadge status={st} variant="portal" />
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        Updated {formatDate(c.updated_at || c.created_at)}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-2xl border border-slate-700/70 bg-[#0d1629]/85 p-5 shadow-xl shadow-black/30 backdrop-blur-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-slate-100 sm:text-lg">
                  {detail?.title || activeComplaint?.title || 'Complaint'}
                </h3>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-sky-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300 ring-1 ring-sky-500/30">
                    #{String(detail?.id || activeComplaint?.id).slice(0, 8)}
                  </span>
                  <StatusBadge status={statusKey} variant="portal" />
                  <span className="inline-flex rounded bg-slate-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300 ring-1 ring-slate-600/40">
                    {departmentText}
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Submitted</p>
                <p className="mt-1 text-sm font-semibold text-slate-200">
                  {formatDate(detail?.created_at || activeComplaint?.created_at)}
                </p>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.045 }}
            className="rounded-2xl border border-slate-700/70 bg-[#0d1629]/85 p-5 shadow-xl shadow-black/30 backdrop-blur-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className={statusHeadingClass}>
                  <span className="material-symbols-outlined text-violet-200">monitoring</span>
                  Tracking Progress
                </h3>
                <p className="mt-1 text-xs text-slate-500">Like delivery tracking, updated as staff progresses your case.</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Current step</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{progress.stepLabel}</p>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">Progress</p>
                <p className="text-xs font-semibold text-slate-200">{progress.percent}%</p>
              </div>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-800/70 ring-1 ring-slate-700/50">
                <motion.div
                  initial={false}
                  animate={{
                    width: `${progress.percent}%`
                  }}
                  transition={{ duration: reduceMotion ? 0 : 0.65, ease: 'easeOut' }}
                  className={`h-full rounded-full bg-gradient-to-r ${
                    progress.percent >= 100
                      ? 'from-emerald-400/90 to-sky-300/90'
                      : progress.percent >= 75
                        ? 'from-sky-400/90 to-violet-400/85'
                        : progress.percent >= 50
                          ? 'from-violet-400/85 to-amber-300/85'
                          : 'from-amber-300/85 to-sky-300/85'
                  }`}
                />
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {trackingSteps.map((s) => {
                  const completed = progress.percent >= s.pct
                  const active = statusKey === s.key
                  return (
                    <div
                      key={s.key}
                      className={`rounded-xl border px-2.5 py-2 transition-colors ${
                        active
                          ? 'border-sky-500/40 bg-sky-500/[0.07] shadow-[0_0_18px_rgba(56,189,248,0.12)]'
                          : completed
                            ? 'border-emerald-400/20 bg-emerald-500/[0.06]'
                            : 'border-slate-700/60 bg-[#0a1222]/35'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`material-symbols-outlined rounded-lg p-1.5 text-[18px] ${
                            active
                              ? 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/30'
                              : completed
                                ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25'
                                : 'bg-slate-700/40 text-slate-500 ring-1 ring-slate-700/60'
                          }`}
                        >
                          {s.icon}
                        </span>
                        <p
                          className={`min-w-0 truncate text-[11px] font-bold tracking-wide ${
                            active ? 'text-slate-100' : completed ? 'text-emerald-200' : 'text-slate-500'
                          }`}
                        >
                          {s.label}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="mt-3 text-sm text-slate-300">{etaText}</p>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.07 }}
            className="rounded-2xl border border-slate-700/70 bg-[#0d1629]/85 p-5 shadow-xl shadow-black/30 backdrop-blur-sm"
          >
            <h3 className={statusHeadingClass}>
              <span className="material-symbols-outlined text-emerald-300">timeline</span>
              Activity
            </h3>
            <p className="mt-1 text-xs text-slate-500">Latest workflow events for your complaint.</p>

            {detailError ? (
              <p className="mt-4 text-sm text-red-400">{detailError}</p>
            ) : activityEvents.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No activity yet.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {activityEvents.map((h, idx) => {
                  const to = String(h.to_status || '').toLowerCase()
                  const actorName = detail?.actor_names?.[h.changed_by] || 'Staff'
                  const assignedDept = h.assigned_department || departmentText
                  const title =
                    to === 'assigned'
                      ? `Assigned to ${assignedDept}`
                      : to === 'in_progress' || to === 'verified'
                        ? 'In Progress'
                        : to === 'resolved'
                          ? 'Resolved'
                          : to === 'submitted' || to === 'pending'
                            ? 'Submitted'
                            : `Status: ${to.replace(/_/g, ' ')}`

                  const icon =
                    to === 'assigned'
                      ? 'groups'
                      : to === 'in_progress' || to === 'verified'
                        ? 'autorenew'
                        : to === 'resolved'
                          ? 'task_alt'
                          : to === 'submitted' || to === 'pending'
                            ? 'post_add'
                            : 'inventory_2'

                  return (
                    <motion.div
                      key={h.id || `${h.complaint_id}-${h.created_at}-${idx}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.02 }}
                      className="rounded-xl border border-slate-700/60 bg-[#0a1222]/60 px-3.5 py-3 transition-shadow hover:shadow-[0_0_24px_rgba(56,189,248,0.12)] hover:border-sky-500/20"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="material-symbols-outlined mt-0.5 rounded-lg bg-sky-500/15 p-2 text-sky-300 ring-1 ring-sky-500/30">
                            {icon}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-100">{title}</p>
                            <p className="mt-0.5 text-xs text-slate-400">By {actorName}</p>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-slate-500">{formatDate(h.created_at)}</span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.09 }}
            className="rounded-2xl border border-slate-700/70 bg-[#0d1629]/85 p-5 shadow-xl shadow-black/30 backdrop-blur-sm"
          >
            <h3 className={statusHeadingClass}>
              <span className="material-symbols-outlined text-amber-300">stars</span>
              Actions
            </h3>
            <div className="mt-3">
              <p className="text-sm text-slate-300">
                Rate your experience with this complaint.
              </p>
              {statusKey !== 'resolved' ? (
                <p className="mt-1 text-xs text-slate-500">Rating will be available after resolution.</p>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1 rounded-xl border border-slate-700/60 bg-[#0a1222] px-3 py-2">
                      {[1, 2, 3, 4, 5].map((v) => {
                        const active = v <= ratingValue
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setRatingValue(v)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-slate-700/40"
                            aria-label={`${v} star`}
                          >
                            <span
                              className={`material-symbols-outlined text-[20px] ${
                                active ? 'text-amber-300' : 'text-slate-600'
                              }`}
                            >
                              {active ? 'star' : 'star_border'}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        {ratingValue ? `${ratingValue}/5` : 'No rating yet'}
                      </p>
                      <p className="text-xs text-slate-500">{ratingSaved ? 'Saved to complaint' : 'Select stars'}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={submitRating}
                      className="btn-saas-primary"
                      disabled={!ratingValue || ratingSubmitting}
                    >
                      <span className="material-symbols-outlined text-[18px]">task_alt</span>
                      {ratingSubmitting ? 'Saving...' : 'Save Rating'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.section>
        </>
      )}
    </div>
  )
}

function ProfilePage() {
  const { user, profile, updateProfile } = useAuth()
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [registrationNumber, setRegistrationNumber] = useState(profile?.registration_number || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdError, setPwdError] = useState('')

  useEffect(() => {
    setFullName(profile?.full_name || '')
    setRegistrationNumber(profile?.registration_number || '')
  }, [profile?.full_name, profile?.registration_number])

  const displayName = profile?.full_name || 'Student'

  const handleSave = async () => {
    setError('')
    const name = (fullName || '').trim()
    if (!name) {
      setError('Name cannot be empty.')
      return
    }
    setSaving(true)
    const { error: err } = await updateProfile({
      full_name: name,
      registration_number: (registrationNumber || '').trim()
    })
    setSaving(false)
    if (err) {
      setError(err.message || 'Failed to update profile.')
      return
    }
    showToast('Profile updated successfully.', 'success')
    setEditing(false)
  }

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
      const msg = 'No user email found. Please sign in again.'
      setPwdError(msg)
      showToast(msg, 'error')
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
      setPwdError('New password and confirmation do not match.')
      return
    }

    setPwdSaving(true)
    try {
      // Re-authenticate with current password first (ensures correctness).
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      })
      if (reauthErr) {
        setPwdError(reauthErr.message || 'Current password is incorrect.')
        showToast('Failed to update password.', 'error')
        return
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword
      })
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
      setPwdError(err?.message || 'Failed to update password.')
      showToast('Failed to update password.', 'error')
    } finally {
      setPwdSaving(false)
    }
  }

  return (
    <ProfilePageLayout
      variant="portal"
      titleHighlight
      roleBadge="Student account"
      title={displayName}
      subtitle="Manage your display name, password, and account details in one place."
    >
      <div className="admin-panel-static overflow-hidden transition-shadow duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover">
        <div className="border-b border-slate-700/80 px-6 py-4">
          <h2 className={studentPortalTitleClass}>
            <span className={studentHeadingPillClass}>
              <span className="material-symbols-outlined text-sky-300">person</span>
              Profile details
            </span>
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">Edit how your name appears in the portal.</p>
        </div>
        <div className="space-y-3 p-6">
            {editing ? (
              <>
                <label className="block text-sm font-medium text-slate-300">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="admin-input"
                  placeholder="Your full name"
                  autoFocus
                />
                <label className="mt-3 block text-sm font-medium text-slate-300">Registration number</label>
                <input
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  className="admin-input"
                  placeholder="e.g. FA24-BCS-001"
                />
                <p className="text-xs text-slate-500">Admin and faculty see this with your name on complaints.</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="admin-gradient-btn disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false)
                      setFullName(profile?.full_name || '')
                      setRegistrationNumber(profile?.registration_number || '')
                      setError('')
                    }}
                    disabled={saving}
                    className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors duration-200 hover:bg-white/[0.06]"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-400">
                  <span className="font-medium text-slate-200">Display name:</span> {displayName}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  <span className="font-medium text-slate-200">Registration no.:</span>{' '}
                  {profile?.registration_number?.trim() ? profile.registration_number.trim() : '—'}
                </p>
                <p className="text-xs capitalize text-slate-500">Role: {profile?.role || 'student'}</p>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="admin-link-accent mt-2 inline-flex items-center gap-1 text-sm font-medium"
                >
                  <span className="material-symbols-outlined text-lg">edit</span>
                  Edit name
                </button>
              </>
            )}
        </div>
        {error && (
          <div className="border-t border-slate-700/80 bg-red-500/10 px-6 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        <div className="border-t border-slate-700/80 bg-[#0c1424] px-6 py-4">
          <h3 className="mb-3 flex items-center justify-between gap-3 text-sm">
            <span className={studentPortalSectionTitleClass}>Change password</span>
            <span className="text-xs font-normal text-slate-500">Requires current password</span>
          </h3>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="admin-input"
                placeholder="Enter current password"
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="admin-input"
                placeholder="Enter new password"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="admin-input"
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>

            {pwdError && <div className="text-sm text-red-400">{pwdError}</div>}

            <button
              type="submit"
              disabled={pwdSaving}
              className="admin-gradient-btn flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pwdSaving ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>
      </div>

      <div className="admin-panel-static overflow-hidden transition-shadow duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover">
        <div className="border-b border-slate-700/80 px-6 py-4">
          <h3 className={studentPortalSectionTitleClass}>
            <span className={studentHeadingPillClass}>
              <span className="material-symbols-outlined text-violet-300">badge</span>
              Account details
            </span>
          </h3>
        </div>
        <dl className="space-y-3 px-6 py-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Email</dt>
            <dd className="mt-0.5 text-sm text-slate-100">{user?.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Role</dt>
            <dd className="mt-0.5 text-sm capitalize text-slate-100">{profile?.role || 'student'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Display name</dt>
            <dd className="mt-0.5 text-sm text-slate-100">{displayName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Registration number</dt>
            <dd className="mt-0.5 text-sm text-slate-100">{profile?.registration_number?.trim() || '—'}</dd>
          </div>
        </dl>
      </div>
    </ProfilePageLayout>
  )
}

/** Dashboard: latest updates (by updated_at / created_at). */
function RecentAction({ complaints, loading, onComplaintClick }) {
  const sorted = [...(complaints || [])].sort((a, b) => {
    const ta = new Date(a.updated_at || a.created_at || 0).getTime()
    const tb = new Date(b.updated_at || b.created_at || 0).getTime()
    return tb - ta
  })
  const recent = sorted.slice(0, 6)

  return (
    <div className="space-y-4">
      <h3 className={studentPortalSectionTitleClass}>
        <span className={studentHeadingPillClass}>
          <span className="material-symbols-outlined text-sky-300">history</span>
          Recent Activity Preview
        </span>
      </h3>
      <div className="overflow-hidden rounded-2xl border border-slate-700/70 bg-[#0d1629]/85 shadow-xl shadow-black/30 backdrop-blur-sm">
        {loading ? (
          <div className="space-y-3 px-4 py-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-slate-800/60 bg-slate-800/20 p-4"
              >
                <div className="h-4 w-2/3 rounded-lg bg-slate-600/30" />
                <div className="mt-3 h-3 w-1/3 rounded-lg bg-slate-600/20" />
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">No activity yet. Submit a complaint to get started.</p>
        ) : (
          <ul className="divide-y divide-slate-800/80 p-1">
            {recent.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onComplaintClick?.(c.id)}
                  className="flex w-full items-start gap-4 rounded-xl px-4 py-3.5 text-left transition-colors hover:bg-sky-500/[0.06]"
                >
                  <span
                    className={`material-symbols-outlined mt-0.5 rounded-lg p-2 ring-1 ${
                      c.status === 'resolved'
                        ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
                        : c.status === 'in_progress'
                          ? 'bg-sky-500/15 text-sky-300 ring-sky-500/30'
                          : c.status === 'assigned'
                            ? 'bg-violet-500/15 text-violet-300 ring-violet-500/30'
                            : 'bg-amber-500/15 text-amber-300 ring-amber-500/30'
                    }`}
                  >
                    {c.status === 'resolved' ? 'task_alt' : c.status === 'in_progress' ? 'autorenew' : c.status === 'assigned' ? 'groups' : 'schedule'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-100">{c.title || 'Untitled'}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono text-[10px] text-slate-500">#{String(c.id).slice(0, 8)}</span>
                      <span>·</span>
                      <span>{formatDate(c.updated_at || c.created_at)}</span>
                    </p>
                  </div>
                  <StatusBadge status={c.status} variant="portal" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StudentHome({ complaints, loading, onOpenComplaintsFiltered, onViewComplaintFromRecent }) {
  const total = complaints.length
  const pending = complaints.filter((c) => c.status === 'pending').length
  const inProgress = complaints.filter((c) => c.status === 'in_progress').length
  const resolved = complaints.filter((c) => c.status === 'resolved').length
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const assigned = complaints.filter((c) => c.status === 'assigned').length

  const categoryCounts = complaints.reduce((acc, c) => {
    const key = (c.category || 'Uncategorized').trim() || 'Uncategorized'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0] || null
  const resolvedWithTime = complaints.filter((c) => c.status === 'resolved' && c.created_at && c.updated_at)
  const avgResolutionHours = resolvedWithTime.length
    ? resolvedWithTime.reduce((sum, c) => {
      const start = new Date(c.created_at).getTime()
      const end = new Date(c.updated_at).getTime()
      return sum + Math.max(0, (end - start) / (1000 * 60 * 60))
    }, 0) / resolvedWithTime.length
    : 0
  const openWorkload = pending + assigned + inProgress
  /** idle → fade done; pulse → attention on Pending; highlight → emerald */
  const [pendingPhase, setPendingPhase] = useState('idle')

  useEffect(() => {
    if (loading) return

    if (reduceMotion) return

    let cancelled = false
    const fadeDone = 0.12 * 2 + 0.42 + 0.08
    const tPulse = window.setTimeout(() => {
      if (!cancelled) setPendingPhase('pulse')
    }, fadeDone * 1000)
    const tHighlight = window.setTimeout(() => {
      if (!cancelled) setPendingPhase('highlight')
    }, (fadeDone + 1.25) * 1000)

    return () => {
      cancelled = true
      window.clearTimeout(tPulse)
      window.clearTimeout(tHighlight)
      setPendingPhase('idle')
    }
  }, [loading, reduceMotion])

  const fadeProps = (delay) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.42, delay, ease: [0.22, 1, 0.36, 1] }
        }

  const pendingCardClass =
    'admin-panel-static w-full cursor-pointer p-5 text-left transition-[box-shadow,background-color,border-color] duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 ' +
    (pendingPhase === 'highlight'
      ? 'border-emerald-500/50 bg-emerald-500/[0.08] ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/20'
      : 'border-slate-700/50')

  const openFiltered = (filter) => {
    if (typeof onOpenComplaintsFiltered === 'function') onOpenComplaintsFiltered(filter)
    else if (filter === 'all') navigate('/student/complaints')
    else navigate(`/student/complaints?status=${filter}`)
  }

  return (
    <div className="space-y-6">
      <h2 className={studentPortalMainHeadingClass}>
        <span className={studentHeadingPillClass}>
          <span className="material-symbols-outlined text-sky-300">dashboard</span>
          Dashboard
        </span>
      </h2>
      <p className="text-slate-400">Submit and track your complaints from here.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Row 1 — fade */}
        <motion.button
          type="button"
          aria-label="View all complaints"
          onClick={() => openFiltered('all')}
          className="admin-panel-static p-5 transition-all duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover"
          whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 24 } }}
          {...fadeProps(0)}
        >
          <p className="bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-xs font-semibold uppercase tracking-wider text-transparent">
            Total Complaints
          </p>
          <p className="mt-1 bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-2xl font-bold text-transparent">
            <AnimatedCounter value={total} />
          </p>
          <p className="mt-2 text-[11px] font-medium text-slate-500">See your full complaint history</p>
        </motion.button>
        {/* Row 2 — fade, then pulse → color → toast */}
        <motion.button
          type="button"
          aria-label="View complaints not yet assigned to staff"
          onClick={() => openFiltered('pending')}
          className={pendingCardClass}
          {...(reduceMotion ? {} : { initial: { opacity: 0, y: 10 } })}
          animate={
            reduceMotion
              ? { opacity: 1, y: 0, scale: 1 }
              : pendingPhase === 'pulse'
                ? {
                    opacity: 1,
                    y: 0,
                    scale: [1, 1.045, 1, 1.045, 1],
                    boxShadow: [
                      '0 4px 28px -6px rgba(0, 0, 0, 0.55)',
                      '0 0 0 3px rgba(245, 158, 11, 0.45)',
                      '0 4px 28px -6px rgba(0, 0, 0, 0.55)',
                      '0 0 0 3px rgba(245, 158, 11, 0.45)',
                      '0 4px 28px -6px rgba(0, 0, 0, 0.55)'
                    ]
                  }
                : pendingPhase === 'highlight'
                  ? {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      boxShadow: '0 12px 40px -10px rgba(16, 185, 129, 0.35)'
                    }
                  : { opacity: 1, y: 0, scale: 1 }
          }
          transition={
            reduceMotion
              ? {}
              : pendingPhase === 'pulse'
                ? { duration: 1.2, ease: 'easeInOut' }
                : pendingPhase === 'highlight'
                  ? { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
                  : { duration: 0.42, delay: 0.12, ease: [0.22, 1, 0.36, 1] }
          }
        >
          <p
            className={
              'bg-gradient-to-r bg-clip-text text-xs font-semibold uppercase tracking-wider text-transparent transition-colors duration-500 ' +
              (pendingPhase === 'highlight'
                ? 'from-emerald-300 to-sky-300'
                : 'from-amber-300 to-orange-300')
            }
          >
            Pending
          </p>
          <p
            className={
              'mt-1 text-2xl font-bold transition-colors duration-500 ' +
              (pendingPhase === 'highlight' ? 'text-emerald-400' : 'text-amber-400')
            }
          >
            <AnimatedCounter value={pending} />
          </p>
          <p className="mt-2 text-[11px] font-medium text-slate-500">Complaints waiting to be assigned — not yet routed to staff</p>
        </motion.button>
        {/* Row 3 — fade */}
        <motion.button
          type="button"
          aria-label="View resolved complaints"
          onClick={() => openFiltered('resolved')}
          className="admin-panel-static p-5 text-left transition-all duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
          whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 24 } }}
          {...fadeProps(0.24)}
        >
          <p className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-xs font-semibold uppercase tracking-wider text-transparent">
            Resolved
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">
            <AnimatedCounter value={resolved} />
          </p>
          <p className="mt-2 text-[11px] font-medium text-slate-500">Open complaints already marked resolved</p>
        </motion.button>
      </div>
      <div className="grid gap-6">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.04 }}
          className="rounded-2xl border border-slate-700/70 bg-[#0d1629]/85 p-5 shadow-xl shadow-black/30 backdrop-blur-sm"
        >
          <h3 className={studentPortalSectionTitleClass}>
            <span className={studentHeadingPillClass}>
              <span className="material-symbols-outlined text-amber-300">insights</span>
              Quick Insights
            </span>
          </h3>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-700/60 bg-[#0a1222] p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Most common category</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                {topCategory ? `${topCategory[0]} (${topCategory[1]})` : 'No data yet'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-[#0a1222] p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Avg. resolution time</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                {resolvedWithTime.length ? `${avgResolutionHours.toFixed(1)} hours` : 'Not enough resolved cases'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-[#0a1222] p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Open workload</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">{openWorkload} active complaint(s)</p>
            </div>
          </div>
        </motion.section>
      </div>
      <RecentAction complaints={complaints} loading={loading} onComplaintClick={onViewComplaintFromRecent} />
    </div>
  )
}

export function StudentDashboard() {
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [notifOpen, setNotifOpen] = useState(false)
  const [studentNotifs, setStudentNotifs] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifError, setNotifError] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailSummary, setDetailSummary] = useState(null)
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const headerTitle = (() => {
    const p = location.pathname
    if (p.includes('/notifications')) return 'Notifications'
    if (p.endsWith('/submit')) return 'Submit Complaint'
    if (p.endsWith('/complaints')) return 'My Complaints'
    if (p.endsWith('/status')) return 'Complaint Status'
    if (p.endsWith('/profile')) return 'My Profile'
    return 'Student Dashboard'
  })()

  const load = useCallback(async () => {
    if (!user?.id && supabase) return
    setLoading(true)
    const { data, error } = await fetchComplaints({
      role: 'student',
      userId: user?.id,
      search: searchQuery || undefined
    })
    setLoading(false)
    if (!error) setComplaints(data || [])
  }, [user?.id, searchQuery])

  const loadNotifications = useCallback(async () => {
    if (!supabase || !user?.id) {
      setStudentNotifs([])
      setNotifError(null)
      return
    }
    setNotifLoading(true)
    const { data, error: err } = await fetchStudentNotificationsForCurrentUser()
    setNotifLoading(false)
    setStudentNotifs(data || [])
    setNotifError(err && !err.message?.includes('Not signed in') ? err : null)
  }, [user?.id])

  useEffect(() => {
    if (supabase && user?.id) {
      load()
      const unsub = subscribeComplaints(load)
      return unsub
    }
    setComplaints(MOCK_COMPLAINTS)
    setLoading(false)
  }, [user?.id, load])

  useEffect(() => {
    if (!supabase || !user?.id) {
      setStudentNotifs([])
      return
    }
    loadNotifications()
    return subscribeStudentNotifications(user.id, () => loadNotifications())
  }, [user?.id, loadNotifications])

  const list = supabase && user?.id ? complaints : MOCK_COMPLAINTS
  const unreadNotifCount = countUnreadStudentNotifications(studentNotifs)
  const showStudentNotifs = !!(supabase && user?.id)

  const openComplaintFromNotif = useCallback(
    (complaintId) => {
      setNotifOpen(false)
      const id = String(complaintId ?? '')
      if (!id) return
      const found = (complaints || []).find((c) => String(c.id) === id)
      setDetailSummary(
        found || {
          id,
          status: 'pending',
          title: `Complaint #${String(id).slice(0, 8)}`,
          category: '',
          created_at: null
        }
      )
      setDetailOpen(true)
    },
    [complaints]
  )

  return (
    <div className="portal-app flex h-screen overflow-hidden">
      <StudentSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-admin-bg">
        <Header
          variant="portal"
          onMenuClick={() => setSidebarOpen(true)}
          title={headerTitle}
          showSearch
          searchPlaceholder="Search complaints..."
          onSearch={setSearchQuery}
          notificationCount={showStudentNotifs ? unreadNotifCount : 0}
          onNotificationsClick={
            showStudentNotifs
              ? () => {
                  setNotifOpen(true)
                  loadNotifications()
                }
              : undefined
          }
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <div className="min-h-full bg-admin-bg">
          <Routes>
            <Route
              index
              element={
                <StudentHome
                  complaints={list}
                  loading={loading}
                  onOpenComplaintsFiltered={(filter) => {
                    setSearchQuery('')
                    if (filter === 'all') navigate('/student/complaints')
                    else navigate(`/student/complaints?status=${filter}`)
                  }}
                  onViewComplaintFromRecent={(id) => {
                    setSearchQuery(String(id ?? ''))
                    navigate({ pathname: '/student/complaints', search: '' })
                  }}
                />
              }
            />
            <Route path="submit" element={<SubmitComplaint onSuccess={load} />} />
            <Route path="complaints" element={<MyComplaints complaints={list} searchQuery={searchQuery} loading={loading} />} />
            <Route path="status" element={<StatusPage complaints={list} loading={loading} />} />
            <Route
              path="notifications"
              element={
                <StudentNotificationsPageView
                  notifications={studentNotifs}
                  loading={notifLoading}
                  error={notifError}
                  onRefresh={loadNotifications}
                  onOpenComplaint={openComplaintFromNotif}
                />
              }
            />
            <Route path="profile" element={<ProfilePage />} />
          </Routes>
          </div>
        </div>
      </main>
      {showStudentNotifs && (
        <StudentNotificationPanel
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
          notifications={studentNotifs}
          loading={notifLoading}
          error={notifError}
          onRefresh={loadNotifications}
          onOpenComplaint={openComplaintFromNotif}
        />
      )}
      <StudentComplaintDetailDrawer
        open={detailOpen}
        summary={detailSummary}
        onClose={() => {
          setDetailOpen(false)
          setDetailSummary(null)
        }}
      />
      <MobileNav />
    </div>
  )
}

function MobileNav() {
  const links = [
    { to: '/student', end: true, icon: 'dashboard', label: 'Dashboard' },
    { to: '/student/submit', icon: 'edit_note', label: 'Submit' },
    { to: '/student/complaints', icon: 'assignment', label: 'Complaints' },
    { to: '/student/status', icon: 'info', label: 'Status' },
    { to: '/student/notifications', icon: 'notifications', label: 'Notifs' },
    { to: '/student/profile', icon: 'person', label: 'Profile' }
  ]
  return (
    <nav className="portal-bottom-nav scrollbar-hide fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-start gap-0.5 overflow-x-auto px-2 py-2 md:hidden">
      {links.map(({ to, end, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-lg py-1 transition-colors duration-200 ${
              isActive ? 'font-semibold text-sky-400' : 'text-slate-500 hover:text-slate-300'
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
