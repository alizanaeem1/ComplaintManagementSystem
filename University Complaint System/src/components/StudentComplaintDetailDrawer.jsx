import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  fetchComplaintById,
  getFileAccessUrl,
  getFileUrl,
  subscribeComplaintDetailUpdates,
  addResponse
} from '../lib/complaints.js'
import { supabase } from '../lib/supabaseClient.js'
import { StatusBadge, PriorityBadge } from './StatusBadge.jsx'
import { ComplaintTimeline } from './ComplaintTimeline.jsx'
import { ComplaintConversation } from './ComplaintConversation.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'

const drawerSectionHeadingClass =
  'inline-flex items-center gap-2 rounded-lg border border-sky-400/25 bg-sky-500/[0.07] px-3 py-1 text-[0.98rem] sm:text-lg font-extrabold tracking-wide bg-gradient-to-r from-sky-300 via-violet-200 to-fuchsia-300 bg-clip-text text-transparent drop-shadow-[0_0_22px_rgba(99,102,241,0.38)]'

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return '—'
  }
}

function formatSize(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function displayStatus(c) {
  const s = (c?.status || 'pending').toString().toLowerCase()
  if (s === 'submitted') return 'pending'
  if (s === 'closed') return 'resolved'
  return s
}

/**
 * Slide-over: full complaint detail for students (read-only).
 */
export function StudentComplaintDetailDrawer({ open, onClose, summary }) {
  const { user } = useAuth()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [attachmentUrls, setAttachmentUrls] = useState({})
  const [replying, setReplying] = useState(false)
  const summaryRef = useRef(summary)
  summaryRef.current = summary

  const id = summary?.id

  useEffect(() => {
    if (!open) {
      setDetail(null)
      setLoadError(null)
      setAttachmentUrls({})
      return
    }
    if (!id) {
      setDetail(null)
      return
    }

    let cancelled = false

    async function load(silent) {
      const snap = summaryRef.current || {}
      if (!silent) {
        setLoading(true)
        setLoadError(null)
      }
      if (!supabase) {
        if (!cancelled) {
          if (!silent) setLoading(false)
          setLoadError(null)
          setDetail({
            ...snap,
            status: displayStatus(snap),
            responses: [],
            attachments: [],
            status_history: [],
            activity: [],
            actor_names: {}
          })
        }
        return
      }
      const { data, error } = await fetchComplaintById(id)
      if (cancelled) return
      if (!silent) setLoading(false)
      if (error) {
        if (!silent) {
          setLoadError(error.message || 'Failed to load details.')
          setDetail({
            ...snap,
            status: displayStatus(snap),
            responses: [],
            attachments: [],
            status_history: [],
            activity: [],
            actor_names: {}
          })
        }
        return
      }
      setLoadError(null)
      setDetail(
        data
          ? {
              ...data,
              status: displayStatus(data)
            }
          : null
      )
    }

    load(false)

    const unsub =
      supabase && id
        ? subscribeComplaintDetailUpdates(id, () => {
            if (!cancelled) load(true)
          })
        : () => {}

    return () => {
      cancelled = true
      unsub()
    }
  }, [open, id])

  useEffect(() => {
    let cancelled = false
    async function urls() {
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
    urls()
    return () => {
      cancelled = true
    }
  }, [detail?.id, detail?.attachments])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleReply = async (body) => {
    if (!user?.id || !id) return
    setReplying(true)
    const { error } = await addResponse({
      complaintId: id,
      userId: user.id,
      body,
      senderRole: 'student'
    })
    setReplying(false)
    if (error) {
      alert(error.message || 'Failed to submit reply.')
      return
    }
    const { data: fresh } = await fetchComplaintById(id)
    if (fresh) setDetail({ ...fresh, status: displayStatus(fresh) })
  }

  if (!open || !summary) return null

  const c = detail || summary
  const st = displayStatus(c)
  const anonymous = !!c.is_anonymous
  const allAttachments = detail?.attachments || []
  const studentAttachments = allAttachments.filter((a) => !a.response_id)
  const staffAttachments = allAttachments.filter((a) => !!a.response_id)

  const lifecycleSteps = [
    { key: 'pending', label: 'Submitted', icon: 'inventory_2' },
    { key: 'assigned', label: 'Assigned', icon: 'groups' },
    { key: 'in_progress', label: 'In Progress', icon: 'sync' },
    { key: 'resolved', label: 'Resolved', icon: 'task_alt' }
  ]

  const currentKey =
    st === 'pending'
      ? 'pending'
      : st === 'assigned'
        ? 'assigned'
        : st === 'in_progress'
          ? 'in_progress'
          : 'resolved'

  const currentIndex = Math.max(0, lifecycleSteps.findIndex((s) => s.key === currentKey))
  const fillPct = lifecycleSteps.length > 1 ? (currentIndex / (lifecycleSteps.length - 1)) * 100 : 0

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[115] bg-slate-950/50 backdrop-blur-[2px]"
        aria-label="Close details"
        onClick={onClose}
      />
      <div
        className="fixed inset-y-0 right-0 z-[120] flex w-full max-w-lg flex-col border-l border-slate-700/90 bg-[#0f172a] shadow-2xl shadow-black/60 md:max-w-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-complaint-detail-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-700/80 px-4 py-4 md:px-6">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded bg-sky-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300 ring-1 ring-sky-500/30">
                #{String(c.id).slice(0, 8)}
              </span>
              <StatusBadge status={st} variant="portal" />
              {c.priority && <PriorityBadge priority={c.priority} variant="portal" />}
            </div>
            <h2 id="student-complaint-detail-title" className="text-lg font-bold leading-snug text-slate-100 md:text-xl">
              {c.title || 'Complaint'}
            </h2>
            {anonymous && (
              <p className="mt-1 text-xs font-medium text-amber-200/80">You submitted this as Anonymous</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-100"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          {loading && (
            <div className="mb-4 flex items-center gap-2 text-sm text-slate-400">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-400" />
              Loading details…
            </div>
          )}
          {loadError && (
            <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
              {loadError}
            </p>
          )}

          <div className="mb-6 rounded-xl border border-slate-700/60 bg-[#0c1424] p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-100">Lifecycle</h3>
              <span className="rounded-lg bg-sky-500/15 px-2 py-1 text-xs font-semibold text-sky-200 ring-1 ring-sky-500/25">
                {lifecycleSteps[currentIndex]?.label || '—'}
              </span>
            </div>

            <div className="relative mt-4">
              <div className="pointer-events-none absolute left-0 right-0 top-[20px] h-[2px] rounded-full bg-slate-700/80" />
              <motion.div
                className="pointer-events-none absolute left-0 top-[20px] h-[2px] rounded-full bg-gradient-to-r from-emerald-400/90 via-sky-400/90 to-violet-400/90"
                initial={{ width: 0 }}
                animate={{ width: `${fillPct}%` }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />

              <div className="relative grid grid-cols-4 gap-2">
                {lifecycleSteps.map((step, idx) => {
                  const completed = idx < currentIndex
                  const active = idx === currentIndex
                  return (
                    <motion.div
                      key={step.key}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      whileHover={{ y: -2, scale: 1.02 }}
                      className="flex flex-col items-center"
                    >
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ring-1 transition-all duration-300 ${
                          active
                            ? 'bg-gradient-to-br from-sky-500/35 to-violet-500/35 text-sky-100 ring-sky-300/45 shadow-[0_0_20px_rgba(56,189,248,0.28)]'
                            : completed
                              ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/35'
                              : 'bg-slate-800/90 text-slate-500 ring-slate-600/70 opacity-60'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{step.icon}</span>
                      </div>
                      <p
                        className={`mt-2 line-clamp-1 text-[11px] font-semibold ${
                          active ? 'text-slate-100' : completed ? 'text-emerald-200' : 'text-slate-500'
                        }`}
                      >
                        {step.label}
                      </p>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-3 rounded-xl border border-slate-700/60 bg-[#0c1424] p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Category</p>
              <p className="mt-0.5 font-medium text-slate-200">{c.category || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Submitted</p>
              <p className="mt-0.5 font-medium text-slate-200">{formatWhen(c.created_at)}</p>
            </div>
            {c.assigned_department && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Assigned department</p>
                <p className="mt-0.5 font-medium text-slate-200">{c.assigned_department}</p>
              </div>
            )}
            {c.assigned_at && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Assigned at</p>
                <p className="mt-0.5 font-medium text-slate-200">{formatWhen(c.assigned_at)}</p>
              </div>
            )}
            {c.due_at && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Due</p>
                <p className="mt-0.5 font-medium text-slate-200">{formatWhen(c.due_at)}</p>
              </div>
            )}
          </div>

          <section className="mb-6">
            <h3 className={`mb-2 ${drawerSectionHeadingClass}`}>Description</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-400">
              {c.description?.trim() ? c.description : '—'}
            </p>
          </section>

          <section className="mb-6">
            <h3 className={`mb-3 ${drawerSectionHeadingClass}`}>Attachments</h3>
            {allAttachments.length === 0 ? (
              <p className="text-sm text-slate-500">No files attached.</p>
            ) : (
              <div className="space-y-3">
                {studentAttachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Student uploaded</p>
                    {studentAttachments.map((a) => (
                      <a
                        key={a.id}
                        href={attachmentUrls[a.id] || getFileUrl(a.file_path) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-[#0c1424] p-3 transition-colors hover:border-sky-500/40 hover:bg-sky-500/[0.06]"
                      >
                        <span className="material-symbols-outlined text-sky-400">description</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-200">{a.file_name}</p>
                          <p className="text-xs text-slate-500">{formatSize(a.file_size)}</p>
                        </div>
                        <span className="material-symbols-outlined text-slate-500">open_in_new</span>
                      </a>
                    ))}
                  </div>
                )}
                {staffAttachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Staff updates</p>
                    {staffAttachments.map((a) => (
                      <a
                        key={a.id}
                        href={attachmentUrls[a.id] || getFileUrl(a.file_path) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-[#0c1424] p-3 transition-colors hover:border-sky-500/40 hover:bg-sky-500/[0.06]"
                      >
                        <span className="material-symbols-outlined text-sky-400">description</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-200">{a.file_name}</p>
                          <p className="text-xs text-slate-500">{formatSize(a.file_size)}</p>
                        </div>
                        <span className="material-symbols-outlined text-slate-500">open_in_new</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="mb-6">
            <h3 className={`mb-3 ${drawerSectionHeadingClass}`}>Activity</h3>
            <ComplaintTimeline complaint={detail || c} variant="admin" />
          </section>

          <section>
            <h3 className={`mb-3 ${drawerSectionHeadingClass}`}>Conversation</h3>
            <ComplaintConversation
              responses={detail?.responses || c.responses || []}
              actorNames={detail?.actor_names || c.actor_names || {}}
              currentUserId={user?.id}
              currentUserRole="student"
              onReply={handleReply}
              loading={replying}
            />
          </section>
        </div>
      </div>
    </>
  )
}
