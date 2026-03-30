/**
 * Resolve who last routed a complaint to a department (from status history + actor_names from fetchComplaintById).
 */
export function getLastDepartmentRoutedBy(complaint) {
  if (!complaint) return { department: null, assignerLabel: null, at: null }
  const hist = complaint.status_history || []
  const withDept = hist.filter((h) => h.assigned_department)
  const last = withDept[withDept.length - 1]
  const department = complaint.assigned_department || last?.assigned_department || null
  const assignerLabel =
    last?.changed_by && complaint.actor_names?.[last.changed_by]
      ? complaint.actor_names[last.changed_by]
      : null
  return { department, assignerLabel, at: last?.created_at || null }
}
