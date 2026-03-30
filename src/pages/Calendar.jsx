import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCalendar, getWeekNumber } from '@/hooks/useCalendar'
import DayRow from '@/components/calendar/DayRow'
import ShiftModal from '@/components/modals/ShiftModal'
import SwapModal from '@/components/modals/SwapModal'

const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

export default function Calendar() {
  const { user } = useAuth()
  const {
    weekDays,
    currentMonday,
    goToPrevWeek,
    goToNextWeek,
    getShiftForDay,
    saveShift,
    createSwapRequest,
    employees,
    loading,
    error,
  } = useCalendar(user)
  const [selectedDay, setSelectedDay] = useState(null)
  const [actionError, setActionError] = useState('')

  const month = MONTHS[currentMonday.getMonth()]
  const year = currentMonday.getFullYear()
  const weekNum = getWeekNumber(currentMonday)

  const selectedShift = selectedDay ? getShiftForDay(selectedDay) : null

  const handleSaveShift = async (data) => {
    setActionError('')
    try {
      await saveShift(selectedDay, data)
      setSelectedDay(null)
    } catch (saveError) {
      setActionError(saveError.message || 'Salvataggio turno non riuscito')
      throw saveError
    }
  }

  const handleSwapRequest = async (payload) => {
    setActionError('')
    try {
      await createSwapRequest(payload)
    } catch (swapError) {
      setActionError(swapError.message || 'Richiesta cambio non riuscita')
      throw swapError
    }
  }

  return (
    <div className="flex flex-col">
      {/* Navigazione settimana */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={goToPrevWeek}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <p className="font-bold text-slate-800">{month} {year}</p>
          <p className="text-xs text-slate-400 mt-0.5">Settimana {weekNum}</p>
        </div>
        <button
          onClick={goToNextWeek}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {(error || actionError) && (
        <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError || error}
        </div>
      )}

      {/* Righe giorni */}
      <div className="divide-y divide-slate-100">
        {loading && (
          <div className="flex flex-col items-center text-center py-16 px-8 bg-white">
            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin mb-4" />
            <p className="text-slate-400 text-sm">Caricamento turni...</p>
          </div>
        )}

        {!loading && weekDays.map((day) => (
          <DayRow
            key={day.toISOString()}
            date={day}
            shift={getShiftForDay(day)}
            employees={employees}
            onPress={() => setSelectedDay(day)}
            currentUser={user}
          />
        ))}
      </div>

      {/* Modal Admin: crea / modifica turno */}
      {user?.role === 'admin' && selectedDay && (
        <ShiftModal
          date={selectedDay}
          shift={selectedShift}
          employees={employees}
          onSave={handleSaveShift}
          onClose={() => setSelectedDay(null)}
          saveError={actionError}
        />
      )}

      {/* Modal Dipendente: richiedi cambio */}
      {user?.role === 'employee' && selectedDay && (
        <SwapModal
          date={selectedDay}
          shift={selectedShift}
          employees={employees}
          currentUser={user}
          onClose={() => setSelectedDay(null)}
          onSubmit={handleSwapRequest}
          submitError={actionError}
        />
      )}
    </div>
  )
}
