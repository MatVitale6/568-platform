import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import Login from '@/pages/Login'
import Calendar from '@/pages/Calendar'
import Employees from '@/pages/Employees'
import Layout from '@/components/Layout'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <ScreenLoader />
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <ScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/calendar" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <ScreenLoader />

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/calendar" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/calendar" replace />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="employees" element={<AdminRoute><Employees /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/calendar" replace />} />
    </Routes>
  )
}

function ScreenLoader() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-6">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 border-slate-700 border-t-indigo-500 animate-spin mx-auto" />
        <p className="text-slate-400 text-sm mt-4">Caricamento...</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
