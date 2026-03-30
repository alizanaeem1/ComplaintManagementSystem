import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      if (sessionStorage.getItem('demoUser')) {
        setProfile({
          role: sessionStorage.getItem('demoRole') || 'student',
          full_name: sessionStorage.getItem('demoFullName') || 'Demo User',
          registration_number: sessionStorage.getItem('demoRegistrationNumber') || ''
        })
      }
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) fetchProfile(session.user.id)
        else { setProfile(null); setLoading(false) }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      setProfile(data ?? { role: 'student', full_name: 'User' })
    } catch (_) {
      setProfile({ role: 'student', full_name: 'User' })
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    if (!supabase) return { error: { message: 'Demo mode: use any email/password and choose role above.' } }
    return supabase.auth.signInWithPassword({ email, password })
  }

  const signUp = async (email, password, metadata = {}) => {
    if (!supabase) return { error: { message: 'Demo mode: sign in with role above instead of signing up.' } }
    return supabase.auth.signUp({ email, password, options: { data: metadata } })
  }

  const signOut = async () => {
    sessionStorage.removeItem('demoUser')
    sessionStorage.removeItem('demoRole')
    if (supabase) await supabase.auth.signOut()
  }

  const updateProfile = async (updates) => {
    if (!supabase) {
      if (updates.full_name != null) {
        sessionStorage.setItem('demoFullName', updates.full_name)
        setProfile((prev) => ({ ...prev, role: prev?.role || 'student', full_name: updates.full_name }))
      }
      if (updates.registration_number != null) {
        sessionStorage.setItem('demoRegistrationNumber', updates.registration_number)
        setProfile((prev) => ({ ...prev, registration_number: updates.registration_number }))
      }
      return {}
    }
    if (!user?.id) return { error: { message: 'Not signed in.' } }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) return { error }
      await fetchProfile(user.id)
      return {}
    } catch (e) {
      return { error: { message: e?.message || 'Update failed.' } }
    }
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    isAdmin: profile?.role === 'admin',
    isStaff: profile?.role === 'staff',
    isStudent: profile?.role === 'student' || !profile?.role,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
