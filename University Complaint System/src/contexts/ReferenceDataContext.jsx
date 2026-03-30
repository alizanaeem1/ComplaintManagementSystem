import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import {
  FALLBACK_CATEGORIES,
  FALLBACK_DEPARTMENTS,
  loadMergedCategories,
  loadMergedDepartments
} from '../lib/addonReference.js'

const ReferenceDataContext = createContext({
  categories: FALLBACK_CATEGORIES,
  departments: FALLBACK_DEPARTMENTS,
  loading: false,
  error: null,
  refreshReferenceData: async () => {}
})

export function ReferenceDataProvider({ children }) {
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES)
  const [departments, setDepartments] = useState(FALLBACK_DEPARTMENTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refreshReferenceData = useCallback(async () => {
    if (!supabase) {
      setCategories([...FALLBACK_CATEGORIES])
      setDepartments([...FALLBACK_DEPARTMENTS])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [c, d] = await Promise.all([loadMergedCategories(), loadMergedDepartments()])
      setCategories(c)
      setDepartments(d)
    } catch (e) {
      setError(e)
      setCategories([...FALLBACK_CATEGORIES])
      setDepartments([...FALLBACK_DEPARTMENTS])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshReferenceData()
  }, [refreshReferenceData])

  const value = useMemo(
    () => ({
      categories,
      departments,
      loading,
      error,
      refreshReferenceData
    }),
    [categories, departments, loading, error, refreshReferenceData]
  )

  return <ReferenceDataContext.Provider value={value}>{children}</ReferenceDataContext.Provider>
}

export function useReferenceData() {
  return useContext(ReferenceDataContext)
}
