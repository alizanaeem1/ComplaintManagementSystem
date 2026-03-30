import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { StatusBadge } from './StatusBadge'
import { ComplaintTimeline } from './ComplaintTimeline'
import { getLastDepartmentRoutedBy } from '../lib/complaintActors.js'
import { ComplaintConversation } from './ComplaintConversation.jsx'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function toDateInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatSize(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const drawerPanel = {
  initial: { x: '100%' },
  animate: { x: 0, transition: { type: 'spring', damping: 32, stiffness: 380 } },
  exit: { x: '100%', transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] } }
}

const backdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } }
}

const sectionStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } }
}

const sectionItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } }
}

const drawerHeadingBorder = {
  sky: 'border-sky-400',
  violet: 'border-violet-400',
  amber: 'border-amber-400',
  emerald: 'border-emerald-400',
  rose: 'border-rose-400'
}

/** Prominent section title inside View details drawer */
function DrawerSectionHeading({ children, accent = 'sky', icon = null, className = '' }) {
  const b = drawerHeadingBorder[accent] || drawerHeadingBorder.sky
  return (
    <h3
      className={`mb-3 flex items-center gap-2 border-l-4 ${b} py-0.5 pl-3 text-base font-bold tracking-tight text-slate-50 sm:text-lg ${className}`}
    >
      {icon}
      {children}
    </h3>
  )
}

/**
 * Right-side case drawer for admin complaint detail and workflow actions.
 */
