import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL in environment variables')
}
if (!supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_PUBLISHABLE_KEY in environment variables (VITE_SUPABASE_PUBLISHABLE_KEY)',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

