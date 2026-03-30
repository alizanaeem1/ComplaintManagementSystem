import { motion } from 'framer-motion'

const statusStyles = {
  pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400',
  in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  resolved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  assigned: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
}

/** Admin console — high-contrast on dark cards + optional glow */
const adminStatusStyles = {
  pending: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/25',
  in_progress: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30',
  resolved: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30',
  assigned: 'bg-slate-600/35 text-slate-300 ring-1 ring-slate-500/25',
}

const adminStatusGlow = {
  pending: 'shadow-[0_0_16px_rgba(251,191,36,0.28)]',
  in_progress: 'shadow-[0_0_16px_rgba(56,189,248,0.3)]',
  resolved: 'shadow-[0_0_16px_rgba(52,211,153,0.28)]',
  assigned: 'shadow-[0_0_14px_rgba(148,163,184,0.22)]',
}

const priorityStyles = {
  high: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  medium: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  low: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500',
}

const badgeMotion = {
  initial: { opacity: 0, scale: 0.88 },
  animate: { opacity: 1, scale: 1 },
  transition: { type: 'spring', stiffness: 500, damping: 28 },
}

export function StatusBadge({ status, variant = 'default', glow = false }) {
  const s = (status || 'pending').toLowerCase().replace(/\s/g, '_')
  const admin = variant === 'admin' || variant === 'portal'
  const style = admin
    ? adminStatusStyles[s] || adminStatusStyles.assigned
    : statusStyles[s] || statusStyles.assigned
  const glowClass = admin && glow ? adminStatusGlow[s] || adminStatusGlow.assigned : ''
  const label = (status || 'Pending').replace(/_/g, ' ')
  return (
    <motion.span
      initial={badgeMotion.initial}
      animate={badgeMotion.animate}
      transition={badgeMotion.transition}
      whileHover={{ scale: 1.06, y: -1 }}
      whileTap={{ scale: 0.96 }}
      className={`inline-flex rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${style} ${glowClass}`}
    >
      {label}
    </motion.span>
  )
}

const portalPriorityStyles = {
  high: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/25',
  medium: 'bg-slate-600/35 text-slate-300 ring-1 ring-slate-500/25',
  low: 'bg-slate-600/25 text-slate-400 ring-1 ring-slate-500/20'
}

export function PriorityBadge({ priority, variant = 'default' }) {
  const p = (priority || 'medium').toLowerCase()
  const portal = variant === 'portal'
  const style = portal
    ? portalPriorityStyles[p] || portalPriorityStyles.medium
    : priorityStyles[p] || priorityStyles.medium
  return (
    <motion.span
      initial={badgeMotion.initial}
      animate={badgeMotion.animate}
      transition={badgeMotion.transition}
      whileHover={{ scale: 1.06, y: -1 }}
      whileTap={{ scale: 0.96 }}
      className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded ${style}`}
    >
      {priority || 'Medium'}
    </motion.span>
  )
}
