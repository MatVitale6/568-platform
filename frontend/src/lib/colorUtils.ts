import type { EmployeeDetail } from '@/types';

export const COLOR_PALETTE = [
	'#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6',
	'#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316',
];

/**
 * Restituisce il colore del testo (#1e293b scuro o #ffffff bianco) da usare
 * sull'avatar in base alla luminanza del colore di sfondo.
 */
export function getAvatarTextColor(hex: string): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	const toLinear = (c: number) => {
		const s = c / 255;
		return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
	return L > 0.179 ? '#1e293b' : '#ffffff';
}

/**
 * Sceglie il primo colore della palette non ancora usato;
 * se tutti sono esauriti ruota in base al numero di dipendenti.
 */
export function getNextColor(employees: Pick<EmployeeDetail, 'color'>[]): string {
	const usedColors = employees.map(e => e.color);
	const available = COLOR_PALETTE.find(c => !usedColors.includes(c));
	return available ?? COLOR_PALETTE[employees.length % COLOR_PALETTE.length];
}
