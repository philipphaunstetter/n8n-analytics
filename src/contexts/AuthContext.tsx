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

    const initializeAuth = async () => {
      console.log('Initializing auth with SQLite session management')
      
      // Always use DevAuth session management (works for all users)
      const existingUser = DevAuth.getSession()
      if (existingUser) {
        console.log('Found existing session:', existingUser.email)
        setUser(existingUser)
      } else {
        console.log('No existing session found')
      }
      
      setLoading(false)
      setSessionRestored(true)

      // Set up cross-tab synchronization
      devAuthCleanup = DevAuth.setupSessionSync((newUser) => {
        console.log('Session changed from another tab:', newUser?.email || 'signed out')
        setUser(newUser)
      })
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
      if (healthMonitorCleanup) {
        healthMonitorCleanup()
      }
    }
  }, [isDevMode]) // Include isDevMode in dependencies

  const signIn = async (email: string, password: string) => {
    // Always try SQLite authentication first (works in all environments)
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.user) {
          // Use DevAuth session management for all users
          DevAuth.setSession(data.user)
          setUser(data.user)
          return { error: null }
        }
      } else {
        const errorData = await response.json()
        return { error: errorData.error || 'Authentication failed' }
      }
    } catch (error) {
      console.error('Authentication failed:', error)
      return { error: 'Authentication failed - please check your connection' }
    }

    return { error: 'Invalid credentials' }
  }

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
        }
      })
      return { error }
    } catch (error) {
      console.error('Supabase sign up failed:', error)
      return { error: 'Sign up failed - please check your configuration' }
    }
  }

  const signOut = async () => {
    console.log('Signing out...')
    
    try {
      console.log('Clearing session')
      DevAuth.clearSession()
      setUser(null)
      setSession(null)
      return { error: null }
    } catch (error) {
      console.error('Error during sign out:', error)
      return { error: 'Sign out failed' }
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`
      })
      return { error }
    } catch (error) {
      console.error('Supabase password reset failed:', error)
      return { error: 'Password reset failed - please check your configuration' }
    }
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