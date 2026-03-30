import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    // Mock login temporaneo — verrà sostituito con Supabase
    if (email === 'birreria568@gmail.com' && password === 'admin') {
      login({ id: '1', name: 'Amministratore', email, role: 'admin', color: '#6366f1' })
    } else if (email === 'test@test.com' && password === 'test') {
      login({ id: '2', name: 'Mario Rossi', email, role: 'employee', color: '#f43f5e' })
    } else {
      setError('Email o password non corretti')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6">
      {/* Logo / Titolo */}
      <div className="mb-10 text-center">
        <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
          <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-white text-2xl font-bold tracking-tight">Turni 568</h1>
        <p className="text-slate-400 text-sm mt-1">Pianificazione settimanale</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label className="text-slate-300 text-sm font-medium block mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
            placeholder="la-tua@email.com"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="text-slate-300 text-sm font-medium block mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center bg-red-950/50 border border-red-900 rounded-lg py-2">{error}</p>
        )}

        <Button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-3 rounded-xl text-sm transition shadow-lg shadow-indigo-500/20">
          Accedi
        </Button>
      </form>

      <p className="text-slate-600 text-xs mt-8">
        Accesso riservato ai membri del team
      </p>
    </div>
  )
}
