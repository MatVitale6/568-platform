/**
 * AuthContext.jsx
 * Contesto globale per l'autenticazione.
 *
 * Modalità supportate:
 * - Supabase Auth: se URL e anon key sono configurati
 * - Fallback mock: utile finché backend e utenti reali non sono pronti
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

function mapMockUser(userData) {
  return userData
}

function mapSupabaseUser(authUser, profile) {
  const fallbackName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Utente'

  return {
    id: profile?.id ?? authUser.id,
    authUserId: authUser.id,
    name: profile?.full_name ?? fallbackName,
    email: profile?.email ?? authUser.email,
    role: profile?.role ?? authUser.user_metadata?.role ?? 'employee',
    color: profile?.color ?? authUser.user_metadata?.color ?? '#6366f1',
    firstLoginCompleted: profile?.first_login_completed ?? false,
  }
}

async function getProfileForUser(userId) {
  if (!isSupabaseConfigured || !supabase) return null

  const { data: byAuthUserId, error: byAuthUserIdError } = await supabase
    .from('profiles')
    .select('id, auth_user_id, full_name, email, role, color, first_login_completed')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (byAuthUserIdError) throw byAuthUserIdError
  if (byAuthUserId) return byAuthUserId

  const { data, error } = await supabase
    .from('profiles')
    .select('id, auth_user_id, full_name, email, role, color, first_login_completed')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return undefined
    }

    let mounted = true

    const bootstrap = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        if (mounted) setLoading(false)
        return
      }

      if (data.session?.user) {
        try {
          const profile = await getProfileForUser(data.session.user.id)
          if (mounted) setUser(mapSupabaseUser(data.session.user, profile))
        } catch {
          if (mounted) setUser(mapSupabaseUser(data.session.user, null))
        }
      }

      if (mounted) setLoading(false)
    }

    bootstrap()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return

      if (!session?.user) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const profile = await getProfileForUser(session.user.id)
        setUser(mapSupabaseUser(session.user, profile))
      } catch {
        setUser(mapSupabaseUser(session.user, null))
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const login = (userData) => setUser(mapMockUser(userData))

  const loginWithPassword = async (email, password) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase non configurato')
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    const profile = await getProfileForUser(data.user.id)
    const mappedUser = mapSupabaseUser(data.user, profile)
    setUser(mappedUser)
    return mappedUser
  }

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut()
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithPassword, logout, isMockMode: !isSupabaseConfigured }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
