/**
 * Admin / staff UI: disambiguate users (same full name) using registration no. (students) or department (faculty).
 * `summary` shape: { full_name, role, department?, registration_number? }
 */
export function getProfileDisplayName(summary) {
  if (!summary) return '—'
  return summary.full_name || '—'
}

/** Second line under name in tables (e.g. "Reg: FA24-BCS-001" or "Dept: IT"). */
export function getProfileSecondaryLabel(summary) {
  if (!summary) return null
  if (summary.role === 'staff' && summary.department) {
    return `Dept: ${summary.department}`
  }
  if (summary.registration_number) {
    return `Reg: ${summary.registration_number}`
  }
  return null
}

/** One line for drawer / tooltips: "Name · Reg: …" */
export function formatProfileForAdminDrawer(summary, isAnonymous) {
  if (isAnonymous) return 'Anonymous'
  if (!summary) return '—'
  const name = getProfileDisplayName(summary)
  const sub = getProfileSecondaryLabel(summary)
  return sub ? `${name} · ${sub}` : name
}
