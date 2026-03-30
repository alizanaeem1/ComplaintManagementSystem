import { useState, useEffect, useCallback } from 'react'
import {
  fetchCategoryRows,
  fetchDepartmentRows,
  insertCategory,
  insertDepartment,
  updateCategory,
  updateDepartment,
  deleteCategory,
  deleteDepartment
} from '../lib/addonReference.js'
import { supabase } from '../lib/supabaseClient.js'
import { useReferenceData } from '../contexts/ReferenceDataContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function SectionHeading({ children, accent = 'sky' }) {
  const b =
    accent === 'violet' ? 'border-violet-400' : accent === 'amber' ? 'border-amber-400' : 'border-sky-400'
  return (
    <h2 className={`text-lg font-bold tracking-tight text-slate-50 sm:text-xl border-l-4 ${b} pl-3 py-0.5`}>
      {children}
    </h2>
  )
}

function EditableNameList({
  rows,
  disabled,
  loading,
  editingId,
  editDraft,
  busyId,
  onStartEdit,
  onEditDraft,
  onSaveEdit,
  onCancelEdit,
  onDelete
}) {
  if (loading) {
    return <p className="text-sm text-slate-500">Loading…</p>
  }
  if (disabled) {
    return <p className="text-sm text-slate-500">No database — defaults used in the app only.</p>
  }
  if (!rows.length) {
    return <p className="text-sm text-slate-500">No rows yet (defaults still apply via merge).</p>
  }

  return (
    <ul className="divide-y divide-slate-800/80 rounded-xl border border-slate-700/60 bg-[#0c1424]">
      {rows.map((row) => {
        const isEditing = editingId === row.id
        const busy = busyId === row.id
        return (
          <li key={row.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            {isEditing ? (
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={editDraft}
                  onChange={(e) => onEditDraft(e.target.value)}
                  className="admin-input min-w-0 flex-1"
                  disabled={busy}
                  autoFocus
                />
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || !editDraft.trim()}
                    onClick={onSaveEdit}
                    className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/25 disabled:opacity-50"
                  >
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onCancelEdit}
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-100">{row.name}</span>
                  <span className="mt-0.5 block text-xs text-slate-500 sm:mt-0 sm:ml-2 sm:inline">
                    {formatDate(row.created_at)}
                  </span>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!!busyId}
                    onClick={() => onStartEdit(row)}
                    className="rounded-lg border border-sky-500/35 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300 hover:bg-sky-500/15 disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={!!busyId}
                    onClick={() => onDelete(row)}
                    className="rounded-lg border border-red-500/35 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/15 disabled:opacity-50"
                  >
                    {busy && !isEditing ? '…' : 'Delete'}
                  </button>
                </div>
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function AdminAddonPage() {
  const { showToast } = useToast()
  const { refreshReferenceData } = useReferenceData()
  const [catName, setCatName] = useState('')
  const [deptName, setDeptName] = useState('')
  const [catRows, setCatRows] = useState([])
  const [deptRows, setDeptRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingCat, setAddingCat] = useState(false)
  const [addingDept, setAddingDept] = useState(false)

  const [editingCatId, setEditingCatId] = useState(null)
  const [editCatDraft, setEditCatDraft] = useState('')
  const [editingDeptId, setEditingDeptId] = useState(null)
  const [editDeptDraft, setEditDeptDraft] = useState('')
  const [busyCatId, setBusyCatId] = useState(null)
  const [busyDeptId, setBusyDeptId] = useState(null)

  const reloadLists = useCallback(async () => {
    if (!supabase) {
      setCatRows([])
      setDeptRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const [cRes, dRes] = await Promise.all([fetchCategoryRows(), fetchDepartmentRows()])
    setLoading(false)
    setCatRows(cRes.data || [])
    setDeptRows(dRes.data || [])
    if (cRes.error && !cRes.error.message?.includes('relation')) {
      showToast(cRes.error.message || 'Failed to load categories', 'error')
    }
    if (dRes.error && !dRes.error.message?.includes('relation')) {
      showToast(dRes.error.message || 'Failed to load departments', 'error')
    }
  }, [showToast])

  useEffect(() => {
    void reloadLists()
  }, [reloadLists])

  async function handleAddCategory(e) {
    e.preventDefault()
    setAddingCat(true)
    const { error } = await insertCategory(catName)
    setAddingCat(false)
    if (error) {
      showToast(error.message || 'Could not add category', 'error')
      return
    }
    showToast('Category added.', 'success')
    setCatName('')
    await reloadLists()
    await refreshReferenceData()
  }

  async function handleAddDepartment(e) {
    e.preventDefault()
    setAddingDept(true)
    const { error } = await insertDepartment(deptName)
    setAddingDept(false)
    if (error) {
      showToast(error.message || 'Could not add department', 'error')
      return
    }
    showToast('Department added.', 'success')
    setDeptName('')
    await reloadLists()
    await refreshReferenceData()
  }

  async function saveCategoryEdit() {
    if (!editingCatId || !editCatDraft.trim()) return
    setBusyCatId(editingCatId)
    const { error } = await updateCategory(editingCatId, editCatDraft)
    setBusyCatId(null)
    if (error) {
      showToast(error.message || 'Could not update category', 'error')
      return
    }
    showToast('Category updated.', 'success')
    setEditingCatId(null)
    setEditCatDraft('')
    await reloadLists()
    await refreshReferenceData()
  }

  async function saveDepartmentEdit() {
    if (!editingDeptId || !editDeptDraft.trim()) return
    setBusyDeptId(editingDeptId)
    const { error } = await updateDepartment(editingDeptId, editDeptDraft)
    setBusyDeptId(null)
    if (error) {
      showToast(error.message || 'Could not update department', 'error')
      return
    }
    showToast('Department updated.', 'success')
    setEditingDeptId(null)
    setEditDeptDraft('')
    await reloadLists()
    await refreshReferenceData()
  }

  function deleteCategoryRow(row) {
    const ok = window.confirm(`Delete category "${row.name}"? Existing complaints that use this label will keep the old text until updated.`)
    if (!ok) return
    void (async () => {
      setBusyCatId(row.id)
      const { error } = await deleteCategory(row.id)
      setBusyCatId(null)
      if (error) {
        showToast(error.message || 'Could not delete category', 'error')
        return
      }
      showToast('Category deleted.', 'success')
      if (editingCatId === row.id) {
        setEditingCatId(null)
        setEditCatDraft('')
      }
      await reloadLists()
      await refreshReferenceData()
    })()
  }

  function deleteDepartmentRow(row) {
    const ok = window.confirm(
      `Delete department "${row.name}"? Staff profiles or complaints may still reference this name until you update them.`
    )
    if (!ok) return
    void (async () => {
      setBusyDeptId(row.id)
      const { error } = await deleteDepartment(row.id)
      setBusyDeptId(null)
      if (error) {
        showToast(error.message || 'Could not delete department', 'error')
        return
      }
      showToast('Department deleted.', 'success')
      if (editingDeptId === row.id) {
        setEditingDeptId(null)
        setEditDeptDraft('')
      }
      await reloadLists()
      await refreshReferenceData()
    })()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 sm:text-3xl">
          <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-violet-300 bg-clip-text text-transparent">
            Categories &amp; departments
          </span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Add, edit, or remove complaint <strong className="text-slate-300">categories</strong> and assignable{' '}
          <strong className="text-slate-300">departments</strong>. Lists sync across student submit, staff views, and admin
          config.
        </p>
        {!supabase && (
          <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Connect Supabase and run <code className="text-xs">supabase/add-addon-categories-departments.sql</code> (and{' '}
            <code className="text-xs">patch-categories-departments-admin-update.sql</code> if you set up before edit was
            added) to persist changes.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <div className="admin-panel-static space-y-4 rounded-2xl border border-slate-700/50 p-5 shadow-admin-card">
          <SectionHeading>Categories</SectionHeading>
          <form onSubmit={handleAddCategory} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-400">New category name</label>
              <input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="admin-input w-full"
                placeholder="e.g. Transport"
                disabled={!supabase || addingCat}
              />
            </div>
            <button
              type="submit"
              disabled={!supabase || addingCat || !catName.trim()}
              className="admin-gradient-btn shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addingCat ? 'Adding…' : 'Add category'}
            </button>
          </form>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Existing categories</h3>
            <EditableNameList
              rows={catRows}
              disabled={!supabase}
              loading={loading}
              editingId={editingCatId}
              editDraft={editCatDraft}
              busyId={busyCatId}
              onStartEdit={(row) => {
                setEditingCatId(row.id)
                setEditCatDraft(row.name)
              }}
              onEditDraft={setEditCatDraft}
              onSaveEdit={saveCategoryEdit}
              onCancelEdit={() => {
                setEditingCatId(null)
                setEditCatDraft('')
              }}
              onDelete={deleteCategoryRow}
            />
          </div>
        </div>

        <div className="admin-panel-static space-y-4 rounded-2xl border border-slate-700/50 p-5 shadow-admin-card">
          <SectionHeading accent="violet">Departments</SectionHeading>
          <form onSubmit={handleAddDepartment} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-400">New department name</label>
              <input
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                className="admin-input w-full"
                placeholder="e.g. Security"
                disabled={!supabase || addingDept}
              />
            </div>
            <button
              type="submit"
              disabled={!supabase || addingDept || !deptName.trim()}
              className="admin-gradient-btn shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addingDept ? 'Adding…' : 'Add department'}
            </button>
          </form>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Existing departments</h3>
            <EditableNameList
              rows={deptRows}
              disabled={!supabase}
              loading={loading}
              editingId={editingDeptId}
              editDraft={editDeptDraft}
              busyId={busyDeptId}
              onStartEdit={(row) => {
                setEditingDeptId(row.id)
                setEditDeptDraft(row.name)
              }}
              onEditDraft={setEditDeptDraft}
              onSaveEdit={saveDepartmentEdit}
              onCancelEdit={() => {
                setEditingDeptId(null)
                setEditDeptDraft('')
              }}
              onDelete={deleteDepartmentRow}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
