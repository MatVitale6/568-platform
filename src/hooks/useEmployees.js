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

import { useState } from 'react'

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
  const [employees, setEmployees] = useState(INITIAL_EMPLOYEES)

  const addEmployee = (data) => {
    const color = getNextColor(employees)
    const newEmp = {
      id: Date.now().toString(),
      ...data,
      color,
      invited: false,
    }
    setEmployees(prev => [...prev, newEmp])
    return newEmp
  }

  const updateEmployee = (id, data) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...data } : e))
  }

  const deleteEmployee = (id) => {
    setEmployees(prev => prev.filter(e => e.id !== id))
  }

  const sendInvite = (id) => {
    // In futuro: chiama Supabase + invia email
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, invited: true } : e))
  }

  return { employees, addEmployee, updateEmployee, deleteEmployee, sendInvite }
}
