import { useMemo, useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from 'recharts'
import { STATUSES, fetchStaffProfiles } from '../lib/complaints.js'
import { supabase } from '../lib/supabaseClient.js'
import { FALLBACK_DEPARTMENTS } from '../lib/addonReference.js'

const DATE_PRESETS = [
  { id: '7d', label: 'Last 7 days' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' }
]

const CHART_COLORS = {
  bar: ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#94a3b8', '#a78bfa'],
  pie: ['#38bdf8', '#818cf8', '#fbbf24']
}

function getRangeForPreset(presetId) {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  let start = new Date(now)
  if (presetId === '7d') {
    start.setDate(start.getDate() - 6)
    start.setHours(0, 0, 0, 0)
  } else if (presetId === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  } else {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
  }
  return { start, end }
}

function inDateRange(iso, start, end) {
  if (!iso) return false
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  return t >= start.getTime() && t <= end.getTime()
}

const TERMINAL = ['resolved', 'closed']

function isOpenOverdue(c) {
  const st = (c.status || '').toLowerCase()
  if (TERMINAL.includes(st)) return false
  if (!c.due_at) return false
  return Date.parse(c.due_at) < Date.now()
}

function isLateComplaint(c) {
  if (!c.due_at) return false
  const due = Date.parse(c.due_at)
  if (Number.isNaN(due)) return false
  const st = (c.status || '').toLowerCase()
  if (TERMINAL.includes(st)) {
    const done = Date.parse(c.updated_at || c.created_at)
    return !Number.isNaN(done) && done > due
  }
  return due < Date.now()
}

const chartTooltipStyle = {
  backgroundColor: '#0f172a',
  border: '1px solid rgba(51,65,85,0.8)',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#e2e8f0'
}

export function AdminReportsView({ complaints = [], loading = false, departmentsList }) {
  const departments = departmentsList?.length ? departmentsList : FALLBACK_DEPARTMENTS
  const [datePreset, setDatePreset] = useState('month')
  const [statusFilter, setStatusFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [staffList, setStaffList] = useState([])
  const [staffLoading, setStaffLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase) {
        setStaffList([])
        setStaffLoading(false)
        return
      }
      setStaffLoading(true)
      const { data, error } = await fetchStaffProfiles()
      if (!cancelled) {
        setStaffLoading(false)
        setStaffList(!error && data?.length ? data : [])
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const { start: rangeStart, end: rangeEnd } = useMemo(() => getRangeForPreset(datePreset), [datePreset])

  const filtered = useMemo(() => {
    return (complaints || []).filter((c) => {
      if (!inDateRange(c.created_at, rangeStart, rangeEnd)) return false
      if (statusFilter && (c.status || '') !== statusFilter) return false
      if (departmentFilter) {
        const dept = (c.assigned_department || '').trim()
        if (dept.toLowerCase() !== departmentFilter.toLowerCase()) return false
      }
      return true
    })
  }, [complaints, rangeStart, rangeEnd, statusFilter, departmentFilter])

  const summary = useMemo(() => {
    const total = filtered.length
    const resolved = filtered.filter((c) => ['resolved', 'closed'].includes((c.status || '').toLowerCase())).length
    const pending = filtered.filter((c) => !['resolved', 'closed'].includes((c.status || '').toLowerCase())).length
    const overdue = filtered.filter(isOpenOverdue).length
    return { total, resolved, pending, overdue }
  }, [filtered])

  const statusBarData = useMemo(() => {
    const map = {}
    STATUSES.forEach((s) => {
      map[s] = 0
    })
    filtered.forEach((c) => {
      const s = (c.status || 'pending').toLowerCase()
      map[s] = (map[s] || 0) + 1
    })
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  const priorityPieData = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0 }
    filtered.forEach((c) => {
      const p = (c.priority || 'medium').toLowerCase()
      if (counts[p] !== undefined) counts[p] += 1
      else counts.medium += 1
    })
    return [
      { name: 'Low', value: counts.low },
      { name: 'Medium', value: counts.medium },
      { name: 'High', value: counts.high }
    ].filter((d) => d.value > 0)
  }, [filtered])

  const monthlyLineData = useMemo(() => {
    const map = {}
    filtered.forEach((c) => {
      const d = new Date(c.created_at)
      if (Number.isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      map[key] = (map[key] || 0) + 1
    })
    return Object.keys(map)
      .sort()
      .map((k) => {
        const [y, m] = k.split('-')
        return {
          month: `${y}-${m}`,
          label: new Date(Number(y), Number(m) - 1, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' }),
          count: map[k]
        }
      })
  }, [filtered])

  const staffRows = useMemo(() => {
    const rows = []
    const list = staffList.length
      ? staffList
      : departments.map((d) => ({ id: `dept-${d}`, full_name: '—', department: d }))

    for (const s of list) {
      const dept = (s.department || '').trim()
      const pool = filtered.filter(
        (c) => dept && (c.assigned_department || '').trim().toLowerCase() === dept.toLowerCase()
      )
      const totalAssigned = pool.length
      const resolved = pool.filter((c) => TERMINAL.includes((c.status || '').toLowerCase())).length
      const late = pool.filter(isLateComplaint).length
      const perf =
        totalAssigned > 0 ? Math.round((resolved / totalAssigned) * 100) : null
      rows.push({
        id: s.id,
        name: s.full_name || '—',
        department: dept || '—',
        totalAssigned,
        resolved,
        late,
        performance: perf
      })
    }
    return rows.sort((a, b) => b.totalAssigned - a.totalAssigned || a.name.localeCompare(b.name))
  }, [filtered, staffList, departments])

  const exportCsv = useCallback(() => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [
      ['CUIResolve — Admin report', '', '', ''].map(esc).join(','),
      ['Generated', new Date().toISOString(), '', ''].map(esc).join(','),
      ['Date range', `${rangeStart.toLocaleDateString()} – ${rangeEnd.toLocaleDateString()}`, '', ''].map(esc).join(','),
      ['Status filter', statusFilter || 'All', 'Department', departmentFilter || 'All'].map(esc).join(','),
      [],
      ['Summary', 'Total', 'Resolved', 'Pending', 'Overdue (open)'].map(esc).join(','),
      ['', summary.total, summary.resolved, summary.pending, summary.overdue].map(esc).join(','),
      [],
      ['Staff / department', 'Name', 'Department', 'Total assigned', 'Resolved', 'Late', 'Performance %'].map(esc).join(
        ','
      )
    ]
    staffRows.forEach((r) => {
      lines.push(
        ['', r.name, r.department, r.totalAssigned, r.resolved, r.late, r.performance ?? '—'].map(esc).join(',')
      )
    })
    lines.push([])
    lines.push(['Complaints in filter', 'ID', 'Title', 'Status', 'Priority', 'Department', 'Created'].map(esc).join(','))
    filtered.forEach((c) => {
      lines.push(
        [
          '',
          c.id,
          c.title,
          c.status,
          c.priority,
          c.assigned_department || '',
          c.created_at ? new Date(c.created_at).toLocaleString() : ''
        ]
          .map(esc)
          .join(',')
      )
    })

    const blob = new Blob(['\ufeff', lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cui-resolve-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered, rangeEnd, rangeStart, staffRows, statusFilter, departmentFilter, summary])

  const exportPdf = useCallback(() => {
    const w = window.open('', '_blank')
    if (!w) return
    const staffHtml = staffRows
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.department)}</td><td>${r.totalAssigned}</td><td>${r.resolved}</td><td>${r.late}</td><td>${r.performance != null ? `${r.performance}%` : '—'}</td></tr>`
      )
      .join('')
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>CUIResolve Report</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#111;max-width:900px;margin:0 auto;}
        h1{font-size:1.25rem;} table{border-collapse:collapse;width:100%;margin-top:16px;font-size:12px;}
        th,td{border:1px solid #ccc;padding:8px;text-align:left;} th{background:#f1f5f9;}
        .muted{color:#64748b;font-size:12px;} .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0;}
        .card{border:1px solid #e2e8f0;padding:12px;border-radius:8px;}
      </style></head><body>
      <h1>CUIResolve — Complaints report</h1>
      <p class="muted">Generated ${escapeHtml(new Date().toLocaleString())}</p>
      <p class="muted">Range: ${escapeHtml(rangeStart.toLocaleDateString())} – ${escapeHtml(rangeEnd.toLocaleDateString())} · Status: ${escapeHtml(statusFilter || 'All')} · Department: ${escapeHtml(departmentFilter || 'All')}</p>
      <div class="grid">
        <div class="card"><strong>Total</strong><br/>${summary.total}</div>
        <div class="card"><strong>Resolved</strong><br/>${summary.resolved}</div>
        <div class="card"><strong>Pending</strong><br/>${summary.pending}</div>
        <div class="card"><strong>Overdue (open)</strong><br/>${summary.overdue}</div>
      </div>
      <h2>Staff / department performance</h2>
      <p class="muted">Counts are for complaints assigned to each staff member’s department (shared team view).</p>
      <table><thead><tr><th>Name</th><th>Department</th><th>Total assigned</th><th>Resolved</th><th>Late</th><th>Performance %</th></tr></thead>
      <tbody>${staffHtml}</tbody></table>
      <p class="muted" style="margin-top:24px">Use your browser’s print dialog and choose “Save as PDF”.</p>
      </body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }, [departmentFilter, rangeEnd, rangeStart, staffRows, statusFilter, summary])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">Reports</h2>
          <p className="text-sm text-slate-400">
            Analytics, trends, and export — filtered data updates charts and tables live.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading}
            className="rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-200 hover:bg-sky-500/15 disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={exportPdf}
            className="rounded-lg border border-violet-500/35 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-200 hover:bg-violet-500/15"
          >
            Export PDF (print)
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-panel-static rounded-2xl border border-slate-700/50 p-4 shadow-admin-card sm:p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Filters</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Date range</label>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="admin-input py-2.5"
            >
              {DATE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">Based on complaint created date.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="admin-input py-2.5"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="admin-input py-2.5"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="admin-panel-static relative overflow-hidden rounded-2xl border border-slate-700/50 p-5 shadow-admin-card">
          <div className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/15 ring-1 ring-sky-500/20">
            <span className="material-symbols-outlined text-xl text-sky-400">forum</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total complaints</p>
          <p className="mt-1 bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-3xl font-bold text-transparent">
            {loading ? '…' : summary.total}
          </p>
        </div>
        <div className="admin-panel-static relative overflow-hidden rounded-2xl border border-slate-700/50 p-5 shadow-admin-card">
          <div className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/20">
            <span className="material-symbols-outlined text-xl text-emerald-400">check_circle</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resolved</p>
          <p className="mt-1 bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-3xl font-bold text-transparent">
            {loading ? '…' : summary.resolved}
          </p>
        </div>
        <div className="admin-panel-static relative overflow-hidden rounded-2xl border border-slate-700/50 p-5 shadow-admin-card">
          <div className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-500/20">
            <span className="material-symbols-outlined text-xl text-amber-400">pending_actions</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending</p>
          <p className="mt-1 bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-3xl font-bold text-transparent">
            {loading ? '…' : summary.pending}
          </p>
        </div>
        <div className="admin-panel-static relative overflow-hidden rounded-2xl border border-slate-700/50 p-5 shadow-admin-card">
          <div className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/15 ring-1 ring-rose-500/20">
            <span className="material-symbols-outlined text-xl text-rose-400">schedule</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overdue (open)</p>
          <p className="mt-1 bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-3xl font-bold text-transparent">
            {loading ? '…' : summary.overdue}
          </p>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="admin-panel-static rounded-2xl border border-slate-700/50 p-4 shadow-admin-card sm:p-5">
          <h3 className="mb-1 text-sm font-bold text-slate-200">Complaints by status</h3>
          <p className="mb-4 text-xs text-slate-500">Bar chart for current filters</p>
          <div className="h-72 w-full min-w-0">
            {loading ? (
              <p className="py-16 text-center text-slate-500">Loading…</p>
            ) : statusBarData.length === 0 ? (
              <p className="py-16 text-center text-slate-500">No data in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusBarData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-25} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="value" name="Count" radius={[6, 6, 0, 0]}>
                    {statusBarData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS.bar[i % CHART_COLORS.bar.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="admin-panel-static rounded-2xl border border-slate-700/50 p-4 shadow-admin-card sm:p-5">
          <h3 className="mb-1 text-sm font-bold text-slate-200">Complaints by priority</h3>
          <p className="mb-4 text-xs text-slate-500">Distribution in filtered set</p>
          <div className="h-72 w-full min-w-0">
            {loading ? (
              <p className="py-16 text-center text-slate-500">Loading…</p>
            ) : priorityPieData.length === 0 ? (
              <p className="py-16 text-center text-slate-500">No data in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {priorityPieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS.pie[i % CHART_COLORS.pie.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Line chart full width */}
      <div className="admin-panel-static rounded-2xl border border-slate-700/50 p-4 shadow-admin-card sm:p-5">
        <h3 className="mb-1 text-sm font-bold text-slate-200">Monthly complaint trends</h3>
        <p className="mb-4 text-xs text-slate-500">New complaints by month (created date), within filters</p>
        <div className="h-80 w-full min-w-0">
          {loading ? (
            <p className="py-20 text-center text-slate-500">Loading…</p>
          ) : monthlyLineData.length === 0 ? (
            <p className="py-20 text-center text-slate-500">No data in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyLineData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Complaints"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ fill: '#818cf8', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Staff table */}
      <div className="admin-panel-static overflow-hidden rounded-2xl border border-slate-700/50 shadow-admin-card">
        <div className="border-b border-slate-700/60 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-200">Staff performance</h3>
          <p className="mt-1 text-xs text-slate-500">
            Metrics use complaints assigned to each person’s department (shared team workload). Performance % = resolved ÷
            total assigned in this filter.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="admin-table-head">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-right">Total assigned</th>
                <th className="px-4 py-3 text-right">Resolved</th>
                <th className="px-4 py-3 text-right">Late</th>
                <th className="px-4 py-3 text-right">Performance %</th>
              </tr>
            </thead>
            <tbody>
              {staffLoading || loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : staffRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No staff or department data.
                  </td>
                </tr>
              ) : (
                staffRows.map((r) => (
                  <tr key={r.id} className="admin-table-row border-slate-800/80 text-slate-200">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-slate-300">{r.department}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.totalAssigned}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-300/90">{r.resolved}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-rose-300/90">{r.late}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-sky-300">
                      {r.performance != null ? `${r.performance}%` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
