import { useEffect, useState, useRef } from 'react'
import { animate } from 'framer-motion'

/**
 * Counts up/down to `value` with easing — for dashboard KPIs.
 */
export function AnimatedCounter({ value = 0, duration = 0.75, className = '' }) {
  const [display, setDisplay] = useState(() => Math.round(Number(value) || 0))
  const fromRef = useRef(display)

  useEffect(() => {
    const target = Math.round(Number(value) || 0)
    const start = fromRef.current
    const controls = animate(start, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        const n = Math.round(latest)
        setDisplay(n)
        fromRef.current = latest
      },
      onComplete: () => {
        fromRef.current = target
        setDisplay(target)
      }
    })
    return () => controls.stop()
  }, [value, duration])

  return <span className={`tabular-nums ${className}`.trim()}>{display}</span>
}
