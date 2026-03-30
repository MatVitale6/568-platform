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
  const { weekDays, currentMonday, goToPrevWeek, goToNextWeek, getShiftForDay, saveShift, employees } = useCalendar()
  const [selectedDay, setSelectedDay] = useState(null)

  const month = MONTHS[currentMonday.getMonth()]
  const year = currentMonday.getFullYear()
  const weekNum = getWeekNumber(currentMonday)

  const selectedShift = selectedDay ? getShiftForDay(selectedDay) : null

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

      {/* Righe giorni */}
      <div className="divide-y divide-slate-100">
        {weekDays.map((day) => (
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
          onSave={(data) => { saveShift(selectedDay, data); setSelectedDay(null) }}
          onClose={() => setSelectedDay(null)}
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
        />
      )}
    </div>
  )
}
