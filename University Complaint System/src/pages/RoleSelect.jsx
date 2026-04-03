import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { DevelopmentTeamSection } from '../components/DevelopmentTeamSection'

const STORAGE_KEY = 'selectedRole'

const ROLES = [
  {
    id: 'student',
    title: 'Student',
    description: 'Submit complaints, track status, and manage your profile.',
    icon: 'school',
    accent: 'from-sky-400/30 to-cyan-500/20',
    ring: 'group-hover:shadow-sky-500/25'
  },
  {
    id: 'staff',
    title: 'Management Portal',
    description: 'Monitor, manage, and resolve university complaints efficiently.',
    icon: 'admin_panel_settings',
    accent: 'from-violet-400/30 to-fuchsia-500/20',
    ring: 'group-hover:shadow-violet-500/25'
  }
]

function RippleLayer({ ripples }) {
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      <AnimatePresence>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            className="absolute rounded-full bg-white/50"
            style={{
              left: r.x,
              top: r.y,
              width: 12,
              height: 12,
              marginLeft: -6,
              marginTop: -6
            }}
            initial={{ scale: 0, opacity: 0.55 }}
            animate={{ scale: 28, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </AnimatePresence>
    </span>
  )
}

function RoleCard({ role, index, onSelect }) {
  const ref = useRef(null)
  const [ripples, setRipples] = useState([])

  const handlePointerDown = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = `${Date.now()}-${Math.random()}`
    setRipples((prev) => [...prev, { id, x, y }])
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((p) => p.id !== id))
    }, 700)
  }

  const handleClick = () => {
    try {
      localStorage.setItem(STORAGE_KEY, role.id)
    } catch (_) {
      /* ignore quota / private mode */
    }
    window.setTimeout(() => onSelect(), 320)
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      initial={{ opacity: 0, y: 36 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.12 + index * 0.1,
        duration: 0.55,
        ease: [0.22, 1, 0.36, 1]
      }}
      whileHover={{ scale: 1.035, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      className={`group relative flex flex-col items-start text-left w-full rounded-2xl border border-white/25 bg-white/10 dark:bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.45)] p-6 md:p-8 overflow-hidden transition-shadow duration-300 hover:border-white/40 hover:shadow-2xl ${role.ring}`}
    >
      <RippleLayer ripples={ripples} />
      <div
        className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br opacity-60 blur-2xl ${role.accent}`}
        aria-hidden
      />
      <div className="relative z-[1] flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-white shadow-inner ring-1 ring-white/30">
        <span className="material-symbols-outlined text-2xl">{role.icon}</span>
      </div>
      <h2 className="relative z-[1] mt-5 text-xl font-bold tracking-tight text-white md:text-2xl">{role.title}</h2>
      <p className="relative z-[1] mt-2 text-sm leading-relaxed text-white/75 md:text-[0.95rem]">{role.description}</p>
      <span className="relative z-[1] mt-6 inline-flex items-center gap-1 text-sm font-semibold text-white/90">
        Continue
        <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-0.5">arrow_forward</span>
      </span>
    </motion.button>
  )
}

export function RoleSelect() {
  const navigate = useNavigate()
  const { user, profile, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    const demo = sessionStorage.getItem('demoUser')
    if (user || demo) {
      const r = profile?.role || sessionStorage.getItem('demoRole') || 'student'
      const path = r === 'admin' ? '/admin' : r === 'staff' ? '/staff' : '/student'
      navigate(path, { replace: true })
    }
  }, [loading, user, profile, navigate])

  const handleSelected = () => {
    navigate('/login', { replace: false })
  }

  return (
    <div className="relative min-h-screen w-full overflow-clip bg-[#070b14] text-slate-100">
      {/* Gradient mesh background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0c4a6e]" />
      <motion.div
        className="absolute -left-1/4 top-0 h-[70vh] w-[70vh] rounded-full bg-indigo-600/40 blur-[120px]"
        animate={{ scale: [1, 1.08, 1], opacity: [0.45, 0.6, 0.45] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-1/4 bottom-0 h-[60vh] w-[60vh] rounded-full bg-cyan-500/35 blur-[100px]"
        animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.5, 0.35] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <motion.div
        className="absolute left-1/2 top-1/3 h-[40vh] w-[40vh] -translate-x-1/2 rounded-full bg-violet-600/30 blur-[90px]"
        animate={{ y: [0, 24, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: '48px 48px'
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-8 px-4 py-8 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">Welcome to</p>
          <h1 className="mt-2 text-5xl font-black tracking-tighter text-white md:text-7xl">
            CUI<span className="bg-gradient-to-r from-sky-400 to-violet-500 bg-clip-text text-transparent">Resolve</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[0.9rem] font-medium tracking-wide text-white/80 md:text-lg">
            The Official University Complaint Management System
          </p>
          <div className="mx-auto mt-6 mb-6 h-px w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <p className="max-w-2xl mx-auto text-sm font-semibold text-white/50 leading-relaxed">
            Pick your access point to manage complaints or oversee university operations.
          </p>
        </motion.div>

        <div className="mx-auto grid w-full max-w-3xl gap-5 md:grid-cols-2 lg:gap-8">
          {ROLES.map((role, i) => (
            <RoleCard key={role.id} role={role} index={i} onSelect={handleSelected} />
          ))}
        </div>
      </div>
      
      <DevelopmentTeamSection />
    </div>
  )
}
