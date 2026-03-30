import { useAuth } from '../contexts/AuthContext'

/**
 * Full-width profile hero + content area (Student / Admin / Staff).
 */
export function ProfilePageLayout({
  roleBadge,
  title,
  subtitle,
  children,
  variant = 'default',
  /** Student portal: gradient hero name */
  titleHighlight = false
}) {
  const { user } = useAuth()
  const admin = variant === 'admin' || variant === 'portal'
  const portal = variant === 'portal'
  const safeTitle = (title || user?.email || 'User').trim()
  const initials = safeTitle
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="mx-auto w-full max-w-4xl px-0 pb-16 sm:px-2">
      <div
        className={
          admin
            ? 'mb-8 overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-sky-600/15 via-violet-600/10 to-admin-card shadow-admin-card'
            : 'mb-8 overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-primary/25 via-primary/8 to-slate-50 shadow-xl dark:border-slate-700 dark:from-primary/30 dark:via-slate-900 dark:to-slate-950'
        }
      >
        <div className="flex flex-col items-center gap-8 px-6 py-10 sm:flex-row md:px-12 md:py-14">
          <div
            className={
              admin
                ? 'flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-600 to-violet-600 text-4xl font-bold text-white shadow-xl ring-4 ring-slate-800 md:h-36 md:w-36 md:text-5xl'
                : 'flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-primary text-4xl font-bold text-white shadow-xl ring-4 ring-white dark:ring-slate-800 md:h-36 md:w-36 md:text-5xl'
            }
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p
              className={
                admin
                  ? 'bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-xs font-bold uppercase tracking-[0.2em] text-transparent'
                  : 'text-xs font-bold uppercase tracking-[0.2em] text-primary'
              }
            >
              {roleBadge}
            </p>
            <h1
              className={`mt-2 break-words text-3xl font-bold tracking-tight md:text-4xl lg:text-[2.5rem] ${
                titleHighlight && portal
                  ? 'bg-gradient-to-r from-sky-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent'
                  : admin
                    ? 'text-slate-100'
                    : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {safeTitle}
            </h1>
            <p className={`mt-3 break-all text-base md:text-lg ${admin ? 'text-slate-400' : 'text-slate-600 dark:text-slate-400'}`}>
              {user?.email}
            </p>
            {subtitle && (
              <p
                className={`mx-auto mt-4 max-w-2xl text-sm leading-relaxed sm:mx-0 ${
                  admin ? 'text-slate-500' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  )
}
