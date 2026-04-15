import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function isPlaceholder(value: string | undefined, placeholder: string): boolean {
	return !value || value === placeholder;
}

export const isSupabaseConfigured =
	!isPlaceholder(supabaseUrl, 'https://your-project.supabase.co') &&
	!isPlaceholder(supabaseAnonKey, 'your-anon-key-here');

export const supabase = isSupabaseConfigured
	? createClient(supabaseUrl, supabaseAnonKey)
	: null;
