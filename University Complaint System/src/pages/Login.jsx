import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient.js'

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

/** Label above field + left icon — avoids floating-label / peer bugs (overlap with value). */
function LabeledInput({
  id,
  type = 'text',
  value,
  onChange,
  label,
  icon,
  autoComplete,
  required,
  minLength,
  rightSlot,
  inputClassName = '',
  labelRight,
  placeholder
}) {
  return (
    <div className="group/input space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[11px] font-medium text-slate-400 sm:text-xs">
          {label}
        </label>
        {labelRight}
      </div>
      <div className="relative">
        <div
          className="pointer-events-none absolute -inset-px rounded-lg opacity-0 transition-opacity duration-300 group-focus-within/input:opacity-100"
          style={{
            background:
              'linear-gradient(135deg, rgba(56, 189, 248, 0.4), rgba(129, 140, 248, 0.35), rgba(167, 139, 250, 0.3))',
            filter: 'blur(6px)'
          }}
          aria-hidden
        />
        <div className="relative rounded-lg bg-white/[0.06] ring-1 ring-white/[0.1] transition-[box-shadow,background-color] duration-300 group-focus-within/input:bg-white/[0.09] group-focus-within/input:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_0_16px_-4px_rgba(56,189,248,0.28)]">
          <span className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within/input:text-sky-300">
            <span className="material-symbols-outlined text-[1.05rem]">{icon}</span>
          </span>
          <input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder ?? ''}
            autoComplete={autoComplete}
            required={required}
            minLength={minLength}
            className={`w-full rounded-lg border-0 bg-transparent px-2.5 py-2 pl-9 text-sm leading-normal text-white placeholder:text-slate-500 shadow-none outline-none ring-0 focus:ring-0 sm:py-2 sm:text-[15px] ${inputClassName}`}
          />
          {rightSlot}
        </div>
      </div>
    </div>
  )
}

