import { markAdminNotificationRead } from '../lib/adminNotifications.js'
import { useNavigate } from 'react-router-dom'

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

function classifyAdminNotification(message = '') {
  const text = String(message).toLowerCase()
  if (text.includes('new complaint from student')) {
    return { title: 'Complaint Submitted', icon: 'upload_file', tint: 'text-cyan-300 bg-cyan-500/15 ring-cyan-500/35' }
  }
  if (text.includes('staff updated complaint')) {
    if (text.includes('to resolved') || text.includes('to closed')) {
      return { title: 'Complaint Resolved', icon: 'task_alt', tint: 'text-emerald-300 bg-emerald-500/15 ring-emerald-500/35' }
    }
    return { title: 'Status Updated', icon: 'autorenew', tint: 'text-amber-300 bg-amber-500/15 ring-amber-500/35' }
  }
  if (text.includes('staff added a progress update')) {
    return { title: 'Faculty Progress Update', icon: 'chat', tint: 'text-sky-300 bg-sky-500/15 ring-sky-500/35' }
  }
  return { title: 'Notification Update', icon: 'notifications', tint: 'text-slate-300 bg-slate-500/15 ring-slate-500/35' }
}

function formatNotifTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Floating panel for admin notifications (opens from header bell).
 */
export function AdminNotificationPanel({
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
  const unreadCount = (notifications || []).filter((n) => !n.is_read).length

  async function handleRowClick(n) {
    const { error: markErr } = await markAdminNotificationRead(n.id)
    if (!markErr) onRefresh?.()
    onClose?.()
    if (n.complaint_id != null) onOpenComplaint?.(n.complaint_id)
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[105] bg-slate-950/40 backdrop-blur-[2px] md:bg-slate-950/25"
        aria-label="Close notifications"
        onClick={onClose}
      />
      <div
        className="fixed right-3 top-[4.25rem] z-[110] flex max-h-[min(70vh,28rem)] w-[min(calc(100vw-1.5rem),22rem)] flex-col overflow-hidden rounded-2xl border border-slate-700/90 bg-[#131c2e] shadow-2xl shadow-black/50 ring-1 ring-white/[0.06] md:right-5 md:top-[4.5rem]"
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

        <div className="min-h-0 flex-1 overflow-y-auto p-2 student-scrollbar">
          {loading && notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Loading…</p>
          ) : error ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-amber-200/90">
                {error.message?.includes('admin_notifications') || error.message?.includes('schema cache')
                  ? 'Notifications table not found. Run supabase/add-admin-notifications.sql in the SQL Editor.'
                  : error.message || 'Could not load notifications.'}
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No notifications yet.</p>
          ) : (
            <ul className="space-y-2">
              {notifications.map((n) => {
                const meta = classifyAdminNotification(n.message)
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleRowClick(n)}
                      className={`group relative flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.04] ${
                        n.is_read
                          ? 'border-slate-700/60 bg-[#0d1628]'
                          : 'border-sky-500/30 bg-sky-500/[0.12] shadow-md shadow-sky-950/20 ring-1 ring-sky-500/20'
                      }`}
                    >
                      <span className={`material-symbols-outlined mt-0.5 rounded-lg p-2 ring-1 ${meta.tint}`}>
                        {meta.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center justify-between gap-3">
                          <p className={`truncate text-sm ${n.is_read ? 'font-medium text-slate-300' : 'font-semibold text-white'}`}>
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
                        <span className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)]" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-slate-700/80 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onClose?.()
              navigate('/admin/alerts')
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
