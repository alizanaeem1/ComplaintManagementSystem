/** Shimmer block — use for loading placeholders */
export function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-200/90 dark:bg-slate-700/80 ${className}`.trim()}
      aria-hidden
    />
  )
}

/** Table body placeholder (keeps column layout) */
export function TableRowsSkeleton({ rows = 6, columns = 5, variant }) {
  const darkTable = variant === 'admin' || variant === 'portal'
  const barClass = darkTable
    ? 'animate-pulse rounded-lg bg-slate-600/30'
    : 'animate-pulse rounded-lg bg-slate-200/90 dark:bg-slate-700/80'
  const rowClass = darkTable ? 'border-b border-slate-800/70' : 'border-b border-slate-100 dark:border-slate-700/50'
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className={rowClass}>
          {Array.from({ length: columns }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div
                aria-hidden
                className={`h-4 max-w-full ${barClass} ${
                  j === 0 ? 'w-16' : j === 2 ? 'w-48' : j === 3 ? 'w-20' : j === 5 || j === 6 ? 'w-28' : 'w-24'
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

/** Stat card placeholders */
export function StatCardsSkeleton({ count = 3, variant }) {
  const dark = variant === 'admin' || variant === 'portal'
  const cardClass = dark
    ? 'rounded-2xl border border-slate-700/50 bg-admin-card p-5 shadow-admin-card'
    : 'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-md'
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cardClass}>
          <Skeleton className="mb-3 h-3 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  )
}

/** Staff dashboard mini-cards */
/** Staff task list (left column) */
export function StaffComplaintListSkeleton({ count = 5 }) {
  return (
    <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-md"
        >
          <div className="flex justify-between items-start gap-2 mb-2">
            <Skeleton className="h-5 w-14 rounded-md" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-full max-w-[280px] mb-2" />
          <Skeleton className="h-3 w-2/3 max-w-[200px]" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function StaffStatCardsSkeleton({ count = 6, variant }) {
  const dark = variant === 'admin' || variant === 'portal'
  const cardClass = dark
    ? 'flex items-start gap-3 rounded-2xl border border-slate-700/50 bg-admin-card p-4 shadow-admin-card'
    : 'flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-md'
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cardClass}>
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-10" />
          </div>
        </div>
      ))}
    </div>
  )
}
