import { markStudentNotificationRead } from '../lib/studentNotifications.js'
import { useNavigate } from 'react-router-dom'

const studentNotifTitleClass =
  'font-bold tracking-tight bg-gradient-to-r from-sky-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent'

function formatNotifTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatNotifRelativeTime(iso) {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  if (diffMs < 60 * 1000) return 'just now'
  const mins = Math.floor(diffMs / (60 * 1000))
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function classifyNotification(message = '') {
  const text = String(message).toLowerCase()
  if (text.includes('submitted')) {
    return { type: 'submitted', title: 'Complaint Submitted', icon: 'upload_file', tint: 'text-cyan-300 bg-cyan-500/15 ring-cyan-500/35' }
  }
  if (text.includes('assigned')) {
    return { type: 'assigned', title: 'Complaint Assigned', icon: 'groups', tint: 'text-violet-300 bg-violet-500/15 ring-violet-500/35' }
  }
  if (text.includes('progress update') || text.includes('admin reply') || text.includes('reply')) {
    return { type: 'reply', title: 'Admin/Staff Reply', icon: 'chat', tint: 'text-sky-300 bg-sky-500/15 ring-sky-500/35' }
  }
  if (text.includes('resolved')) {
    return { type: 'resolved', title: 'Complaint Resolved', icon: 'task_alt', tint: 'text-emerald-300 bg-emerald-500/15 ring-emerald-500/35' }
  }
  if (text.includes('updated') || text.includes('status')) {
    return { type: 'status', title: 'Status Updated', icon: 'autorenew', tint: 'text-amber-300 bg-amber-500/15 ring-amber-500/35' }
  }
  return { type: 'status', title: 'Complaint Update', icon: 'notifications', tint: 'text-slate-300 bg-slate-500/15 ring-slate-500/35' }
}

function NotificationListBody({
  notifications = [],
  loading = false,
  error = null,
  onItemClick,
  emptyClassName = 'px-4 py-8 text-center text-sm text-slate-500'
}) {
  if (loading && notifications.length === 0) {
    return <p className={emptyClassName}>Loading…</p>
  }
  if (error) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-sm text-amber-200/90">
          {error.message?.includes('notifications') || error.message?.includes('schema cache')
            ? 'Notifications table not found. Run supabase/add-student-notifications.sql in the SQL Editor.'
            : error.message || 'Could not load notifications.'}
        </p>
      </div>
    )
  }
  if (notifications.length === 0) {
    return <p className={emptyClassName}>No notifications yet.</p>
  }
  return (
    <ul className="space-y-2 p-2">
      {notifications.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => onItemClick?.(n)}
            className={`group relative flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.04] ${
              n.is_read
                ? 'border-slate-700/60 bg-[#0d1628]'
                : 'border-violet-500/30 bg-violet-500/[0.12] shadow-md shadow-violet-950/20 ring-1 ring-violet-500/25'
            }`}
          >
            {(() => {
              const meta = classifyNotification(n.message)
              return (
                <>
                  <span className={`material-symbols-outlined mt-0.5 rounded-lg p-2 ring-1 ${meta.tint}`}>
                    {meta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center justify-between gap-2">
                      <p className={`truncate text-sm ${n.is_read ? 'font-medium text-slate-200' : 'font-semibold text-white'}`}>
                        {meta.title}
                      </p>
                      <span className="shrink-0 text-[11px] text-slate-500">{formatNotifRelativeTime(n.created_at)}</span>
                    </div>
                    <p className={`line-clamp-2 text-xs leading-relaxed ${n.is_read ? 'text-slate-400' : 'text-slate-200/90'}`}>
                      {n.message}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">{formatNotifTime(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.8)]" />
                  )}
                </>
              )
            })()}
          </button>
        </li>
      ))}
    </ul>
  )
}