export function AdminComplaintDrawer({
  open,
  onClose,
  detail,
  loading,
  error,
  attachmentUrls = {},
  assignableDepartments = [],
  onAssign,
  onStatusChange,
  updatingId,
  studentDisplayName = ''
}) {
  const busy = detail?.id != null && updatingId != null && String(updatingId) === String(detail.id)
  const routed = detail ? getLastDepartmentRoutedBy(detail) : { department: null, assignerLabel: null, at: null }
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [deadlineDate, setDeadlineDate] = useState('')

  const rowDepartments = detail
    ? [...new Set([...(assignableDepartments || []), ...(detail.assigned_department ? [detail.assigned_department] : [])])]
    : []

  useEffect(() => {
    setSelectedDepartment(detail?.assigned_department || '')
    setDeadlineDate(toDateInputValue(detail?.due_at))
  }, [detail?.id, detail?.assigned_department, detail?.due_at])

  return (
    <AnimatePresence mode="sync">
      {open && (
        <>
          <motion.button
            key="admin-drawer-backdrop"
            type="button"
            aria-label="Close panel"
            role="presentation"
            className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm"
            variants={backdrop}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
          />
          <motion.aside
            key="admin-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-drawer-title"
            variants={drawerPanel}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed right-0 top-0 z-[201] flex h-full w-full max-w-md flex-col border-l border-slate-700/80 bg-admin-card text-slate-100 shadow-2xl shadow-black/50 sm:max-w-lg lg:max-w-xl"
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-700/80 bg-gradient-to-r from-[#0c1424] to-admin-card px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-[10px] font-bold uppercase tracking-widest text-transparent">
                  Complaint
                </p>
                <h2
                  id="admin-drawer-title"
                  className="truncate text-xl font-extrabold tracking-tight sm:text-2xl"
                >
                  <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-violet-300 bg-clip-text text-transparent">
                    {detail?.id ? `#${String(detail.id).slice(0, 8)}` : 'Complaint'}
                  </span>
                </h2>
                {detail?.title && <p className="mt-1 line-clamp-2 text-sm text-slate-400">{detail.title}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
                aria-label="Close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="space-y-4 p-4">
                  <div className="h-6 max-w-xs animate-pulse rounded-lg bg-slate-600/35" />
                  <div className="h-20 w-full animate-pulse rounded-xl bg-slate-600/35" />
                  <div className="h-24 w-full animate-pulse rounded-xl bg-slate-600/35" />
                  <div className="h-32 w-full animate-pulse rounded-xl bg-slate-600/35" />
                </div>
              ) : error ? (
                <div className="p-4 text-sm text-red-400">{error}</div>
              ) : detail ? (
                <motion.div
                  className="space-y-5 p-4 pb-8"
                  variants={sectionStagger}
                  initial="hidden"
                  animate="show"
                  key={detail.id}
                >
                  {/* Meta */}
                  <motion.section
                    variants={sectionItem}
                    className="rounded-xl border border-slate-700/60 bg-[#0c1424] p-4 shadow-inner"
                  >
                    <DrawerSectionHeading
                      accent="rose"
                      icon={<span className="material-symbols-outlined text-xl text-rose-400">dashboard</span>}
                    >
                      Overview
                    </DrawerSectionHeading>
                    <div className="flex flex-wrap items-center gap-2">
                      <motion.span
                        key={detail.status}
                        layout
                        initial={{ opacity: 0.75, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                        className="inline-flex"
                      >
                        <StatusBadge status={detail.status} variant="admin" glow />
                      </motion.span>
                      <span className="rounded-md bg-slate-700/50 px-2 py-0.5 text-xs font-medium text-slate-300">
                        {detail.category || '—'}
                      </span>
                      <span className="text-xs text-slate-500">Priority: {detail.priority || '—'}</span>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Submitted {formatDate(detail.created_at)}
                      {detail.updated_at && detail.updated_at !== detail.created_at && (
                        <> · Updated {formatDate(detail.updated_at)}</>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Student: {studentDisplayName || '—'}</p>
                    {(detail?.status === 'resolved' || detail?.status === 'closed') && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-slate-500">Student rating:</span>
                        {detail?.rating?.rating ? (
                          <div className="flex items-center gap-1">
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
                          <span className="text-xs text-slate-500">Not rated yet</span>
                        )}
                      </div>
                    )}
                  </motion.section>

                  <motion.section variants={sectionItem}>
                    <DrawerSectionHeading accent="sky">Description</DrawerSectionHeading>
                    <div className="rounded-xl border border-slate-700/60 bg-[#0c1424] p-4 text-sm text-slate-300">
                      <p className="whitespace-pre-line">{detail.description || '—'}</p>
                    </div>
                  </motion.section>

                  {/* Actions — assign */}
                  <motion.section
                    variants={sectionItem}
                    className="rounded-xl border border-slate-700/60 bg-[#0c1424] p-4"
                  >
                    <DrawerSectionHeading
                      accent="violet"
                      icon={<span className="material-symbols-outlined text-xl text-violet-400">apartment</span>}
                    >
                      Assign department
                    </DrawerSectionHeading>
                    <select
                      className="admin-select w-full text-sm"
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      disabled={busy || !assignableDepartments.length}
                    >
                      <option value="">
                        {assignableDepartments.length ? 'Select department…' : 'No departments configured'}
                      </option>
                      {rowDepartments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Deadline</label>
                      <input
                        type="date"
                        className="admin-input w-full text-sm"
                        value={deadlineDate}
                        onChange={(e) => setDeadlineDate(e.target.value)}
                        disabled={busy || !assignableDepartments.length}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onAssign(detail.id, selectedDepartment, deadlineDate)}
                      disabled={busy || !selectedDepartment || !deadlineDate}
                      className="mt-3 admin-gradient-btn w-full disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Assign with deadline
                    </button>
                    {detail.assigned_department && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-slate-500">Currently: {detail.assigned_department}</p>
                        {routed.assignerLabel && (
                          <p className="text-xs text-slate-400">
                            Assigned by: <span className="font-medium text-slate-300">{routed.assignerLabel}</span>
                            {routed.at && ` · ${formatDate(routed.at)}`}
                          </p>
                        )}
                      </div>
                    )}
                  </motion.section>

                  {/* Actions — status */}
                  <motion.section
                    variants={sectionItem}
                    className="rounded-xl border border-slate-700/60 bg-[#0c1424] p-4"
                  >
                    <DrawerSectionHeading
                      accent="sky"
                      icon={<span className="material-symbols-outlined text-xl text-sky-400">sync_alt</span>}
                    >
                      Update status
                    </DrawerSectionHeading>
                    <select
                      className="admin-select w-full text-sm"
                      value={detail.status || 'pending'}
                      onChange={(e) => onStatusChange(detail.id, e.target.value)}
                      disabled={busy}
                    >
                      <option value="pending">Pending</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </motion.section>

                  {/* Attachments */}
                  <motion.section variants={sectionItem}>
                    <DrawerSectionHeading
                      accent="amber"
                      icon={<span className="material-symbols-outlined text-xl text-amber-400">attach_file</span>}
                    >
                      Attachments
                    </DrawerSectionHeading>
                    {!(detail.attachments || []).length ? (
                      <p className="text-sm text-slate-500">No attachments.</p>
                    ) : (
                      <div className="space-y-3">
                        {((detail.attachments || []).filter((a) => !a.response_id)).length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Student uploaded</p>
                            {(detail.attachments || []).filter((a) => !a.response_id).map((a) => {
                              const url = attachmentUrls[a.id] || '#'
                              const fileName = (a.file_name || '').toLowerCase()
                              const isImage =
                                fileName.endsWith('.png') ||
                                fileName.endsWith('.jpg') ||
                                fileName.endsWith('.jpeg') ||
                                fileName.endsWith('.webp') ||
                                fileName.endsWith('.gif')
                              return (
                                <a
                                  key={a.id}
                                  href={url || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-3 rounded-lg border border-slate-700/60 bg-[#0c1424] p-3 transition-all duration-200 hover:border-sky-500/30 hover:bg-sky-500/[0.06]"
                                >
                                  {isImage && url ? (
                                    <img
                                      src={url}
                                      alt={a.file_name || ''}
                                      className="h-12 w-12 shrink-0 rounded-lg border border-slate-600 object-cover"
                                    />
                                  ) : (
                                    <span className="material-symbols-outlined shrink-0 text-sky-400">description</span>
                                  )}
                                  <span className="min-w-0">
                                    <span className="block truncate text-xs font-bold text-slate-200">{a.file_name}</span>
                                    <span className="text-[10px] text-slate-500">{formatSize(a.file_size)}</span>
                                  </span>
                                </a>
                              )
                            })}
                          </div>
                        )}
                        {((detail.attachments || []).filter((a) => !!a.response_id)).length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Staff updates</p>
                            {(detail.attachments || []).filter((a) => !!a.response_id).map((a) => {
                              const url = attachmentUrls[a.id] || '#'
                              const fileName = (a.file_name || '').toLowerCase()
                              const isImage =
                                fileName.endsWith('.png') ||
                                fileName.endsWith('.jpg') ||
                                fileName.endsWith('.jpeg') ||
                                fileName.endsWith('.webp') ||
                                fileName.endsWith('.gif')
                              return (
                                <a
                                  key={a.id}
                                  href={url || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-3 rounded-lg border border-slate-700/60 bg-[#0c1424] p-3 transition-all duration-200 hover:border-sky-500/30 hover:bg-sky-500/[0.06]"
                                >
                                  {isImage && url ? (
                                    <img
                                      src={url}
                                      alt={a.file_name || ''}
                                      className="h-12 w-12 shrink-0 rounded-lg border border-slate-600 object-cover"
                                    />
                                  ) : (
                                    <span className="material-symbols-outlined shrink-0 text-sky-400">description</span>
                                  )}
                                  <span className="min-w-0">
                                    <span className="block truncate text-xs font-bold text-slate-200">{a.file_name}</span>
                                    <span className="text-[10px] text-slate-500">{formatSize(a.file_size)}</span>
                                  </span>
                                </a>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.section>

                  {/* Timeline */}
                  <motion.section variants={sectionItem}>
                    <DrawerSectionHeading
                      accent="emerald"
                      icon={<span className="material-symbols-outlined text-xl text-emerald-400">history</span>}
                    >
                      Activity
                    </DrawerSectionHeading>
                    <div className="rounded-xl border border-slate-700/60 bg-[#0c1424] p-3">
                      <ComplaintTimeline complaint={detail} variant="admin" />
                    </div>
                  </motion.section>

                  {/* Conversation (read-only for admin) */}
                  <motion.section variants={sectionItem}>
                    <DrawerSectionHeading
                      accent="violet"
                      icon={<span className="material-symbols-outlined text-xl text-violet-300">forum</span>}
                    >
                      Conversation
                    </DrawerSectionHeading>
                    <ComplaintConversation
                      responses={detail.responses || []}
                      actorNames={detail.actor_names || {}}
                      currentUserId={null}
                      currentUserRole="admin"
                    />
                  </motion.section>
                </motion.div>
              ) : null}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
