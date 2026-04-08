/**
 * useCalendar.js
 * Hook principale per la gestione del calendario turni.
 *
 * Modalità supportate:
 * - Supabase: carica dipendenti, turni e richieste reali
 * - Fallback mock: finché backend non è disponibile
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

function getMondayOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function formatDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isDefaultClosed(date) {
  const dow = date.getDay()
  if (dow === 0 || dow === 1) return true // Domenica e Lunedì
  const m = date.getMonth() + 1
  const d = date.getDate()
  if (m === 12 && (d === 24 || d === 25 || d === 26 || d === 31)) return true
  if (m === 1 && d === 1) return true
  if (m === 5 && d === 1) return true
  return false
}

// Dati mock — verranno sostituiti con Supabase
export const MOCK_EMPLOYEES = [
  { id: '1', name: 'Mario Rossi', color: '#6366f1' },
  { id: '2', name: 'Giulia Bianchi', color: '#f43f5e' },
  { id: '3', name: 'Luca Verdi', color: '#f59e0b' },
  { id: '4', name: 'Anna Neri', color: '#10b981' },
  { id: '5', name: 'Carlo Blu', color: '#3b82f6' },
]

const MOCK_SHIFTS = {
  '2026-03-24': { closed: false, employees: [{ id: '1', partial: false }, { id: '2', partial: true }, { id: '3', partial: false }] },
  '2026-03-25': { closed: false, employees: [{ id: '1', partial: false }, { id: '4', partial: false }] },
  '2026-03-26': { closed: false, employees: [{ id: '2', partial: false }, { id: '5', partial: false }] },
  '2026-03-27': { closed: false, employees: [{ id: '3', partial: false }, { id: '4', partial: true }] },
  '2026-03-28': { closed: false, employees: [{ id: '1', partial: false }, { id: '2', partial: false }, { id: '5', partial: false }] },
}

export function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

function getWeekRange(monday) {
  const start = formatDateKey(monday)
  const endDate = new Date(monday)
  endDate.setDate(endDate.getDate() + 6)
  const end = formatDateKey(endDate)
  return { start, end }
}

export function useCalendar(currentUser) {
  const [currentMonday, setCurrentMonday] = useState(() => getMondayOfWeek(new Date()))
  const [shifts, setShifts] = useState(isSupabaseConfigured ? {} : MOCK_SHIFTS)
  const [employees, setEmployees] = useState(isSupabaseConfigured ? [] : MOCK_EMPLOYEES)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentMonday)
    d.setDate(currentMonday.getDate() + i)
    return d
  })

  const weekRange = useMemo(() => getWeekRange(currentMonday), [currentMonday])

  const goToPrevWeek = () => setCurrentMonday(prev => {
    const d = new Date(prev); d.setDate(d.getDate() - 7); return d
  })

  const goToNextWeek = () => setCurrentMonday(prev => {
    const d = new Date(prev); d.setDate(d.getDate() + 7); return d
  })

  const loadEmployees = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return MOCK_EMPLOYEES

    const { data, error: employeesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, color, employees!inner(profile_id)')
      .order('full_name', { ascending: true })

    if (employeesError) throw employeesError

    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.full_name,
      email: row.email,
      role: row.role,
      color: row.color ?? '#6366f1',
    }))
  }, [])

  const loadWeekShifts = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return MOCK_SHIFTS

    const { data, error: shiftsError } = await supabase
      .from('shifts')
      .select('id, work_date, is_closed, shift_assignments(employee_id, is_partial)')
      .gte('work_date', weekRange.start)
      .lte('work_date', weekRange.end)
      .order('work_date', { ascending: true })

    if (shiftsError) throw shiftsError

    return (data ?? []).reduce((acc, row) => {
      acc[row.work_date] = {
        id: row.id,
        closed: row.is_closed,
        employees: (row.shift_assignments ?? []).map((assignment) => ({
          id: assignment.employee_id,
          partial: assignment.is_partial,
        })),
      }
      return acc
    }, {})
  }, [weekRange.end, weekRange.start])

  const reloadCalendar = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [loadedEmployees, loadedShifts] = await Promise.all([
        loadEmployees(),
        loadWeekShifts(),
      ])

      setEmployees(loadedEmployees)
      setShifts(loadedShifts)
    } catch (loadError) {
      setError(loadError.message || 'Caricamento calendario non riuscito')
    } finally {
      setLoading(false)
    }
  }, [loadEmployees, loadWeekShifts])

  useEffect(() => {
    reloadCalendar()
  }, [reloadCalendar])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !currentUser?.id) {
      return undefined
    }

    const reloadSilently = () => {
      reloadCalendar()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reloadSilently()
      }
    }

    window.addEventListener('focus', handleVisibilityChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const channel = supabase
      .channel(`calendar-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, reloadSilently)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_assignments' }, reloadSilently)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_requests' }, reloadSilently)
      .subscribe()

    return () => {
      window.removeEventListener('focus', handleVisibilityChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(channel)
    }
  }, [currentUser?.id, reloadCalendar])

  const getShiftForDay = (date) => {
    const key = formatDateKey(date)
    if (shifts[key]) return shifts[key]
    if (isDefaultClosed(date)) return { closed: true, employees: [] }
    return null
  }

  const persistShiftForDate = useCallback(async (dateKey, shiftData) => {
    if (!isSupabaseConfigured || !supabase) {
      setShifts(prev => {
        const next = { ...prev }
        if (shiftData === null) {
          delete next[dateKey]
          return next
        }

        next[dateKey] = shiftData
        return next
      })
      return
    }

    if (shiftData === null) {
      const { error: deleteShiftError } = await supabase
        .from('shifts')
        .delete()
        .eq('work_date', dateKey)

      if (deleteShiftError) throw deleteShiftError
      return
    }

    const { data: shiftRow, error: shiftError } = await supabase
      .from('shifts')
      .upsert({
        work_date: dateKey,
        is_closed: shiftData.closed,
        created_by: currentUser.id,
      }, { onConflict: 'work_date' })
      .select('id')
      .single()

    if (shiftError) throw shiftError

    const { error: deleteAssignmentsError } = await supabase
      .from('shift_assignments')
      .delete()
      .eq('shift_id', shiftRow.id)

    if (deleteAssignmentsError) throw deleteAssignmentsError

    if (!shiftData.closed && shiftData.employees.length > 0) {
      const { error: insertAssignmentsError } = await supabase
        .from('shift_assignments')
        .insert(
          shiftData.employees.map((employee) => ({
            shift_id: shiftRow.id,
            employee_id: employee.id,
            is_partial: employee.partial,
          })),
        )

      if (insertAssignmentsError) throw insertAssignmentsError
    }
  }, [currentUser?.id])

  const saveShift = async (date, shiftData) => {
    const key = formatDateKey(date)

    if (!isSupabaseConfigured || !supabase) {
      await persistShiftForDate(key, shiftData)
      return
    }

    if (!currentUser?.id) {
      throw new Error('Utente non riconosciuto')
    }

    setError('')

    await persistShiftForDate(key, shiftData)

    await reloadCalendar()
  }

  const copyWeek = async ({ startDate, endDate }) => {
    const sourceWeek = weekDays.map((day) => ({
      date: new Date(day),
      shift: getShiftForDay(day),
    }))

    const startMonday = getMondayOfWeek(new Date(startDate))
    const endMonday = getMondayOfWeek(new Date(endDate))

    if (endMonday < startMonday) {
      throw new Error('Periodo non valido per la copia settimana')
    }

    setError('')

    for (let monday = new Date(startMonday); monday <= endMonday; monday = addDays(monday, 7)) {
      for (let index = 0; index < sourceWeek.length; index += 1) {
        const sourceDay = sourceWeek[index]
        const targetDate = addDays(monday, index)
        const targetKey = formatDateKey(targetDate)

        if (targetKey === formatDateKey(sourceDay.date)) {
          continue
        }

        const sourceShift = sourceDay.shift
        const clonedShift = sourceShift
          ? {
              closed: sourceShift.closed,
              employees: (sourceShift.employees ?? []).map((employee) => ({
                id: employee.id,
                partial: employee.partial,
              })),
            }
          : null

        await persistShiftForDate(targetKey, clonedShift)
      }
    }

    await reloadCalendar()
  }

  const createSwapRequest = async ({ date, shiftId, targetEmployeeId }) => {
    if (!currentUser?.id) {
      throw new Error('Utente non riconosciuto')
    }

    if (!shiftId) {
      throw new Error(`Nessun turno trovato per il giorno ${formatDateKey(date)}`)
    }

    if (!isSupabaseConfigured || !supabase) {
      return
    }

    setError('')
    const { error: swapError } = await supabase
      .from('swap_requests')
      .insert({
        shift_id: shiftId,
        requester_id: currentUser.id,
        target_employee_id: targetEmployeeId,
      })

    if (swapError) throw swapError
  }

  return {
    weekDays,
    currentMonday,
    goToPrevWeek,
    goToNextWeek,
    getShiftForDay,
    saveShift,
    copyWeek,
    createSwapRequest,
    employees,
    loading,
    error,
    reloadCalendar,
  }
}
