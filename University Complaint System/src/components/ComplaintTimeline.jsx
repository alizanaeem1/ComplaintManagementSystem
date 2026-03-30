import { useMemo } from 'react'
import { motion } from 'framer-motion'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } }
}

const item = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 380, damping: 28 } }
}

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return '—'
  }
}

/**
 * Unified vertical timeline: submission, status changes, responses.
 * `complaint` should match fetchComplaintById shape (optional status_history, responses).
 */
export function ComplaintTimeline({ complaint, variant = 'default' }) {
  const admin = variant === 'admin'
  const events = useMemo(() => {
    const list = []
    if (!complaint) return list

    if (complaint.created_at) {
      list.push({
        id: 'created',
        type: 'created',
        title: admin ? 'Case submitted' : 'Complaint submitted',
        subtitle: complaint.category ? `Category: ${complaint.category}` : null,
        at: complaint.created_at,
        icon: 'post_add'
      })
    }

    ;(complaint.status_history || []).forEach((h, idx) => {
      const actor =
        h.changed_by && complaint.actor_names?.[h.changed_by] ? complaint.actor_names[h.changed_by] : null
      const isDeptAssign = h.to_status === 'assigned' && h.assigned_department
      const title = isDeptAssign
        ? `Assigned to ${h.assigned_department}`
        : `Status: ${(h.from_status || '—').replace(/_/g, ' ')} → ${(h.to_status || '—').replace(/_/g, ' ')}`
      const subtitleParts = []
      if (!isDeptAssign && h.assigned_department) subtitleParts.push(`Department: ${h.assigned_department}`)
      if (actor) subtitleParts.push(`By ${actor}`)
      list.push({
        id: h.id || `status-${idx}`,
        type: 'status',
        title,
        subtitle: subtitleParts.length ? subtitleParts.join(' · ') : null,
        at: h.created_at,
        icon: isDeptAssign ? 'apartment' : 'sync_alt'
      })
    })

    if (complaint.updated_at && !list.some((e) => e.at === complaint.updated_at && e.type === 'created')) {
      // optional last activity if distinct
    }

    return list.sort((a, b) => new Date(a.at) - new Date(b.at))
  }, [complaint, admin])

  if (!events.length) {
    return (
      <p className={`text-sm ${admin ? 'text-slate-500' : 'text-slate-500 dark:text-slate-400'}`}>
        No timeline entries yet. History appears when the complaint moves through workflow.
      </p>
    )
  }

  return (
    <motion.ol
      className="relative space-y-0 pl-1"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <div
        className={
          admin
            ? 'absolute bottom-2 left-[15px] top-2 w-px bg-gradient-to-b from-sky-500/50 via-slate-600 to-violet-600/40'
            : 'absolute bottom-2 left-[15px] top-2 w-px bg-gradient-to-b from-primary/40 via-slate-200 to-slate-200 dark:via-slate-600 dark:to-slate-700'
        }
        aria-hidden
      />
      {events.map((e) => (
        <motion.li key={e.id} variants={item} className="relative flex gap-3 pb-6 last:pb-0">
          <div
            className={
              admin
                ? 'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-slate-700 bg-sky-500/15 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                : 'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white bg-primary/15 text-primary shadow-sm dark:border-slate-900 dark:bg-primary/20'
            }
          >
            <span className="material-symbols-outlined text-lg">{e.icon}</span>
          </div>
          <div
            className={
              admin
                ? 'min-w-0 flex-1 rounded-xl border border-slate-700/60 bg-[#0f172a] px-3 py-2.5'
                : 'min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50'
            }
          >
            <p className={`text-sm font-semibold ${admin ? 'text-slate-100' : 'text-slate-900 dark:text-slate-100'}`}>
              {e.title}
            </p>
            {e.subtitle && (
              <p className={`mt-0.5 line-clamp-2 text-xs ${admin ? 'text-slate-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {e.subtitle}
              </p>
            )}
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">{formatWhen(e.at)}</p>
          </div>
        </motion.li>
      ))}
    </motion.ol>
  )
}
