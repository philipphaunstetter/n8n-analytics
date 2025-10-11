'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { DevAuth, DevUser } from '@/lib/dev-auth'
import { SessionHealthChecker } from '@/lib/session-health'

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
  
  // Session restoration state to prevent unnecessary re-renders
  const [sessionRestored, setSessionRestored] = useState(false)

  // Initialize and manage session state
  useEffect(() => {
    let devAuthCleanup: (() => void) | null = null
    let supabaseSubscription: { unsubscribe: () => void } | null = null

    const initializeAuth = async () => {
      console.log('Initializing authentication...')
      
      if (isDevMode) {
        console.log('Development mode: checking dev auth session')
        
        // Check for existing dev session
        const devUser = DevAuth.getSession()
        if (devUser) {
          console.log('Found dev user session:', devUser.email)
          setUser(devUser)
          setLoading(false)
          setSessionRestored(true)
        } else {
          console.log('No dev user session found')
          setLoading(false)
          setSessionRestored(true)
        }

        // Set up cross-tab synchronization
        devAuthCleanup = DevAuth.setupSessionSync((newUser) => {
          console.log('Dev auth session changed from another tab:', newUser?.email || 'signed out')
          setUser(newUser)
        })
      } else {
        console.log('Production mode: checking Supabase session')
        
        try {
          // Get initial Supabase session
          const { data: { session }, error } = await supabase.auth.getSession()
          
          if (error) {
            console.error('Error getting Supabase session:', error)
          } else if (session) {
            console.log('Found Supabase session:', session.user.email)
            setSession(session)
            setUser(session.user)
          } else {
            console.log('No Supabase session found')
          }
        } catch (error) {
          console.error('Failed to initialize Supabase session:', error)
        }
        
        setLoading(false)
        setSessionRestored(true)

        // Listen for Supabase auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('Supabase auth state changed:', event, session?.user?.email || 'signed out')
            
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              setSession(session)
              setUser(session?.user ?? null)
            } else if (event === 'SIGNED_OUT') {
              setSession(null)
              setUser(null)
            }
            
            // Ensure loading is false after any auth event
            setLoading(false)
          }
        )
        
        supabaseSubscription = subscription
      }
    }

    initializeAuth()

    // Enable session health monitoring in development
    let healthMonitorCleanup: (() => void) | undefined
    if (process.env.NODE_ENV === 'development') {
      // Initial health report
      setTimeout(() => {
        SessionHealthChecker.logReport()
      }, 1000)
      
      // Start monitoring (optional - can be disabled by commenting out)
      // healthMonitorCleanup = SessionHealthChecker.startMonitoring(30000)
    }

    // Cleanup function
    return () => {
      if (devAuthCleanup) {
        devAuthCleanup()
      }
      if (supabaseSubscription) {
        supabaseSubscription.unsubscribe()
      }
      if (healthMonitorCleanup) {
        healthMonitorCleanup()
      }
    }
  }, [isDevMode]) // Include isDevMode in dependencies

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
    console.log('Signing out...')
    
    try {
      if (isDevMode) {
        console.log('Clearing dev auth session')
        DevAuth.clearSession()
        setUser(null)
        setSession(null)
        return { error: null }
      } else {
        console.log('Signing out from Supabase')
        const { error } = await supabase.auth.signOut()
        if (!error) {
          setUser(null)
          setSession(null)
        }
        return { error }
      }
    } catch (error) {
      console.error('Error during sign out:', error)
      return { error: 'Sign out failed' }
    }
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