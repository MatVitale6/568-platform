import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { EmployeeDetail } from '@/types';

const COLOR_PALETTE = [
	'#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6',
	'#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316',
];

function getNextColor(employees: EmployeeDetail[]): string {
	const usedColors = employees.map(e => e.color);
	const available = COLOR_PALETTE.find(c => !usedColors.includes(c));
	return available ?? COLOR_PALETTE[employees.length % COLOR_PALETTE.length];
}

const INITIAL_EMPLOYEES: EmployeeDetail[] = [
	{ id: '1', name: 'Mario Rossi', fiscalCode: 'RSSMRA80A01H501Z', email: 'mario.rossi@email.com', phone: '3331234567', contractEnd: '', color: '#6366f1', invited: true },
	{ id: '2', name: 'Giulia Bianchi', fiscalCode: 'BNCGLI85M41L219Y', email: 'giulia.bianchi@email.com', phone: '3342345678', contractEnd: '2026-12-31', color: '#f43f5e', invited: true },
	{ id: '3', name: 'Luca Verdi', fiscalCode: 'VRDLCU90B01F205X', email: 'luca.verdi@email.com', phone: '3353456789', contractEnd: '', color: '#f59e0b', invited: false },
	{ id: '4', name: 'Anna Neri', fiscalCode: 'NRANNA92C41H501W', email: 'anna.neri@email.com', phone: '3364567890', contractEnd: '', color: '#10b981', invited: true },
	{ id: '5', name: 'Carlo Blu', fiscalCode: 'BLUCRL88D01L219V', email: 'carlo.blu@email.com', phone: '3375678901', contractEnd: '', color: '#3b82f6', invited: true },
];

interface EmployeeFormData {
	name: string;
	fiscalCode: string;
	email: string;
	phone: string;
	contractEnd: string;
}

export function useEmployees() {
	const [employees, setEmployees] = useState<EmployeeDetail[]>(isSupabaseConfigured ? [] : INITIAL_EMPLOYEES);
	const [loading, setLoading] = useState(isSupabaseConfigured);
	const [error, setError] = useState('');

	// 1. Pure async fetch function (NO synchronous setState at the start)
	const fetchEmployees = useCallback(async () => {
		if (!isSupabaseConfigured || !supabase) return;

		const { data, error: loadError } = await supabase
			.from('profiles')
			.select('id, full_name, email, role, color, employees!inner(fiscal_code, phone, contract_end, invited)')
			.order('created_at', { ascending: true });

		if (loadError) {
			setError(loadError.message);
			setLoading(false);
			return;
		}

		const mapped: EmployeeDetail[] = (data ?? []).map((row) => {
			const employeeRow = Array.isArray(row.employees) ? row.employees[0] : row.employees;

			return {
				id: row.id,
				name: row.full_name,
				email: row.email,
				role: row.role,
				color: row.color ?? '#6366f1',
				fiscalCode: (employeeRow as { fiscal_code?: string })?.fiscal_code ?? '',
				phone: (employeeRow as { phone?: string })?.phone ?? '',
				contractEnd: (employeeRow as { contract_end?: string })?.contract_end ?? '',
				invited: (employeeRow as { invited?: boolean })?.invited ?? false,
			};
		});

		setEmployees(mapped);
		setLoading(false);
	}, []);

	// 2. Effect only handles initial mount. It jumps straight to the `await`.
	useEffect(() => {
		if (!isSupabaseConfigured || !supabase) return;

		let cancelled = false;

		const load = async () => {
			await fetchEmployees();
			if (cancelled) {
				// Handle cleanup if component unmounted during fetch
			}
		};

		load();

		return () => {
			cancelled = true;
		};
	}, [fetchEmployees]);

	// 3. Reload function for AFTER mutations. Safe to have synchronous setState here.
	const reloadEmployees = useCallback(async () => {
		if (!isSupabaseConfigured || !supabase) return;

		setLoading(true);
		setError('');
		setEmployees([]);

		await fetchEmployees();
	}, [fetchEmployees]);

	const addEmployee = async (data: EmployeeFormData) => {
		const color = getNextColor(employees);
		if (!isSupabaseConfigured || !supabase) {
			const newEmp: EmployeeDetail = {
				id: Date.now().toString(),
				...data,
				color,
				invited: false,
			};
			setEmployees(prev => [...prev, newEmp]);
			return newEmp;
		}

		setError('');

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
			.single();

		if (profileError) {
			setError(profileError.message);
			throw profileError;
		}

		const { error: employeeError } = await supabase
			.from('employees')
			.insert({
				profile_id: profileRow.id,
				fiscal_code: data.fiscalCode,
				phone: data.phone,
				contract_end: data.contractEnd || null,
				invited: false,
			});

		if (employeeError) {
			setError(employeeError.message);
			throw employeeError;
		}

		await reloadEmployees();
		return profileRow;
	};

	const updateEmployee = async (id: string, data: EmployeeFormData) => {
		if (!isSupabaseConfigured || !supabase) {
			setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
			return;
		}

		setError('');

		const { error: profileError } = await supabase
			.from('profiles')
			.update({
				full_name: data.name,
				email: data.email,
			})
			.eq('id', id);

		if (profileError) {
			setError(profileError.message);
			throw profileError;
		}

		const { error: employeeError } = await supabase
			.from('employees')
			.update({
				fiscal_code: data.fiscalCode,
				phone: data.phone,
				contract_end: data.contractEnd || null,
			})
			.eq('profile_id', id);

		if (employeeError) {
			setError(employeeError.message);
			throw employeeError;
		}

		await reloadEmployees();
	};

	const deleteEmployee = async (id: string) => {
		if (!isSupabaseConfigured || !supabase) {
			setEmployees(prev => prev.filter(e => e.id !== id));
			return;
		}

		setError('');
		const { error: deleteError } = await supabase
			.from('profiles')
			.delete()
			.eq('id', id);

		if (deleteError) {
			setError(deleteError.message);
			throw deleteError;
		}

		await reloadEmployees();
	};

	const sendInvite = async (id: string) => {
		if (!isSupabaseConfigured || !supabase) {
			setEmployees(prev => prev.map(e => e.id === id ? { ...e, invited: true } : e));
			return;
		}

		setError('');
		const { data: invokeData, error: inviteError } = await supabase.functions.invoke('send-invite', {
			body: { profileId: id },
		});

		// Estrai il messaggio reale dal corpo della risposta HTTP se disponibile
		let errMsg: string | null = null;
		if (inviteError) {
			try {
				// FunctionsHttpError ha un context che è la Response originale
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const body = await (inviteError as any).context?.json?.();
				errMsg = body?.error ?? inviteError.message;
			} catch {
				errMsg = inviteError.message;
			}
		}

		console.log('[sendInvite] response:', { invokeData, inviteError, errMsg });

		if (inviteError) {
			const msg = errMsg ?? 'Errore sconosciuto';
			setError(`Errore invito: ${msg}`);
			throw new Error(msg);
		}

		// La funzione può rispondere con { error: '...' } anche con status 200
		if (invokeData?.error) {
			const msg = invokeData.error as string;
			setError(`Errore invito: ${msg}`);
			throw new Error(msg);
		}

		await reloadEmployees();
	};

	return { employees, loading, error, addEmployee, updateEmployee, deleteEmployee, sendInvite, reload: reloadEmployees };
}
