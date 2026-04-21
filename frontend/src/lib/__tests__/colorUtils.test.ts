import { describe, it, expect } from 'vitest';
import { getAvatarTextColor, getNextColor, COLOR_PALETTE } from '../colorUtils';

// ─── A1: getAvatarTextColor ───────────────────────────────────────────────────

describe('getAvatarTextColor', () => {
	it('restituisce bianco (#ffffff) su sfondo scuro', () => {
		expect(getAvatarTextColor('#0f172a')).toBe('#ffffff'); // slate-900
		expect(getAvatarTextColor('#1e293b')).toBe('#ffffff'); // slate-800
		expect(getAvatarTextColor('#000000')).toBe('#ffffff'); // nero puro
	});

	it('restituisce scuro (#1e293b) su sfondo chiaro', () => {
		expect(getAvatarTextColor('#ffffff')).toBe('#1e293b'); // bianco puro
		expect(getAvatarTextColor('#f1f5f9')).toBe('#1e293b'); // slate-100
		expect(getAvatarTextColor('#fef9c3')).toBe('#1e293b'); // giallo chiaro
	});

	it('usa la soglia di luminanza corretta per i colori di brand', () => {
		// indigo-500 (#6366f1): luminanza ≈ 0.185 > 0.179 → il contrasto migliore è testo scuro
		expect(getAvatarTextColor('#6366f1')).toBe('#1e293b');
		// amber (#f59e0b) è chiaro → testo scuro
		expect(getAvatarTextColor('#f59e0b')).toBe('#1e293b');
		// emerald-500 (#10b981) è medio-chiaro → testo scuro
		expect(getAvatarTextColor('#10b981')).toBe('#1e293b');
		// testo su sfondo completamente nero → bianco
		expect(getAvatarTextColor('#000000')).toBe('#ffffff');
	});
});

// ─── A3: getNextColor ─────────────────────────────────────────────────────────

describe('getNextColor', () => {
	it('restituisce il primo colore della palette se nessuno è in uso', () => {
		expect(getNextColor([])).toBe(COLOR_PALETTE[0]);
	});

	it('salta i colori già usati e sceglie il primo libero', () => {
		const used = [{ color: COLOR_PALETTE[0] }, { color: COLOR_PALETTE[1] }];
		expect(getNextColor(used)).toBe(COLOR_PALETTE[2]);
	});

	it('copre tutti i colori disponibili senza ripetizioni', () => {
		const used = COLOR_PALETTE.map(color => ({ color }));
		// Tutti esauriti: ruota in base alla lunghezza
		const result = getNextColor(used);
		expect(COLOR_PALETTE).toContain(result);
	});

	it('ruota quando la palette è esaurita (modulo sulla lunghezza)', () => {
		const used = COLOR_PALETTE.map(color => ({ color }));
		// 10 dipendenti con tutti i colori → index 10 % 10 = 0
		expect(getNextColor(used)).toBe(COLOR_PALETTE[10 % COLOR_PALETTE.length]);
	});
});
