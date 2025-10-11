import { createClient } from '@supabase/supabase-js'

// Create Supabase client safely
function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If environment variables are missing (e.g., during build), create a dummy client
  if (!supabaseUrl || !supabaseAnonKey) {
    return createClient('https://dummy.supabase.co', 'dummy_key')
  }

  // Create real Supabase client with enhanced session management
  return createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: {
      getItem: (key: string) => {
        if (typeof window === 'undefined') return null
        return window.localStorage.getItem(key)
      },
      setItem: (key: string, value: string) => {
        if (typeof window === 'undefined') return
        window.localStorage.setItem(key, value)
      },
      removeItem: (key: string) => {
        if (typeof window === 'undefined') return
        window.localStorage.removeItem(key)
      },
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'elova-dashboard'
    }
  }
})
}

// Create and export the Supabase client
export const supabase = createSupabaseClient()

// Database types (will be generated later with Supabase CLI)
export type Database = {
  public: {
    Tables: {
      user_providers: {
        Row: {
          id: string
          user_id: string
          provider_type: 'n8n' | 'zapier' | 'make'
          provider_name: string
          provider_url: string
          api_key_encrypted: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_providers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['user_providers']['Insert']>
      }
      user_endpoints: {
        Row: {
          id: string
          user_id: string
          name: string
          url: string
          method: string
          headers: Record<string, string> | null
          interval_seconds: number
          timeout_ms: number
          expected_status_min: number
          expected_status_max: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_endpoints']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['user_endpoints']['Insert']>
      }
    }
  }
}