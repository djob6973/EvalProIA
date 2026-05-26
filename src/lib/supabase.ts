import { createClient } from '@supabase/supabase-js'

// Try to get env vars from multiple sources (Vite client, server env, or fallback)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
                    import.meta.env.SUPABASE_URL ||
                    process.env.VITE_SUPABASE_URL ||
                    process.env.SUPABASE_URL

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
                        import.meta.env.SUPABASE_ANON_KEY ||
                        process.env.VITE_SUPABASE_ANON_KEY ||
                        process.env.SUPABASE_ANON_KEY

// Only create client if we're in the browser and variables are available
export const supabase = typeof window !== 'undefined' && supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
