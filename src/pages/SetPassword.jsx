import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export default function SetPassword() {
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const validate = () => {
    if (password.length < 8) return 'La password deve essere di almeno 8 caratteri'
    if (password !== confirm) return 'Le password non coincidono'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setSubmitting(true)
    setError('')

    try {
      // Aggiorna la password
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      // Segna first_login_completed = true e collega auth_user_id se mancante
      const { data: sessionData } = await supabase.auth.getSession()
      const authUserId = sessionData?.session?.user?.id

      if (authUserId) {
        // Collega auth_user_id al profilo (se non già collegato)
        await supabase
          .from('profiles')
          .update({ first_login_completed: true, auth_user_id: authUserId })
          .eq('auth_user_id', authUserId)
      }

      // Ricarica il profilo nel context e vai al calendario
      await refreshProfile()
      navigate('/calendar', { replace: true })
    } catch (err) {
      setError(err.message ?? 'Errore durante il salvataggio della password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Imposta la tua password</h1>
          <p className="text-slate-400 text-sm mt-1">
            {user?.name ? `Benvenuto/a, ${user.name}!` : 'Benvenuto/a!'} Scegli una password per accedere all&apos;app.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">
              Nuova password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimo 8 caratteri"
              autoComplete="new-password"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">
              Conferma password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Ripeti la password"
              autoComplete="new-password"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition placeholder:text-slate-600"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !password || !confirm}
            className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white font-semibold rounded-xl py-3 text-sm transition mt-2"
          >
            {submitting ? 'Salvataggio...' : 'Accedi all\'app →'}
          </button>
        </form>
      </div>
    </div>
  )
}
