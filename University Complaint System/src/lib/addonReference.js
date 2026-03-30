import { supabase } from './supabaseClient.js'

/** Defaults when DB empty or offline — merged with DB rows in context */
export const FALLBACK_CATEGORIES = ['Academic', 'Hostel', 'IT', 'Administration', 'Other']
export const FALLBACK_DEPARTMENTS = ['IT', 'Academic', 'Hostel', 'Administration', 'Maintenance']

function mergeUnique(primaryFromDb, fallbacks) {
  const set = new Map()
  for (const n of primaryFromDb || []) {
    const t = String(n || '').trim()
    if (t) set.set(t.toLowerCase(), t)
  }
  for (const f of fallbacks) {
    const t = String(f || '').trim()
    if (t && !set.has(t.toLowerCase())) set.set(t.toLowerCase(), t)
  }
  return [...set.values()].sort((a, b) => a.localeCompare(b))
}

export async function fetchCategoriesFromDb() {
  if (!supabase) return []
  const { data, error } = await supabase.from('categories').select('name').order('name', { ascending: true })
  if (error) throw error
  return (data || []).map((r) => r.name).filter(Boolean)
}

export async function fetchDepartmentsFromDb() {
  if (!supabase) return []
  const { data, error } = await supabase.from('departments').select('name').order('name', { ascending: true })
  if (error) throw error
  return (data || []).map((r) => r.name).filter(Boolean)
}

/** Merged lists for dropdowns */
export async function loadMergedCategories() {
  try {
    const db = await fetchCategoriesFromDb()
    return mergeUnique(db, FALLBACK_CATEGORIES)
  } catch {
    return [...FALLBACK_CATEGORIES]
  }
}

export async function loadMergedDepartments() {
  try {
    const db = await fetchDepartmentsFromDb()
    return mergeUnique(db, FALLBACK_DEPARTMENTS)
  } catch {
    return [...FALLBACK_DEPARTMENTS]
  }
}

export async function insertCategory(name) {
  if (!supabase) return { error: { message: 'Supabase not configured.' } }
  const trimmed = String(name || '').trim()
  if (!trimmed) return { error: { message: 'Name is required.' } }
  return supabase.from('categories').insert({ name: trimmed }).select().single()
}

export async function insertDepartment(name) {
  if (!supabase) return { error: { message: 'Supabase not configured.' } }
  const trimmed = String(name || '').trim()
  if (!trimmed) return { error: { message: 'Name is required.' } }
  return supabase.from('departments').insert({ name: trimmed }).select().single()
}

export async function fetchCategoryRows() {
  if (!supabase) return { data: [], error: null }
  return supabase.from('categories').select('id, name, created_at').order('created_at', { ascending: false })
}

export async function fetchDepartmentRows() {
  if (!supabase) return { data: [], error: null }
  return supabase.from('departments').select('id, name, created_at').order('created_at', { ascending: false })
}

export async function updateCategory(id, name) {
  if (!supabase) return { error: { message: 'Supabase not configured.' } }
  const trimmed = String(name || '').trim()
  if (!trimmed) return { error: { message: 'Name is required.' } }
  return supabase.from('categories').update({ name: trimmed }).eq('id', id).select().single()
}

export async function updateDepartment(id, name) {
  if (!supabase) return { error: { message: 'Supabase not configured.' } }
  const trimmed = String(name || '').trim()
  if (!trimmed) return { error: { message: 'Name is required.' } }
  return supabase.from('departments').update({ name: trimmed }).eq('id', id).select().single()
}

export async function deleteCategory(id) {
  if (!supabase) return { error: { message: 'Supabase not configured.' } }
  return supabase.from('categories').delete().eq('id', id)
}

export async function deleteDepartment(id) {
  if (!supabase) return { error: { message: 'Supabase not configured.' } }
  return supabase.from('departments').delete().eq('id', id)
}
