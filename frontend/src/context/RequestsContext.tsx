import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { SwapRequest } from '@/types';

interface RequestsContextValue {
	requests: SwapRequest[]
	loading: boolean
	error: string
	pendingCount: number
	pendingShiftIds: Set<string>
	reloadRequests: () => Promise<void>
	createSwapRequest: (params: { shiftId: string; targetEmployeeIds: string[] }) => Promise<void>
	respondToSwapRequest: (requestId: string, decision: string) => Promise<void>
}

const RequestsContext = createContext<RequestsContextValue | null>(null);
const REQUESTS_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, errorMessage: string): Promise<T> {
	return Promise.race([
		Promise.resolve(promise),
		new Promise<never>((_, reject) => {
			window.setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
		}),
	]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRequest(row: any): SwapRequest {
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
	};
}

async function sendPushNotification({ profileIds, title, body, url }: { profileIds: string[]; title: string; body: string; url: string }) {
	if (!isSupabaseConfigured || !supabase || !Array.isArray(profileIds) || profileIds.length === 0) {
		return;
	}

	try {
		const { data, error } = await supabase.functions.invoke('send-push', {
			body: { profileIds, title, body, url },
		});

		if (error) {
			console.warn('send-push invoke error', error);
			return;
		}

		if (data?.failedCount) {
			console.warn('send-push partial failure', data);
		}
	} catch {
		// Non blocchiamo il flusso applicativo se la notifica esterna fallisce.
	}
}

async function sendEmailNotification({ type, requesterId, targetId, workDate }: { type: string; requesterId: string; targetId: string; workDate: string }) {
	if (!isSupabaseConfigured || !supabase) return;

	try {
		const { error } = await supabase.functions.invoke('send-email', {
			body: { type, requesterId, targetId, workDate },
		});
		if (error) console.warn('send-email invoke error', error);
	} catch {
		// Non blocchiamo il flusso se l'email fallisce.
	}
}

export function RequestsProvider({ children }: { children: ReactNode }) {
	const { user, loading: authLoading } = useAuth();
	const [requests, setRequests] = useState<SwapRequest[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		if (authLoading) return;

		if (!user || !isSupabaseConfigured || !supabase) {
			return;
		}

		const sb = supabase;
		let mounted = true;

		const loadRequests = async ({ silent = false } = {}) => {
			await Promise.resolve();

			if (!silent) {
				setLoading(true);
			}
			setError('');

			let query = sb
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
				.order('created_at', { ascending: false });

			if (user.role !== 'admin') {
				query = query.or(`requester_id.eq.${user.id},target_employee_id.eq.${user.id}`);
			}

			let data: unknown[] | null;
			let loadError: { message: string } | null;

			try {
				const result = await withTimeout(query, REQUESTS_TIMEOUT_MS, 'Timeout caricamento richieste');
				data = result.data;
				loadError = result.error;
			} catch (timeoutError) {
				setError((timeoutError as Error).message);
				if (!silent) {
					setLoading(false);
				}
				return;
			}

			if (!mounted) return;

			if (loadError) {
				setError(loadError.message);
				if (!silent) {
					setLoading(false);
				}
				return;
			}

			setRequests((data ?? []).map(normalizeRequest));
			if (!silent) {
				setLoading(false);
			}
		};

		loadRequests();

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				loadRequests({ silent: true });
			}
		};

		window.addEventListener('focus', handleVisibilityChange);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		const channel = sb
			.channel(`swap-requests-${user.id}-${user.role}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'swap_requests' }, () => {
				loadRequests({ silent: true });
			})
			.subscribe();

		return () => {
			mounted = false;
			window.removeEventListener('focus', handleVisibilityChange);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			sb.removeChannel(channel);
		};
	}, [authLoading, user]);

	const reloadRequests = async () => {
		if (!user || !isSupabaseConfigured || !supabase) return;

		setLoading(true);
		setError('');

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
			.order('created_at', { ascending: false });

		if (user.role !== 'admin') {
			query = query.or(`requester_id.eq.${user.id},target_employee_id.eq.${user.id}`);
		}

		const { data, error: loadError } = await withTimeout(
			query,
			REQUESTS_TIMEOUT_MS,
			'Timeout caricamento richieste',
		);

		if (loadError) {
			setError(loadError.message);
			setLoading(false);
			throw loadError;
		}

		setRequests(((data as unknown[]) ?? []).map(normalizeRequest));
		setLoading(false);
	};

	const createSwapRequest = async ({ shiftId, targetEmployeeIds }: { shiftId: string; targetEmployeeIds: string[] }) => {
		if (!user || !isSupabaseConfigured || !supabase) return;

		setError('');

		for (const targetEmployeeId of targetEmployeeIds) {
			const { error: rpcError } = await supabase.rpc('create_swap_request', {
				p_shift_id: shiftId,
				p_requester_id: user.id,
				p_target_employee_id: targetEmployeeId,
			});

			if (rpcError) {
				setError(rpcError.message);
				throw rpcError;
			}
		}

		const { data: shiftRow } = await supabase
			.from('shifts')
			.select('work_date')
			.eq('id', shiftId)
			.maybeSingle();

		const workDate = shiftRow?.work_date ?? '';

		await Promise.all([
			sendPushNotification({
				profileIds: targetEmployeeIds,
				title: 'Nuova richiesta cambio turno',
				body: `${user.name} ti ha inviato una richiesta di cambio turno`,
				url: '/requests',
			}),
			...targetEmployeeIds.map(targetId =>
				sendEmailNotification({
					type: 'swap_new',
					requesterId: user.id,
					targetId,
					workDate,
				})
			),
		]);

		await reloadRequests();
	};

	const respondToSwapRequest = async (requestId: string, decision: string) => {
		if (!user || !isSupabaseConfigured || !supabase) return;

		setError('');
		const request = requests.find((item) => item.id === requestId);
		const { error: rpcError } = await supabase.rpc('respond_to_swap_request', {
			p_swap_request_id: requestId,
			p_decision: decision,
		});

		if (rpcError) {
			setError(rpcError.message);
			throw rpcError;
		}

		if (request?.requesterId) {
			const emailType = decision === 'accepted' ? 'swap_accepted' : 'swap_rejected';
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
			]);
		}

		await reloadRequests();
	};

	const pendingCount = useMemo(() => {
		if (!user) return 0;

		if (user.role === 'admin') {
			return requests.filter((request) => request.status === 'pending').length;
		}

		return requests.filter(
			(request) => request.status === 'pending' && request.targetEmployeeId === user.id,
		).length;
	}, [requests, user]);

	const pendingShiftIds = useMemo(
		() => new Set(requests.filter((request) => request.status === 'pending').map((request) => request.shiftId)),
		[requests],
	);

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
	);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRequests(): RequestsContextValue {
	const ctx = useContext(RequestsContext);
	if (!ctx) throw new Error('useRequests must be used within RequestsProvider');
	return ctx;
}
