import { useState, useEffect, useCallback } from 'react'
import { fetchComplaints, subscribeComplaints } from '../lib/complaints.js'

export function useComplaintsList(filters) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: e } = await fetchComplaints(filters)
    setLoading(false)
    if (e) setError(e.message)
    else setList(data || [])
  }, [filters?.userId, filters?.role, filters?.department, filters?.status, filters?.search])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const unsub = subscribeComplaints(load)
    return unsub
  }, [load])

  return { list, loading, error, refresh: load }
}
