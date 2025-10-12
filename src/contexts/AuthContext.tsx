'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@/lib/api-auth'
import { SessionHealthChecker } from '@/lib/session-health'

interface AuthContextType {
  user: User | null
  session: null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<{ error: string | null }>
  resetPassword: (email: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const session = null
  const [loading, setLoading] = useState(true)
  
  // Session restoration state to prevent unnecessary re-renders
  const [sessionRestored, setSessionRestored] = useState(false)

  // Initialize and manage session state
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('Initializing auth with session token management')
      
      try {
        // Check for existing session token in localStorage
        const sessionToken = localStorage.getItem('sessionToken')
        
        if (sessionToken) {
          // Validate session token by making a request to a protected endpoint
          const response = await fetch('/api/user/profile', {
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          })
          
          if (response.ok) {
            const userData = await response.json()
            console.log('Found valid session:', userData.user?.email)
            setUser(userData.user)
          } else {
            // Invalid token, remove it
            localStorage.removeItem('sessionToken')
            console.log('Invalid session token removed')
          }
        } else {
          console.log('No existing session found')
        }
      } catch (error) {
        console.error('Error validating session:', error)
        localStorage.removeItem('sessionToken')
      }
      
      setLoading(false)
    }

    initializeAuth()

    // Set up cross-tab session synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sessionToken') {
        if (e.newValue) {
          // Session was set in another tab, validate it
          initializeAuth()
        } else {
          // Session was cleared in another tab
          setUser(null)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

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
        if (data.success && data.user && data.sessionToken) {
          // Store session token and update state
          localStorage.setItem('sessionToken', data.sessionToken)
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
      localStorage.removeItem('sessionToken')
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