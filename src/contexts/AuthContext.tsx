'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { DevAuth, DevUser } from '@/lib/dev-auth'

interface AuthContextType {
  user: User | DevUser | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | string | null }>
  signUp: (email: string, password: string) => Promise<{ error: AuthError | string | null }>
  signOut: () => Promise<{ error: AuthError | string | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | string | null }>
  isDevMode: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | DevUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const isDevMode = DevAuth.isDevelopment()

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      // Check for dev auth first
      if (isDevMode) {
        const devUser = DevAuth.getSession()
        if (devUser) {
          setUser(devUser)
          setLoading(false)
          return
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    // Try dev auth first
    if (isDevMode) {
      const devUser = DevAuth.authenticate(email, password)
      if (devUser) {
        DevAuth.setSession(devUser)
        setUser(devUser)
        return { error: null }
      }
      // If dev auth fails in dev mode, don't try Supabase
      return { error: 'Invalid credentials' }
    }

    // Only try Supabase auth if not in dev mode
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error }
    } catch (error) {
      return { error: 'Authentication failed' }
    }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
      }
    })
    return { error }
  }

  const signOut = async () => {
    // Clear dev auth session if it exists
    if (isDevMode && DevAuth.isAuthenticated()) {
      DevAuth.clearSession()
      setUser(null)
      return { error: null }
    }

    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`
    })
    return { error }
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    isDevMode,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext