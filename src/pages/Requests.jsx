import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRequests } from '@/context/RequestsContext'
import { usePushNotifications, isWebPushConfigured } from '@/hooks/usePushNotifications'

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  accepted: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export default function Requests() {
  const { user } = useAuth()
  const { requests, loading, error, respondToSwapRequest } = useRequests()
  const push = usePushNotifications()
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const handleDecision = async (requestId, decision) => {
    setActionError('')
    setBusyId(requestId)
    try {
      await respondToSwapRequest(requestId, decision)
    } catch (decisionError) {
      setActionError(decisionError.message || 'Aggiornamento richiesta non riuscito')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col">
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <p className="font-bold text-slate-800">Richieste cambio</p>
        <p className="text-xs text-slate-400 mt-0.5">Storico e notifiche in-app</p>
      </div>

      <div className="bg-white px-4 py-4 border-b border-slate-100">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3">
          <div>
            <p className="font-semibold text-slate-800">Notifiche browser</p>
            <p className="text-sm text-slate-500 mt-1">
              Ricevi una notifica quando arriva una richiesta o quando la tua richiesta viene accettata o rifiutata.
            </p>
          </div>

          {push.availability === 'unsupported' && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Questo browser non supporta Web Push.
            </p>
          )}

          {push.availability === 'vapid-missing' && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Configura `VITE_VAPID_PUBLIC_KEY` per attivare le notifiche push.
            </p>
          )}

          {push.error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {push.error}
            </p>
          )}

          {push.availability === 'ready' && (
            <div className="flex gap-2">
              {push.enabled ? (
                <button
                  onClick={push.disable}
                  disabled={push.loading}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-70"
                >
                  {push.loading ? 'Aggiornamento...' : 'Disattiva notifiche'}
                </button>
              ) : (
                <button
                  onClick={push.enable}
                  disabled={push.loading}
                  className="flex-1 rounded-xl border border-indigo-200 bg-indigo-50 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-70"
                >
                  {push.loading ? 'Attivazione...' : 'Attiva notifiche'}
                </button>
              )}
            </div>
          )}

          <p className="text-xs text-slate-400">
            Stato browser: {push.permission}. {isWebPushConfigured ? 'VAPID configurato.' : 'VAPID non configurato.'}
          </p>
        </div>
      </div>

      {(error || actionError) && (
        <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError || error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center text-center py-16 px-8 bg-white">
          <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin mb-4" />
          <p className="text-slate-400 text-sm">Caricamento richieste...</p>
        </div>
      )}

      {!loading && requests.length === 0 && (
        <div className="flex flex-col items-center text-center py-16 px-8 bg-white">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm">Nessuna richiesta presente</p>
        </div>
      )}

      {!loading && requests.length > 0 && (
        <div className="divide-y divide-slate-100">
          {requests.map((request) => {
            const isIncoming = request.targetEmployeeId === user.id
            const canRespond = request.status === 'pending' && (isIncoming || user.role === 'admin')

            return (
              <div key={request.id} className="bg-white px-4 py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{formatDate(request.workDate)}</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {request.requester?.name} → {request.target?.name}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold border px-2 py-1 rounded-full uppercase tracking-wider ${STATUS_STYLES[request.status]}`}>
                    {request.status}
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600 space-y-1">
                  <p><span className="text-slate-400">Richiedente:</span> {request.requester?.name}</p>
                  <p><span className="text-slate-400">Collega:</span> {request.target?.name}</p>
                  <p><span className="text-slate-400">Creata il:</span> {new Date(request.createdAt).toLocaleString('it-IT')}</p>
                  {request.respondedAt && <p><span className="text-slate-400">Risposta il:</span> {new Date(request.respondedAt).toLocaleString('it-IT')}</p>}
                </div>

                {canRespond && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDecision(request.id, 'rejected')}
                      disabled={busyId === request.id}
                      className="flex-1 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-70"
                    >
                      {busyId === request.id ? 'Aggiornamento...' : 'Rifiuta'}
                    </button>
                    <button
                      onClick={() => handleDecision(request.id, 'accepted')}
                      disabled={busyId === request.id}
                      className="flex-1 rounded-xl border border-green-200 bg-green-50 py-3 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:opacity-70"
                    >
                      {busyId === request.id ? 'Aggiornamento...' : 'Accetta'}
                    </button>
                  </div>
                )}

                {!canRespond && request.status === 'pending' && (
                  <p className="text-xs text-slate-400">
                    {isIncoming ? 'In attesa della tua risposta' : 'In attesa della risposta del collega'}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}