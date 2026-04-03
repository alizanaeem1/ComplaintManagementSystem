import { NavLink } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'

/** Shared dark nav item styling (matches Admin sidebar) */
function DarkSidebarNavLink({ to, end, icon, label, layoutId, reduceMotion, hoverX }) {
  return (
    <NavLink to={to} end={end} className="block rounded-xl font-medium">
      {({ isActive }) => (
        <motion.div
          className={`relative flex items-center gap-3 overflow-hidden rounded-xl px-4 py-3 transition-colors duration-200 ${
            isActive ? 'text-white' : 'text-slate-400 hover:text-slate-100'
          }`}
          whileHover={
            isActive
              ? { scale: reduceMotion ? 1 : 1.02 }
              : {
                  x: hoverX,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  transition: { type: 'spring', stiffness: 380, damping: 28 }
                }
          }
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
          {isActive && (
            <motion.span
              layoutId={layoutId}
              className="absolute inset-0 -z-0 rounded-xl bg-gradient-to-r from-sky-600 to-violet-600 shadow-lg shadow-indigo-950/50"
              initial={false}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            />
          )}
          <span className="material-symbols-outlined relative z-10 shrink-0" style={{ fontSize: '1.25rem' }}>
            {icon}
          </span>
          <span className="relative z-10">{label}</span>
        </motion.div>
      )}
    </NavLink>
  )
}

export function StudentSidebar({ open, onClose }) {
  const reduceMotion = useReducedMotion()
  const hoverX = reduceMotion ? 0 : 6
  const links = [
    { to: '/student', end: true, icon: 'dashboard', label: 'Dashboard' },
    { to: '/student/submit', icon: 'edit_note', label: 'Submit Complaint' },
    { to: '/student/complaints', icon: 'assignment', label: 'My Complaints' },
    { to: '/student/status', icon: 'info', label: 'Status' },
    { to: '/student/notifications', icon: 'notifications', label: 'Notifications' },
    { to: '/student/profile', icon: 'person', label: 'Profile' }
  ]
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          aria-hidden
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800/90 bg-admin-sidebar shadow-2xl shadow-black/40 md:shadow-none transform transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between p-5 md:justify-start">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-sky-400">school</span>
            <span className="bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-lg font-bold tracking-tight text-transparent">
              CUIResolve
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100 md:hidden"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <nav className="flex-1 space-y-1.5 px-3">
          {links.map(({ to, end, icon, label }) => (
            <DarkSidebarNavLink
              key={to}
              to={to}
              end={!!end}
              icon={icon}
              label={label}
              layoutId="student-sidebar-active-pill"
              reduceMotion={reduceMotion}
              hoverX={hoverX}
            />
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-800/80 p-4">
          <p className="px-2 text-[10px] font-medium uppercase tracking-wider text-slate-600">Student portal</p>
        </div>
      </aside>
    </>
  )
}

export function AdminSidebar({ open, onClose }) {
  const reduceMotion = useReducedMotion()
  const hoverX = reduceMotion ? 0 : 6
  const links = [
    { to: '/admin', end: true, icon: 'dashboard', label: 'Overview' },
    { to: '/admin/complaints', icon: 'assignment', label: 'All Complaints' },
    { to: '/admin/staff', icon: 'groups', label: 'Staff' },
    { to: '/admin/config', icon: 'settings', label: 'Config' },
    { to: '/admin/reports', icon: 'analytics', label: 'Reports' },
    { to: '/admin/categories-departments', icon: 'category', label: 'Categories & departments' },
    { to: '/admin/profile', icon: 'person', label: 'Profile' }
  ]
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" aria-hidden onClick={onClose} />
      )}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800/90 bg-admin-sidebar shadow-2xl shadow-black/40 md:shadow-none transform transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between p-5 md:justify-start">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-sky-400">school</span>
            <span className="bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-lg font-bold tracking-tight text-transparent">
              CUIResolve
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100 md:hidden"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <nav className="flex-1 space-y-1.5 px-3">
          {links.map(({ to, end, icon, label }) => (
            <DarkSidebarNavLink
              key={to}
              to={to}
              end={!!end}
              icon={icon}
              label={label}
              layoutId="admin-sidebar-active-pill"
              reduceMotion={reduceMotion}
              hoverX={hoverX}
            />
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-800/80 p-4">
          <p className="px-2 text-[10px] font-medium uppercase tracking-wider text-slate-600">Admin console</p>
        </div>
      </aside>
    </>
  )
}

export function StaffSidebar({ open, onClose }) {
  const { profile } = useAuth()
  const reduceMotion = useReducedMotion()
  const hoverX = reduceMotion ? 0 : 6
  const links = [
    { to: '/staff', end: true, icon: 'dashboard', label: 'Dashboard' },
    { to: '/staff/tasks', icon: 'assignment', label: 'My Complaints' },
    { to: '/staff/reports', icon: 'analytics', label: 'Reports' },
    { to: '/staff/notifications', icon: 'notifications', label: 'Notifications' },
    { to: '/staff/profile', icon: 'person', label: 'Profile' }
  ]
  const displayName = profile?.full_name || 'Faculty'
  const initials = (displayName || '')
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'FD'
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          aria-hidden
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800/90 bg-admin-sidebar shadow-2xl shadow-black/40 md:shadow-none transform transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between p-5 md:justify-start">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-sky-400">school</span>
            <span className="bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-lg font-bold tracking-tight text-transparent">
              CUIResolve
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100 md:hidden"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <nav className="flex-1 space-y-1.5 px-3">
          {links.map(({ to, end, icon, label }) => (
            <DarkSidebarNavLink
              key={to}
              to={to}
              end={!!end}
              icon={icon}
              label={label}
              layoutId="staff-sidebar-active-pill"
              reduceMotion={reduceMotion}
              hoverX={hoverX}
            />
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-800/80 p-4">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-600/40 to-violet-600/40 text-xs font-bold text-sky-100">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-200">{displayName}</p>
              <p className="truncate text-xs text-slate-500">{profile?.department || '—'}</p>
            </div>
          </div>
          <p className="mt-3 px-2 text-[10px] font-medium uppercase tracking-wider text-slate-600">Faculty portal</p>
        </div>
      </aside>
    </>
  )
}
