/**
 * useCalendar.js
 * Hook principale per la gestione del calendario turni.
 *
 * Responsabilità:
 * - Calcolo e navigazione della settimana corrente (lun-dom)
 * - Stato dei turni: { closed: bool, employees: [{ id, partial }] }
 * - Logica giorni di chiusura di default (dom, lun, festività)
 * - Formato chiave data: 'YYYY-MM-DD'
 *
 * TODO: sostituire MOCK_EMPLOYEES e MOCK_SHIFTS con chiamate Supabase
 */

import { useState } from 'react'

function getMondayOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
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

export function useCalendar() {
  const [currentMonday, setCurrentMonday] = useState(() => getMondayOfWeek(new Date()))
  const [shifts, setShifts] = useState(MOCK_SHIFTS)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentMonday)
    d.setDate(currentMonday.getDate() + i)
    return d
  })

  const goToPrevWeek = () => setCurrentMonday(prev => {
    const d = new Date(prev); d.setDate(d.getDate() - 7); return d
  })

  const goToNextWeek = () => setCurrentMonday(prev => {
    const d = new Date(prev); d.setDate(d.getDate() + 7); return d
  })

  const getShiftForDay = (date) => {
    const key = formatDateKey(date)
    if (shifts[key]) return shifts[key]
    if (isDefaultClosed(date)) return { closed: true, employees: [] }
    return null
  }

  const saveShift = (date, shiftData) => {
    const key = formatDateKey(date)
    setShifts(prev => ({ ...prev, [key]: shiftData }))
  }

  return { weekDays, currentMonday, goToPrevWeek, goToNextWeek, getShiftForDay, saveShift, employees: MOCK_EMPLOYEES }
}
