import { createClient } from '@supabase/supabase-js'

// Fallback layout strings to pass Vercel's strict compilation phase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Safe global client instantiation for root-level imports
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)