'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { DevAuth, DevUser } from '@/lib/dev-auth'
import { SessionHealthChecker } from '@/lib/session-health'

interface AuthContextType {
  user: DevUser | null
  session: null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<{ error: string | null }>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  isDevMode: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DevUser | null>(null)
  const session = null
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
          // Store session and update state
          DevAuth.setSession(data.user)
          setUser(data.user)
          console.log('Session stored for user:', data.user.email)
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
    // Sign up functionality removed - using dev auth only
    return { error: 'Sign up not implemented in dev mode' }
  }

  const signOut = async () => {
    console.log('Signing out...')
    
    try {
      console.log('Clearing session')
      DevAuth.clearSession()
      setUser(null)
      return { error: null }
    } catch (error) {
      console.error('Error during sign out:', error)
      return { error: 'Sign out failed' }
    }
  }

  const resetPassword = async (email: string) => {
    // Password reset functionality removed - using dev auth only
    return { error: 'Password reset not implemented in dev mode' }
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