function NotificationLegend() {
  const items = [
    { label: 'Complaint Submitted', icon: 'upload_file', tint: 'text-cyan-300 bg-cyan-500/15 ring-cyan-500/35' },
    { label: 'Complaint Assigned', icon: 'groups', tint: 'text-violet-300 bg-violet-500/15 ring-violet-500/35' },
    { label: 'Status Updated', icon: 'autorenew', tint: 'text-amber-300 bg-amber-500/15 ring-amber-500/35' },
    { label: 'Admin Reply', icon: 'chat', tint: 'text-sky-300 bg-sky-500/15 ring-sky-500/35' },
    { label: 'Complaint Resolved', icon: 'task_alt', tint: 'text-emerald-300 bg-emerald-500/15 ring-emerald-500/35' }
  ]
  return (
    <div className="grid gap-1.5 rounded-xl border border-slate-700/60 bg-[#0d1628] p-3 sm:grid-cols-2">
      {items.map((x) => (
        <div key={x.label} className="flex items-center gap-2 text-xs text-slate-400">
          <span className={`material-symbols-outlined rounded-md p-1 ring-1 ${x.tint}`}>{x.icon}</span>
          <span>{x.label}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Slide-over panel for student notifications (header bell).
 */
export function StudentNotificationPanel({
  open,
  onClose,
  notifications = [],
  loading = false,
  error = null,
  onRefresh,
  onOpenComplaint
}) {
  if (!open) return null

  const navigate = useNavigate()

  async function handleRowClick(n) {
    const { error: markErr } = await markStudentNotificationRead(n.id)
    if (!markErr) onRefresh?.()
    onClose?.()
    if (n.complaint_id != null) onOpenComplaint?.(n.complaint_id)
  }

  const unreadCount = (notifications || []).filter((n) => !n.is_read).length

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[105] bg-slate-950/40 backdrop-blur-[2px] md:bg-slate-950/25"
        aria-label="Close notifications"
        onClick={onClose}
      />
      <div
        className="fixed right-3 top-[4.25rem] z-[110] flex max-h-[min(76vh,32rem)] w-[min(calc(100vw-1.5rem),24rem)] flex-col overflow-hidden rounded-2xl border border-slate-700/90 bg-[#131c2e] shadow-2xl shadow-black/50 ring-1 ring-white/[0.06] md:right-5 md:top-[4.5rem]"
        role="dialog"
        aria-label="Notifications"
      >
        <div className="flex items-center justify-between border-b border-slate-700/80 px-4 py-3">
          <h2 className="text-sm font-bold text-white">Notifications</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-100"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto student-scrollbar">
          <NotificationListBody
            notifications={notifications}
            loading={loading}
            error={error}
            onItemClick={handleRowClick}
          />
        </div>

        <div className="flex-shrink-0 border-t border-slate-700/80 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onClose?.()
              navigate('/student/notifications')
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-950/30 ring-1 ring-white/10 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-violet-950/35 active:translate-y-0"
          >
            <span>View all</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-white/[0.12] px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/10">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

/**
 * Full-page notifications list (same behaviour as panel rows).
 */
export function StudentNotificationsPageView({
  notifications = [],
  loading = false,
  error = null,
  onRefresh,
  onOpenComplaint
}) {
  async function handleRowClick(n) {
    const { error: markErr } = await markStudentNotificationRead(n.id)
    if (!markErr) onRefresh?.()
    if (n.complaint_id != null) onOpenComplaint?.(n.complaint_id)
  }

  return (
    <div className="space-y-4">
      <h2 className={`text-xl sm:text-2xl ${studentNotifTitleClass}`}>Notifications</h2>
      <p className="text-sm text-slate-400">
        Real-time activity feed for your complaint journey. Unread items show a badge and stronger highlight.
      </p>
      <NotificationLegend />
      <div className="admin-panel-static overflow-hidden transition-shadow duration-300 hover:border-slate-600/50 hover:shadow-admin-card-hover">
        <div className="max-h-[min(72vh,36rem)] overflow-y-auto student-scrollbar">
          <NotificationListBody
            notifications={notifications}
            loading={loading}
            error={error}
            onItemClick={handleRowClick}
            emptyClassName="px-4 py-12 text-center text-sm text-slate-500"
          />
        </div>
      </div>
    </div>
  )
}
