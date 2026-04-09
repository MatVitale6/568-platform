import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const RequestsContext = createContext(null)
const REQUESTS_TIMEOUT_MS = 10000

function withTimeout(promise, timeoutMs, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    }),
  ])
}

function normalizeRequest(row) {
  return {
    id: row.id,
    shiftId: row.shift_id,
    requesterId: row.requester_id,
    targetEmployeeId: row.target_employee_id,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    workDate: row.shifts?.work_date,
    requester: row.requester
      ? {
          id: row.requester.id,
          name: row.requester.full_name,
          color: row.requester.color,
        }
      : null,
    target: row.target
      ? {
          id: row.target.id,
          name: row.target.full_name,
          color: row.target.color,
        }
      : null,
  }
}

async function sendPushNotification({ profileIds, title, body, url }) {
  if (!isSupabaseConfigured || !supabase || !Array.isArray(profileIds) || profileIds.length === 0) {
    return
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: { profileIds, title, body, url },
    })

    if (error) {
      console.warn('send-push invoke error', error)
      return
    }

    if (data?.failedCount) {
      console.warn('send-push partial failure', data)
    }
  } catch {
    // Non blocchiamo il flusso applicativo se la notifica esterna fallisce.
  }
}

async function sendEmailNotification({ type, requesterId, targetId, workDate }) {
  if (!isSupabaseConfigured || !supabase) return

  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: { type, requesterId, targetId, workDate },
    })
    if (error) console.warn('send-email invoke error', error)
  } catch {
    // Non blocchiamo il flusso se l'email fallisce.
  }
}

export function RequestsProvider({ children }) {
  const { user, loading: authLoading } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return

    if (!user || !isSupabaseConfigured || !supabase) {
      setRequests([])
      setLoading(false)
      return
    }

    let mounted = true

    const loadRequests = async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true)
      }
      setError('')

      let query = supabase
        .from('swap_requests')
        .select(`
          id,
          shift_id,
          requester_id,
          target_employee_id,
          status,
          created_at,
          responded_at,
          shifts!inner(work_date),
          requester:profiles!swap_requests_requester_id_fkey(id, full_name, color),
          target:profiles!swap_requests_target_employee_id_fkey(id, full_name, color)
        `)
        .order('created_at', { ascending: false })

      if (user.role !== 'admin') {
        query = query.or(`requester_id.eq.${user.id},target_employee_id.eq.${user.id}`)
      }

      let data
      let loadError

      try {
        const result = await withTimeout(query, REQUESTS_TIMEOUT_MS, 'Timeout caricamento richieste')
        data = result.data
        loadError = result.error
      } catch (timeoutError) {
        setError(timeoutError.message)
        if (!silent) {
          setLoading(false)
        }
        return
      }

      if (!mounted) return

      if (loadError) {
        setError(loadError.message)
        if (!silent) {
          setLoading(false)
        }
        return
      }

      setRequests((data ?? []).map(normalizeRequest))
      if (!silent) {
        setLoading(false)
      }
    }

    loadRequests()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadRequests({ silent: true })
      }
    }

    window.addEventListener('focus', handleVisibilityChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const channel = supabase
      .channel(`swap-requests-${user.id}-${user.role}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_requests' }, () => {
        loadRequests({ silent: true })
      })
      .subscribe()

    return () => {
      mounted = false
      window.removeEventListener('focus', handleVisibilityChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(channel)
    }
  }, [authLoading, user])

  const reloadRequests = async () => {
    if (!user || !isSupabaseConfigured || !supabase) return

    setLoading(true)
    setError('')

    let query = supabase
      .from('swap_requests')
      .select(`
        id,
        shift_id,
        requester_id,
        target_employee_id,
        status,
        created_at,
        responded_at,
        shifts!inner(work_date),
        requester:profiles!swap_requests_requester_id_fkey(id, full_name, color),
        target:profiles!swap_requests_target_employee_id_fkey(id, full_name, color)
      `)
      .order('created_at', { ascending: false })

    if (user.role !== 'admin') {
      query = query.or(`requester_id.eq.${user.id},target_employee_id.eq.${user.id}`)
    }

    const { data, error: loadError } = await withTimeout(
      query,
      REQUESTS_TIMEOUT_MS,
      'Timeout caricamento richieste',
    )

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      throw loadError
    }

    setRequests((data ?? []).map(normalizeRequest))
    setLoading(false)
  }

  const createSwapRequest = async ({ shiftId, targetEmployeeId }) => {
    if (!user || !isSupabaseConfigured || !supabase) return

    setError('')
    const { error: rpcError } = await supabase.rpc('create_swap_request', {
      p_shift_id: shiftId,
      p_requester_id: user.id,
      p_target_employee_id: targetEmployeeId,
    })

    if (rpcError) {
      setError(rpcError.message)
      throw rpcError
    }

    // Carica work_date della shift per includerla nell'email
    const { data: shiftRow } = await supabase
      .from('shifts')
      .select('work_date')
      .eq('id', shiftId)
      .maybeSingle()

    await Promise.all([
      sendPushNotification({
        profileIds: [targetEmployeeId],
        title: 'Nuova richiesta cambio turno',
        body: `${user.name} ti ha inviato una richiesta di cambio turno`,
        url: '/requests',
      }),
      sendEmailNotification({
        type: 'swap_new',
        requesterId: user.id,
        targetId: targetEmployeeId,
        workDate: shiftRow?.work_date ?? '',
      }),
    ])

    await reloadRequests()
  }

  const respondToSwapRequest = async (requestId, decision) => {
    if (!user || !isSupabaseConfigured || !supabase) return

    setError('')
    const request = requests.find((item) => item.id === requestId)
    const { error: rpcError } = await supabase.rpc('respond_to_swap_request', {
      p_swap_request_id: requestId,
      p_decision: decision,
    })

    if (rpcError) {
      setError(rpcError.message)
      throw rpcError
    }

    if (request?.requesterId) {
      const emailType = decision === 'accepted' ? 'swap_accepted' : 'swap_rejected'
      await Promise.all([
        sendPushNotification({
          profileIds: [request.requesterId],
          title: decision === 'accepted' ? 'Richiesta accettata' : 'Richiesta rifiutata',
          body: `${user.name} ha ${decision === 'accepted' ? 'accettato' : 'rifiutato'} la tua richiesta di cambio turno`,
          url: '/requests',
        }),
        sendEmailNotification({
          type: emailType,
          requesterId: request.requesterId,
          targetId: user.id,
          workDate: request.workDate ?? '',
        }),
      ])
    }

    await reloadRequests()
  }

  const pendingCount = useMemo(() => {
    if (!user) return 0

    if (user.role === 'admin') {
      return requests.filter((request) => request.status === 'pending').length
    }

    return requests.filter(
      (request) => request.status === 'pending' && request.targetEmployeeId === user.id,
    ).length
  }, [requests, user])

  const pendingShiftIds = useMemo(
    () => new Set(requests.filter((request) => request.status === 'pending').map((request) => request.shiftId)),
    [requests],
  )

  return (
    <RequestsContext.Provider
      value={{
        requests,
        loading,
        error,
        pendingCount,
        pendingShiftIds,
        reloadRequests,
        createSwapRequest,
        respondToSwapRequest,
      }}
    >
      {children}
    </RequestsContext.Provider>
  )
}

export function useRequests() {
  return useContext(RequestsContext)
}