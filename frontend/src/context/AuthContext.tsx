import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { AppUser } from '@/types';

interface AuthContextValue {
	user: AppUser | null
	loading: boolean
	login: (userData: AppUser) => void
	loginWithPassword: (email: string, password: string) => Promise<AppUser>
	logout: () => Promise<void>
	refreshProfile: () => Promise<void>
	/** Marca firstLoginCompleted=true nello stato React in modo sincrono, senza dipendere da getSession() */
	completeFirstLogin: () => void
	isMockMode: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, errorMessage: string): Promise<T> {
	return Promise.race([
		Promise.resolve(promise),
		new Promise<never>((_, reject) => {
			window.setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
		}),
	]);
}

function mapMockUser(userData: AppUser): AppUser {
	return userData;
}

interface SupabaseProfile {
	id: string
	auth_user_id: string | null
	full_name: string
	email: string
	role: string
	color: string | null
	first_login_completed: boolean
	telegram_chat_id: string | null
}

interface SupabaseAuthUser {
	id: string
	email?: string
	user_metadata?: Record<string, string>
}

function mapSupabaseUser(authUser: SupabaseAuthUser, profile: SupabaseProfile | null): AppUser {
	const fallbackName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Utente';

	return {
		id: profile?.id ?? authUser.id,
		authUserId: authUser.id,
		name: profile?.full_name ?? fallbackName,
		email: profile?.email ?? authUser.email ?? '',
		role: (profile?.role ?? authUser.user_metadata?.role ?? 'employee') as AppUser['role'],
		color: profile?.color ?? authUser.user_metadata?.color ?? '#6366f1',
		firstLoginCompleted: profile?.first_login_completed ?? false,
		telegramLinked: !!profile?.telegram_chat_id,
	};
}

async function getProfileForUser(userId: string): Promise<SupabaseProfile | null> {
	if (!isSupabaseConfigured || !supabase) return null;

	const { data: byAuthUserId, error: byAuthUserIdError } = await withTimeout(
		supabase
			.from('profiles')
			.select('id, auth_user_id, full_name, email, role, color, first_login_completed, telegram_chat_id')
			.eq('auth_user_id', userId)
			.maybeSingle(),
		AUTH_TIMEOUT_MS,
		'Timeout caricamento profilo',
	);

	if (byAuthUserIdError) throw byAuthUserIdError;
	if (byAuthUserId) return byAuthUserId as SupabaseProfile;

	const { data, error } = await withTimeout(
		supabase
			.from('profiles')
			.select('id, auth_user_id, full_name, email, role, color, first_login_completed, telegram_chat_id')
			.eq('id', userId)
			.maybeSingle(),
		AUTH_TIMEOUT_MS,
		'Timeout caricamento profilo',
	);

	if (error) throw error;
	return data as SupabaseProfile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AppUser | null>(null);

	// If Supabase isn't configured, we aren't loading anything, so start as false.
	const [loading, setLoading] = useState(isSupabaseConfigured);

	useEffect(() => {
		if (!isSupabaseConfigured || !supabase) {
			// FIX 1 (continued): No longer need setLoading(false) here!
			return undefined;
		}

		const sb = supabase;
		let mounted = true;

		const bootstrap = async () => {
			// Se l'URL contiene un token di invito/recovery nell'hash, non impostare
			// loading=false qui: onAuthStateChange si occuperà di tutto quando
			// Supabase processa il token. Senza questa guardia si finisce su /login
			// perché getSession() restituisce null prima che il token venga consumato.
			if (window.location.hash.includes('access_token')) {
				return;
			}

			try {
				const { data, error } = await withTimeout(
					sb.auth.getSession(),
					AUTH_TIMEOUT_MS,
					'Timeout recupero sessione',
				);

				if (error) {
					if (mounted) setLoading(false);
					return;
				}

				if (data.session?.user) {
					try {
						const profile = await getProfileForUser(data.session.user.id);
						if (mounted) setUser(mapSupabaseUser(data.session.user, profile));
						if (mounted) window.dispatchEvent(new Event('app:login'));
					} catch {
						// Se il profilo non si carica, non azzerare firstLoginCompleted
						if (mounted) setUser(prev => prev ?? mapSupabaseUser(data.session!.user, null));
						if (mounted) window.dispatchEvent(new Event('app:login'));
					}
				}
			} catch {
				if (mounted) {
					setUser(null);
				}
			}

			if (mounted) setLoading(false);
		};

		bootstrap();

		const { data: listener } = sb.auth.onAuthStateChange(async (_event, session) => {
			if (!mounted) return;

			if (!session?.user) {
				window.dispatchEvent(new Event('app:logout'));
				setUser(null);
				if (mounted) setLoading(false);
				return;
			}

			try {
				const profile = await getProfileForUser(session.user.id);
				if (mounted) setUser(mapSupabaseUser(session.user, profile));
				window.dispatchEvent(new Event('app:login'));
			} catch {
				// Non resettare firstLoginCompleted se il profilo è già caricato
				setUser(prev => prev ?? mapSupabaseUser(session.user, null));
				window.dispatchEvent(new Event('app:login'));
			}
			if (mounted) setLoading(false);
		});

		return () => {
			mounted = false;
			listener.subscription.unsubscribe();
		};
	}, []);

	const login = (userData: AppUser) => setUser(mapMockUser(userData));

	const refreshProfile = async () => {
		if (!isSupabaseConfigured || !supabase) return;
		const { data } = await supabase.auth.getSession();
		if (!data.session?.user) return;
		const profile = await getProfileForUser(data.session.user.id);
		setUser(mapSupabaseUser(data.session.user, profile));
	};

	// Aggiornamento ottimistico sincrono: evita la race condition con updateUser()
	// che può ruotare il token e rendere getSession() transientemente null
	const completeFirstLogin = () => {
		setUser(prev => prev ? { ...prev, firstLoginCompleted: true } : prev);
	};

	const loginWithPassword = async (email: string, password: string): Promise<AppUser> => {
		if (!isSupabaseConfigured || !supabase) {
			throw new Error('Supabase non configurato');
		}

		const { data, error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) throw error;

		const profile = await getProfileForUser(data.user.id);
		const mappedUser = mapSupabaseUser(data.user, profile);
		setUser(mappedUser);
		window.dispatchEvent(new Event('app:login'));
		return mappedUser;
	};

	const logout = async () => {
		try { window.dispatchEvent(new Event('app:logout')); } catch { /* ignore */ }
		if (isSupabaseConfigured && supabase) {
			await supabase.auth.signOut();
		}
		setUser(null);
	};

	return (
		<AuthContext.Provider value={{ user, loading, login, loginWithPassword, logout, refreshProfile, completeFirstLogin, isMockMode: !isSupabaseConfigured }}>
			{children}
		</AuthContext.Provider>
	);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used within AuthProvider');
	return ctx;
}
