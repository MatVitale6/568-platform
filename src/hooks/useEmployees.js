/**
 * useEmployees.js
 * Hook per la gestione dell'anagrafica dipendenti.
 *
 * Responsabilità:
 * - CRUD dipendenti (add, update, delete)
 * - Assegnazione automatica colore dalla palette (usato nei badge calendario)
 * - Stato invito (invited: bool) — sarà collegato all'invio email via Supabase
 *
 * Struttura dipendente:
 * { id, name, fiscalCode, email, phone, contractEnd, color, invited }
 *
 * TODO: sostituire stato locale con chiamate Supabase
 */

import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

// Palette colori vivaci da assegnare in sequenza
const COLOR_PALETTE = [
  '#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316',
]

function getNextColor(employees) {
  const usedColors = employees.map(e => e.color)
  const available = COLOR_PALETTE.find(c => !usedColors.includes(c))
  return available ?? COLOR_PALETTE[employees.length % COLOR_PALETTE.length]
}

// Dati mock — verranno sostituiti con Supabase
const INITIAL_EMPLOYEES = [
  { id: '1', name: 'Mario Rossi', fiscalCode: 'RSSMRA80A01H501Z', email: 'mario.rossi@email.com', phone: '3331234567', contractEnd: '', color: '#6366f1', invited: true },
  { id: '2', name: 'Giulia Bianchi', fiscalCode: 'BNCGLI85M41L219Y', email: 'giulia.bianchi@email.com', phone: '3342345678', contractEnd: '2026-12-31', color: '#f43f5e', invited: true },
  { id: '3', name: 'Luca Verdi', fiscalCode: 'VRDLCU90B01F205X', email: 'luca.verdi@email.com', phone: '3353456789', contractEnd: '', color: '#f59e0b', invited: false },
  { id: '4', name: 'Anna Neri', fiscalCode: 'NRANNA92C41H501W', email: 'anna.neri@email.com', phone: '3364567890', contractEnd: '', color: '#10b981', invited: true },
  { id: '5', name: 'Carlo Blu', fiscalCode: 'BLUCRL88D01L219V', email: 'carlo.blu@email.com', phone: '3375678901', contractEnd: '', color: '#3b82f6', invited: true },
]

export function useEmployees() {
  const [employees, setEmployees] = useState(isSupabaseConfigured ? [] : INITIAL_EMPLOYEES)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')

  const loadEmployees = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    setEmployees([])

    const { data, error: loadError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, color, employees!inner(fiscal_code, phone, contract_end, invited)')
      .order('created_at', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    const mapped = (data ?? []).map((row) => {
      const employeeRow = Array.isArray(row.employees) ? row.employees[0] : row.employees

      return {
      id: row.id,
      name: row.full_name,
      email: row.email,
      role: row.role,
      color: row.color,
      fiscalCode: employeeRow?.fiscal_code ?? '',
      phone: employeeRow?.phone ?? '',
      contractEnd: employeeRow?.contract_end ?? '',
      invited: employeeRow?.invited ?? false,
      }
    })

    setEmployees(mapped)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  const addEmployee = async (data) => {
    const color = getNextColor(employees)
    if (!isSupabaseConfigured || !supabase) {
      const newEmp = {
        id: Date.now().toString(),
        ...data,
        color,
        invited: false,
      }
      setEmployees(prev => [...prev, newEmp])
      return newEmp
    }

    setError('')

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .insert({
        full_name: data.name,
        email: data.email,
        role: 'employee',
        color,
        first_login_completed: false,
      })
      .select('id')
      .single()

    if (profileError) {
      setError(profileError.message)
      throw profileError
    }

    const { error: employeeError } = await supabase
      .from('employees')
      .insert({
        profile_id: profileRow.id,
        fiscal_code: data.fiscalCode,
        phone: data.phone,
        contract_end: data.contractEnd || null,
        invited: false,
      })

    if (employeeError) {
      setError(employeeError.message)
      throw employeeError
    }

    await loadEmployees()
    return profileRow
  }

  const updateEmployee = async (id, data) => {
    if (!isSupabaseConfigured || !supabase) {
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...data } : e))
      return
    }

    setError('')

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: data.name,
        email: data.email,
      })
      .eq('id', id)

    if (profileError) {
      setError(profileError.message)
      throw profileError
    }

    const { error: employeeError } = await supabase
      .from('employees')
      .update({
        fiscal_code: data.fiscalCode,
        phone: data.phone,
        contract_end: data.contractEnd || null,
      })
      .eq('profile_id', id)

    if (employeeError) {
      setError(employeeError.message)
      throw employeeError
    }

    await loadEmployees()
  }

  const deleteEmployee = async (id) => {
    if (!isSupabaseConfigured || !supabase) {
      setEmployees(prev => prev.filter(e => e.id !== id))
      return
    }

    setError('')
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      throw deleteError
    }

    await loadEmployees()
  }

  const sendInvite = async (id) => {
    if (!isSupabaseConfigured || !supabase) {
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, invited: true } : e))
      return
    }

    setError('')
    const { error: inviteError } = await supabase
      .from('employees')
      .update({ invited: true })
      .eq('profile_id', id)

    if (inviteError) {
      setError(inviteError.message)
      throw inviteError
    }

    await loadEmployees()
  }

  return { employees, loading, error, addEmployee, updateEmployee, deleteEmployee, sendInvite, reload: loadEmployees }
}
