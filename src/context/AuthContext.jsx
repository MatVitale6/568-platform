/**
 * AuthContext.jsx
 * Contesto globale per l'autenticazione.
 *
 * Fornisce:
 * - user: { id, name, email, role: 'admin'|'employee', color } | null
 * - login(userData): imposta l'utente corrente
 * - logout(): resetta l'utente
 *
 * Ruoli:
 * - 'admin'  → accesso completo (calendario + gestione dipendenti)
 * - 'employee' → solo visualizzazione calendario + richiesta cambio turno
 *
 * TODO: sostituire con Supabase Auth (supabase.auth.signInWithPassword)
 */

import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null) // { id, name, email, role: 'admin' | 'employee', color }

  const login = (userData) => setUser(userData)
  const logout = () => setUser(null)

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
