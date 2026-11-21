import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseUrl = url ?? ''
export const supabaseConfigured = Boolean(url && anonKey)

// Volontairement nul quand la configuration manque : l'app doit pouvoir
// s'afficher et expliquer ce qui manque plutot que de planter au chargement.
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null
