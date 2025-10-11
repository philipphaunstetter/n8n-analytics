'use client'

import { useState, useEffect } from 'react'
import { N8NConnectionStatus } from './n8n-connection-status'

interface WithN8NConnectionProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  showRetry?: boolean
}

interface ConnectionState {
  isLoading: boolean
  isConfigured: boolean
  isConnected: boolean
  error?: string
}

export function WithN8NConnection({ 
  children, 
  fallback, 
  showRetry = true 
}: WithN8NConnectionProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isLoading: true,
    isConfigured: false,
    isConnected: false
  })

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      setConnectionState(prev => ({ ...prev, isLoading: true }))
      
      const response = await fetch('/api/n8n/connection-status')
      if (response.ok) {
        const data = await response.json()
        setConnectionState({
          isLoading: false,
          isConfigured: data.isConfigured,
          isConnected: data.isConnected,
          error: data.error
        })
      } else {
        setConnectionState({
          isLoading: false,
          isConfigured: false,
          isConnected: false,
          error: 'Failed to check connection status'
        })
      }
    } catch (error) {
      setConnectionState({
        isLoading: false,
        isConfigured: false,
        isConnected: false,
        error: 'Network error while checking connection'
      })
    }
  }

  const handleConnectionRestored = () => {
    setConnectionState(prev => ({
      ...prev,
      isConfigured: true,
      isConnected: true,
      error: undefined
    }))
  }

  // Show loading state
  if (connectionState.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  // Show connection status if not properly connected
  if (!connectionState.isConfigured || !connectionState.isConnected) {
    return fallback || (
      <N8NConnectionStatus
        onConnectionRestored={handleConnectionRestored}
        showRetry={showRetry}
      />
    )
  }

  // Connection is good, render children
  return <>{children}</>
}

// Hook version for more flexibility
export function useN8NConnection() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isLoading: true,
    isConfigured: false,
    isConnected: false
  })

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      setConnectionState(prev => ({ ...prev, isLoading: true }))
      
      const response = await fetch('/api/n8n/connection-status')
      if (response.ok) {
        const data = await response.json()
        setConnectionState({
          isLoading: false,
          isConfigured: data.isConfigured,
          isConnected: data.isConnected,
          error: data.error
        })
      } else {
        setConnectionState({
          isLoading: false,
          isConfigured: false,
          isConnected: false,
          error: 'Failed to check connection status'
        })
      }
    } catch (error) {
      setConnectionState({
        isLoading: false,
        isConfigured: false,
        isConnected: false,
        error: 'Network error while checking connection'
      })
    }
  }

  const refresh = () => {
    checkConnection()
  }

  return {
    ...connectionState,
    isHealthy: connectionState.isConfigured && connectionState.isConnected,
    refresh
  }
}