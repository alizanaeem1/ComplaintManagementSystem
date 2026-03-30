import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Header({
  title,
  showSearch = false,
  searchPlaceholder = 'Search...',
  onSearch,
  onMenuClick,
  notificationCount = 0,
  /** Admin: if set, bell calls this instead of navigating (e.g. open notifications panel). */
  onNotificationsClick,
  /** `admin` | `portal` = dark console bar; `default` = legacy light header */
  variant = 'default'
}) {
  const darkShell = variant === 'admin' || variant === 'portal'
  const [query, setQuery] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const profileMenuRef = useRef(null)
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const base = location.pathname.split('/')[1] || 'student'
  const role = profile?.role || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('demoRole') : null) || 'student'
  const profilePagePath =
    role === 'admin' ? '/admin/profile' : role === 'staff' ? '/staff/profile' : '/student/profile'

  const initials = (profile?.full_name || user?.email || 'U')
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
    setProfileOpen(false)
  }

  useEffect(() => {
    if (!profileOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setProfileOpen(false)
    }
    const onPointer = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) setProfileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer, { passive: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
    }
  }, [profileOpen])

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User'

  return (
    <header
      className={
        darkShell
          ? 'h-16 flex shrink-0 items-center justify-between border-b border-slate-800/90 bg-admin-bg px-4 text-slate-100 md:px-6'
          : 'h-16 shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-900 md:px-6'
      }
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className={
            darkShell
              ? 'rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100 md:hidden'
              : 'rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden'
          }
          aria-label="Menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h1
          className={
            darkShell
              ? 'truncate bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-lg font-bold text-transparent md:text-xl'
              : 'truncate text-lg font-bold text-slate-900 dark:text-slate-100 md:text-xl'
          }
        >
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        {showSearch && (
          <div className="relative hidden sm:block">
            <span
              className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm ${darkShell ? 'text-slate-500' : 'text-slate-400'}`}
            >
              search
            </span>
            <input
              type="text"
              className={
                darkShell
                  ? 'admin-input w-48 pl-10 pr-4 md:w-64'
                  : 'w-48 rounded-lg border border-slate-200 bg-slate-100 py-2 pl-10 pr-4 text-sm focus:border-primary focus:ring-2 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 md:w-64'
              }
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                onSearch?.(e.target.value)
              }}
            />
          </div>
        )}
        <button
          type="button"
          className={
            darkShell
              ? 'relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100'
              : 'relative rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }
          aria-label="Notifications"
          onClick={() => {
            if (typeof onNotificationsClick === 'function') {
              onNotificationsClick()
              return
            }
            if (base === 'staff') navigate('/staff/tasks?unread=1')
            else if (base === 'admin') navigate('/admin/complaints?status=pending')
            else navigate('/student/complaints?unread=1')
          }}
        >
          <span className="material-symbols-outlined">notifications</span>
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>
        <div className="relative" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            className={
              darkShell
                ? 'flex items-center gap-2.5 rounded-xl p-1.5 pr-2 transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40'
                : 'flex items-center gap-2.5 rounded-xl p-1.5 pr-2 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:hover:bg-slate-800'
            }
          >
            {/* Same avatar + label + chevron for Admin, Student & Faculty */}
            <div
              className={
                darkShell
                  ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/50 to-violet-600/50 text-sm font-bold text-white shadow-md ring-2 ring-slate-700/80'
                  : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/50 to-violet-600/50 text-sm font-bold text-white shadow-md ring-2 ring-slate-200/90 dark:ring-slate-700/80'
              }
              title="Profile menu"
            >
              {initials}
            </div>
            <span
              className={`max-w-[5.5rem] truncate text-sm font-semibold sm:max-w-[140px] ${darkShell ? 'text-slate-100' : 'text-slate-800 dark:text-slate-100'}`}
            >
              {displayName}
            </span>
            <span
              className={`material-symbols-outlined shrink-0 text-xl transition-transform duration-200 ${profileOpen ? '-rotate-180' : ''} text-slate-500 dark:text-slate-500`}
              aria-hidden
            >
              expand_more
            </span>
          </button>
          {profileOpen && (
            <div
              role="menu"
              aria-label="Account menu"
              className="absolute right-0 top-[calc(100%+0.5rem)] z-[100] min-w-[17.5rem] overflow-hidden rounded-2xl border border-slate-700/90 bg-[#131c2e] py-0 shadow-2xl shadow-black/50 ring-1 ring-white/[0.04]"
            >
              {/* Section 1 — avatar + naam + email (same for Admin / Student / Faculty) */}
              <div className="flex items-center gap-3 px-4 py-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/50 to-violet-600/50 text-base font-bold text-white shadow-md ring-2 ring-slate-700/80"
                  aria-hidden
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold leading-tight text-white">{displayName}</p>
                  <p className="mt-0.5 truncate text-sm text-slate-400">{user?.email || '—'}</p>
                </div>
              </div>
              <div className="h-px bg-slate-700/80" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false)
                  navigate(profilePagePath)
                }}
                className="flex w-full items-center px-4 py-3.5 text-left text-sm font-medium text-slate-100 transition-colors hover:bg-white/[0.06]"
              >
                Profile
              </button>
              <div className="h-px bg-slate-700/80" />
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="flex w-full items-center px-4 py-3.5 text-left text-sm font-semibold text-rose-400 transition-colors hover:bg-rose-500/[0.08]"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