export function Login({ adminEntry = false }) {
  const [logoFailed, setLogoFailed] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [demoRole, setDemoRole] = useState(adminEntry ? 'admin' : 'student')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotBusy, setForgotBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (adminEntry) {
      setDemoRole('admin')
      try {
        localStorage.setItem('selectedRole', 'admin')
      } catch (_) {
        /* ignore */
      }
      return
    }
    try {
      const saved = localStorage.getItem('selectedRole')
      if (saved === 'student' || saved === 'staff') {
        setDemoRole(saved)
      }
    } catch (_) {
      /* ignore */
    }
  }, [adminEntry])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const withTimeout = (promise, ms, msg) =>
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms))
      ])

    try {
      const { data: signInData, error: err } = await withTimeout(
        signIn(email, password),
        10000,
        'Login timed out. Check your connection and .env (Supabase URL/Key).'
      )
      if (err) throw err

      if (supabase && signInData?.user) {
        const { data: profileData } = await supabase.from('profiles').select('role').eq('id', signInData.user.id).maybeSingle()
        const roleFromProfile = profileData?.role || signInData?.user?.user_metadata?.role
        const intendedRole = adminEntry ? 'admin' : demoRole

        // Role Validation: Allow admins to enter management portal, but keep student portal restricted
        const isAuthorized = 
          roleFromProfile === intendedRole || 
          (intendedRole === 'staff' && roleFromProfile === 'admin')

        if (!isAuthorized) {
          await supabase.auth.signOut()
          setLoading(false)
          setError(`Unauthorized Access: Your account is registered as '${roleFromProfile}', but you are trying to access the '${intendedRole}' portal. Please use the correct portal.`)
          return
        }

        setLoading(false)
        if (roleFromProfile === 'admin') navigate('/admin')
        else if (roleFromProfile === 'staff') navigate('/staff')
        else navigate('/student')
      } else {
        sessionStorage.setItem('demoUser', '1')
        sessionStorage.setItem('demoRole', demoRole)
        setLoading(false)
        navigate(demoRole === 'admin' ? '/admin' : demoRole === 'staff' ? '/staff' : '/student')
      }
    } catch (e) {
      const msg = e?.message || ''
      if (msg.includes('Demo mode') || msg.includes('Supabase') || msg.includes('not configured')) {
        sessionStorage.setItem('demoUser', '1')
        sessionStorage.setItem('demoRole', demoRole)
        navigate(demoRole === 'admin' ? '/admin' : demoRole === 'staff' ? '/staff' : '/student')
      } else {
        setError(msg || 'Something went wrong')
      }
    } finally {
      setLoading(false)
    }
  }

  const isDemoMode = !supabase

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.92, y: 28 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.55,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.12 + i * 0.06,
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1]
      }
    })
  }

  return (
    <div className="relative flex h-dvh max-h-dvh w-full flex-col items-center justify-center overflow-hidden overscroll-none bg-[#030712] px-3 py-2 sm:px-4">
      {/* Base + slow animated gradient mesh */}
      <div className="absolute inset-0 bg-[#030712]" aria-hidden />
      {/* Slow-shifting gradient layers (crossfade — reliable vs animating gradient strings) */}
      <div className="absolute inset-0 opacity-[0.88]" aria-hidden>
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(125deg, #0c1222 0%, #1e1b4b 42%, #134e4a 88%)'
          }}
          animate={reduceMotion ? {} : { opacity: [1, 0.35, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #164e63 0%, #312e81 45%, #0f172a 100%)'
          }}
          animate={reduceMotion ? {} : { opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 3.5 }}
        />
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(105deg, #1e293b 0%, #4c1d95 50%, #0e7490 100%)'
          }}
          animate={reduceMotion ? {} : { opacity: [0.2, 0.75, 0.2] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 7 }}
        />
      </div>

      {/* Floating orbs — slow drift */}
      <motion.div
        className="absolute -left-[25%] top-[-20%] h-[min(90vw,520px)] w-[min(90vw,520px)] rounded-full bg-indigo-500/[0.22] blur-[100px]"
        animate={
          reduceMotion
            ? {}
            : {
                x: [0, 40, 0],
                y: [0, 30, 0],
                scale: [1, 1.08, 1]
              }
        }
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />
      <motion.div
        className="absolute -right-[20%] bottom-[-25%] h-[min(85vw,480px)] w-[min(85vw,480px)] rounded-full bg-cyan-400/[0.18] blur-[110px]"
        animate={
          reduceMotion
            ? {}
            : {
                x: [0, -35, 0],
                y: [0, -40, 0],
                scale: [1, 1.06, 1]
              }
        }
        transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        aria-hidden
      />
      <motion.div
        className="absolute left-1/2 top-1/3 h-[min(70vw,380px)] w-[min(70vw,380px)] -translate-x-1/2 rounded-full bg-violet-500/[0.14] blur-[90px]"
        animate={reduceMotion ? {} : { opacity: [0.35, 0.6, 0.35], scale: [1, 1.12, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 75%)'
        }}
        aria-hidden
      />

      <div className="relative z-10 flex w-full min-h-0 max-w-[380px] shrink flex-col justify-center gap-1.5">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0"
        >
          {isDemoMode && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-lg border border-amber-400/25 bg-amber-500/[0.08] px-2 py-1.5 text-[10px] leading-tight text-amber-100/95 shadow-sm backdrop-blur-xl sm:text-xs"
            >
              {adminEntry ? (
                <>
                  <strong className="font-semibold text-amber-50">Admin demo.</strong> No Supabase — use any email/password.
                </>
              ) : (
                <>
                  <strong className="font-semibold text-amber-50">Demo mode.</strong> No Supabase — pick role below and use any
                  email/password.
                </>
              )}
            </motion.div>
          )}
        </motion.div>

        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="relative min-h-0 shrink overflow-hidden rounded-2xl border border-white/[0.12] bg-white/[0.06] shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_24px_80px_-24px_rgba(0,0,0,0.6),0_0_60px_-16px_rgba(56,189,248,0.1)] backdrop-blur-2xl"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" aria-hidden />
          <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" aria-hidden />

          <div className="relative px-4 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4">
            <Link
              to="/"
              className="group/back absolute left-3 top-3 z-20 inline-flex items-center gap-0.5 text-[11px] font-medium text-slate-400 transition-colors hover:text-white sm:left-4 sm:top-4 sm:gap-1 sm:text-xs"
            >
              <span className="material-symbols-outlined text-base transition-transform group-hover/back:-translate-x-0.5 sm:text-lg">
                arrow_back
              </span>
              Back to home
            </Link>

            {/* Hero: dead-center — logo, brand, Welcome Back, tagline */}
            <div className="mx-auto flex w-full flex-col items-center px-1 pb-0 pt-9 text-center sm:pt-10">
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.08, type: 'spring', stiffness: 320, damping: 26 }}
                className="flex w-full max-w-sm flex-col items-center justify-center text-center"
              >
                <motion.div
                  animate={reduceMotion ? {} : { y: [0, -3, 0] }}
                  transition={reduceMotion ? {} : { duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex shrink-0 items-center justify-center"
                >
                  {/* overflow-hidden + rounded-full = logo bilkul circle ke andar clip */}
                  <div className="box-border flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white p-1 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.45)] ring-1 ring-white/35 sm:h-[4.25rem] sm:w-[4.25rem] sm:p-1.5">
                    {!logoFailed ? (
                      <img
                        src="/comsats-logo.png"
                        alt="COMSATS University Islamabad"
                        className="h-full w-full max-h-full max-w-full scale-[0.92] object-contain object-center"
                        onError={() => setLogoFailed(true)}
                      />
                    ) : (
                      <span className="material-symbols-outlined text-3xl text-slate-700 sm:text-4xl">
                        {adminEntry ? 'admin_panel_settings' : 'school'}
                      </span>
                    )}
                  </div>
                </motion.div>
                <p className="mt-1.5 w-full text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-200/85 sm:text-[10px]">
                  CUIResolve
                </p>
                <h1 className="mt-1.5 w-full text-center leading-tight tracking-tight">
                  {!adminEntry ? (
                    <span
                      className={`inline-block whitespace-nowrap text-lg font-bold sm:text-xl md:text-2xl ${
                        reduceMotion
                          ? 'bg-gradient-to-r from-violet-300 via-fuchsia-200 to-white bg-clip-text text-transparent'
                          : 'login-welcome-shimmer'
                      }`}
                    >
                      Welcome back
                    </span>
                  ) : (
                    <span
                      className={`inline-block whitespace-nowrap text-lg font-bold sm:text-xl md:text-2xl ${
                        reduceMotion
                          ? 'bg-gradient-to-r from-violet-300 via-fuchsia-200 to-white bg-clip-text text-transparent'
                          : 'login-welcome-shimmer'
                      }`}
                    >
                      Admin Access
                    </span>
                  )}
                </h1>
                {!adminEntry && (
                  <p className="mt-1.5 w-full max-w-[20rem] px-1 text-center text-xs font-medium leading-snug tracking-wide text-slate-300 sm:max-w-[24rem] sm:text-[0.8125rem]">
                    Sign in to manage your university concerns.
                  </p>
                )}
                {adminEntry && (
                  <p className="mt-1.5 w-full max-w-[20rem] px-1 text-center text-xs font-medium leading-snug tracking-wide text-slate-300 sm:max-w-[24rem] sm:text-[0.8125rem]">
                    Sign in to continue to the admin workspace.
                  </p>
                )}
              </motion.div>
            </div>

            <form onSubmit={handleSubmit} className="mt-3 space-y-2 sm:mt-3.5 sm:space-y-2.5">
              <motion.div custom={2} variants={itemVariants} initial="hidden" animate="visible">
                <LabeledInput
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  label="University email"
                  placeholder="you@university.edu"
                  icon="mail"
                  autoComplete="email"
                  required
                />
              </motion.div>

              <motion.div custom={3} variants={itemVariants} initial="hidden" animate="visible">
                <LabeledInput
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  label="Password"
                  placeholder="Enter your password"
                  icon="lock"
                  autoComplete="current-password"
                  required
                  minLength={6}
                  inputClassName="pr-11"
                  labelRight={
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-sky-300/90 transition-colors hover:text-sky-100 sm:text-sm"
                      onClick={() => setForgotOpen(true)}
                    >
                      Forgot?
                    </button>
                  }
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                      aria-label="Toggle password visibility"
                    >
                      <span className="material-symbols-outlined text-[1.15rem]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  }
                />
              </motion.div>

              {isDemoMode && !adminEntry && (
                <motion.div custom={4} variants={itemVariants} initial="hidden" animate="visible" className="space-y-1">
                  <label htmlFor="login-demo-role" className="block text-[11px] font-semibold uppercase tracking-wider text-sky-200/70 sm:text-xs">
                    Select role
                  </label>
                  <div className="group/select relative">
                    <div
                      className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-focus-within/select:opacity-100"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(56, 189, 248, 0.35), rgba(129, 140, 248, 0.3))',
                        filter: 'blur(8px)'
                      }}
                      aria-hidden
                    />
                    <div className="relative rounded-xl bg-white/[0.06] ring-1 ring-white/[0.08] transition-shadow duration-300 group-focus-within/select:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_0_20px_-4px_rgba(56,189,248,0.28)]">
                      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400 group-focus-within/select:text-sky-300">
                        <span className="material-symbols-outlined text-[1.15rem]">badge</span>
                      </span>
                      <select
                        id="login-demo-role"
                        value={demoRole}
                        onChange={(e) => {
                          const v = e.target.value
                          setDemoRole(v)
                          try {
                            localStorage.setItem('selectedRole', v)
                          } catch (_) {
                            /* ignore */
                          }
                        }}
                        className="w-full cursor-pointer appearance-none rounded-lg border-0 bg-transparent py-2 pl-9 pr-2 text-sm text-white outline-none ring-0 focus:ring-0 sm:text-[15px]"
                      >
                        <option value="student" className="bg-slate-900 text-white">
                          Student
                        </option>
                        <option value="staff" className="bg-slate-900 text-white">
                          Faculty (Staff)
                        </option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}

              <motion.div custom={5} variants={itemVariants} initial="hidden" animate="visible">
                <label className="group/rem flex cursor-pointer items-center gap-2 text-xs text-slate-300 transition-colors duration-200 hover:text-white sm:text-sm">
                  <span className="relative flex h-4 w-4 shrink-0 items-center justify-center sm:h-[1.125rem] sm:w-[1.125rem]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-white/20 bg-white/[0.06] transition-all duration-200 checked:border-sky-400/50 checked:bg-gradient-to-br checked:from-sky-500 checked:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:ring-offset-0 sm:h-[1.125rem] sm:w-[1.125rem]"
                    />
                    <span className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100">
                      <span className="material-symbols-outlined text-xs font-bold sm:text-sm">check</span>
                    </span>
                  </span>
                  Remember this device
                </label>
              </motion.div>

              <AnimatePresence mode="wait">
                {error && (
                  <motion.p
                    key={error}
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden text-sm"
                  >
                    <span className="block rounded-xl border border-red-400/25 bg-red-500/[0.12] px-3 py-2 text-sm text-red-100 backdrop-blur-md">
                      {error}
                    </span>
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.div custom={6} variants={itemVariants} initial="hidden" animate="visible" className="pt-0.5">
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={
                    reduceMotion || loading
                      ? {}
                      : {
                          scale: 1.015,
                          boxShadow: '0 0 40px -4px rgba(56, 189, 248, 0.45), 0 0 60px -8px rgba(129, 140, 248, 0.35)'
                        }
                  }
                  whileTap={reduceMotion || loading ? {} : { scale: 0.985 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                  className="group/submit relative flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-lg py-2 text-sm font-semibold text-white shadow-[0_4px_24px_-4px_rgba(14,165,233,0.45)] transition-shadow duration-300 disabled:pointer-events-none disabled:opacity-55 sm:py-2.5 sm:text-[15px]"
                  style={{
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 48%, #8b5cf6 100%)'
                  }}
                >
                  <span
                    className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/submit:opacity-100"
                    style={{
                      background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #a78bfa 100%)'
                    }}
                    aria-hidden
                  />
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" aria-hidden />
                  <span className="relative flex items-center gap-2">
                    {loading ? (
                      <>
                        <Spinner />
                        <span>Signing in…</span>
                      </>
                    ) : (
                      <>
                        <span>Continue to dashboard</span>
                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                      </>
                    )}
                  </span>
                </motion.button>
              </motion.div>

              {isDemoMode && !adminEntry && (
                <p className="text-center text-[10px] leading-tight text-slate-500 sm:text-xs">Demo: any email/password with selected role.</p>
              )}
              {isDemoMode && adminEntry && (
                <p className="text-center text-[10px] leading-tight text-slate-500 sm:text-xs">Demo: any email/password works.</p>
              )}

              {!isDemoMode && (
                <p className="text-center text-[10px] leading-tight text-slate-500 sm:text-xs">
                  New? Contact administration for credentials.
                </p>
              )}
            </form>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {forgotOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <motion.div
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
              onClick={() => {
                if (!forgotBusy) setForgotOpen(false)
              }}
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="relative w-full max-w-[400px] overflow-hidden rounded-[1.5rem] border border-white/[0.12] bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset,0_40px_100px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" aria-hidden />
              <div className="px-8 py-9 sm:px-10">
                <motion.div
                  animate={reduceMotion ? {} : { y: [0, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-white/[0.15] to-white/[0.05] ring-1 ring-white/15"
                >
                  <span className="material-symbols-outlined text-4xl text-sky-200">help</span>
                </motion.div>
                <h2 className="mb-2 text-center text-xl font-semibold tracking-tight text-white">Password recovery</h2>
                <p className="text-center text-sm leading-relaxed text-slate-400">
                  Contact your administrator if you forgot your password. They can reset your credentials securely.
                </p>
                <div className="mt-8">
                  <motion.button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    disabled={forgotBusy}
                    whileHover={reduceMotion ? {} : { scale: 1.02 }}
                    whileTap={reduceMotion ? {} : { scale: 0.98 }}
                    className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white shadow-lg transition-[filter] duration-200 disabled:pointer-events-none disabled:opacity-60"
                    style={{
                      background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
                      boxShadow: '0 8px 32px -8px rgba(14, 165, 233, 0.4)'
                    }}
                  >
                    {forgotBusy ? 'Please wait...' : 'Got it'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
