import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const RequestsContext = createContext(null)

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

    const loadRequests = async () => {
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

      const { data, error: loadError } = await query

      if (!mounted) return

      if (loadError) {
        setError(loadError.message)
        setLoading(false)
        return
      }

      setRequests((data ?? []).map(normalizeRequest))
      setLoading(false)
    }

    loadRequests()

    const channel = supabase
      .channel(`swap-requests-${user.id}-${user.role}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_requests' }, () => {
        loadRequests()
      })
      .subscribe()

    return () => {
      mounted = false
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

    const { data, error: loadError } = await query

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

    await reloadRequests()
  }

  const respondToSwapRequest = async (requestId, decision) => {
    if (!user || !isSupabaseConfigured || !supabase) return

    setError('')
    const { error: rpcError } = await supabase.rpc('respond_to_swap_request', {
      p_swap_request_id: requestId,
      p_decision: decision,
    })

    if (rpcError) {
      setError(rpcError.message)
      throw rpcError
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