import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ReferenceDataProvider } from './contexts/ReferenceDataContext.jsx'
import { Login } from './pages/Login'
import { RoleSelect } from './pages/RoleSelect'
import { StudentDashboard } from './pages/StudentDashboard'
import { AdminDashboard } from './pages/AdminDashboard'
import { StaffDashboard } from './pages/StaffDashboard'

function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading } = useAuth()
  const role = profile?.role || sessionStorage.getItem('demoRole') || 'student'
  const isAllowed = !allowedRoles || allowedRoles.includes(role)

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="text-primary font-bold">Loading...</div>
      </div>
    )
  }

  if (!user && !sessionStorage.getItem('demoUser')) {
    return <Navigate to="/" replace />
  }

  if (!isAllowed) {
    const to = role === 'admin' ? '/admin' : role === 'staff' ? '/staff' : '/student'
    return <Navigate to={to} replace />
  }

  return children
}

/** /admin shows admin login when guest; dashboard when authenticated as admin. */
function AdminGate() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c1222] flex items-center justify-center">
        <div className="text-cyan-300 font-semibold">Loading…</div>
      </div>
    )
  }

  const demo = sessionStorage.getItem('demoUser')
  const authenticated = !!(user || demo)
  const effectiveRole = profile?.role || sessionStorage.getItem('demoRole') || 'student'

  if (!authenticated) {
    return <Login adminEntry />
  }

  if (effectiveRole !== 'admin') {
    return <Navigate to={effectiveRole === 'staff' ? '/staff' : '/student'} replace />
  }

  return <AdminDashboard />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RoleSelect />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/student/*"
        element={
          <ProtectedRoute allowedRoles={['student', null, undefined]}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/admin/*" element={<AdminGate />} />
      <Route
        path="/staff/*"
        element={
          <ProtectedRoute allowedRoles={['staff']}>
            <StaffDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ReferenceDataProvider>
            <AppRoutes />
          </ReferenceDataProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
