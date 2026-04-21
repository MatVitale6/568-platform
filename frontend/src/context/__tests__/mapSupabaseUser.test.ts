import { describe, it, expect } from 'vitest';
import { mapSupabaseUser } from '../AuthContext';
import type { SupabaseAuthUser, SupabaseProfile } from '../AuthContext';

// ─── A2: mapSupabaseUser ──────────────────────────────────────────────────────

const baseAuth: SupabaseAuthUser = {
	id: 'auth-123',
	email: 'mario@example.com',
	user_metadata: { full_name: 'Mario Rossi', role: 'employee' },
};

const baseProfile: SupabaseProfile = {
	id: 'profile-456',
	auth_user_id: 'auth-123',
	full_name: 'Mario Rossi',
	email: 'mario@example.com',
	role: 'employee',
	color: '#6366f1',
	first_login_completed: true,
	telegram_chat_id: null,
};

describe('mapSupabaseUser', () => {
	it('mappa correttamente i campi base dal profilo', () => {
		const user = mapSupabaseUser(baseAuth, baseProfile);
		expect(user.id).toBe('profile-456');
		expect(user.authUserId).toBe('auth-123');
		expect(user.name).toBe('Mario Rossi');
		expect(user.email).toBe('mario@example.com');
		expect(user.role).toBe('employee');
		expect(user.color).toBe('#6366f1');
	});

	it('firstLoginCompleted è true quando first_login_completed=true nel profilo', () => {
		const user = mapSupabaseUser(baseAuth, { ...baseProfile, first_login_completed: true });
		expect(user.firstLoginCompleted).toBe(true);
	});

	it('firstLoginCompleted è false quando first_login_completed=false nel profilo', () => {
		const user = mapSupabaseUser(baseAuth, { ...baseProfile, first_login_completed: false });
		expect(user.firstLoginCompleted).toBe(false);
	});

	it('telegramLinked è true quando telegram_chat_id è valorizzato', () => {
		const user = mapSupabaseUser(baseAuth, { ...baseProfile, telegram_chat_id: '12345678' });
		expect(user.telegramLinked).toBe(true);
	});

	it('telegramLinked è false quando telegram_chat_id è null', () => {
		const user = mapSupabaseUser(baseAuth, { ...baseProfile, telegram_chat_id: null });
		expect(user.telegramLinked).toBe(false);
	});

	it('con profilo null usa id e email da authUser come fallback', () => {
		const user = mapSupabaseUser(baseAuth, null);
		expect(user.id).toBe('auth-123');
		expect(user.email).toBe('mario@example.com');
		expect(user.firstLoginCompleted).toBe(false);
		expect(user.telegramLinked).toBe(false);
	});

	it('con profilo null usa full_name da user_metadata come fallback per il nome', () => {
		const user = mapSupabaseUser(baseAuth, null);
		expect(user.name).toBe('Mario Rossi');
	});

	it('con profilo null e nessun metadata usa la parte prima della @ dell\'email', () => {
		const user = mapSupabaseUser({ id: 'auth-123', email: 'pinco@test.it' }, null);
		expect(user.name).toBe('pinco');
	});

	it('con profilo null e nessuna email usa "Utente" come nome di default', () => {
		const user = mapSupabaseUser({ id: 'auth-123' }, null);
		expect(user.name).toBe('Utente');
	});
});
