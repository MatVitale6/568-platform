/**
 * supabase.js
 * Client Supabase condiviso per tutta l'applicazione.
 *
 * Le credenziali vengono lette dalle variabili d'ambiente:
 * - VITE_SUPABASE_URL    → Project URL (Supabase Dashboard → Settings → API)
 * - VITE_SUPABASE_ANON_KEY → anon/public key
 *
 * Le variabili vanno inserite nel file .env.local (mai committare questo file).
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
