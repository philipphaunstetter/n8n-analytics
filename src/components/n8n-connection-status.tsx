'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  ExclamationTriangleIcon,
  LinkIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'

interface ConnectionStatus {
  isConfigured: boolean
  isConnected: boolean
  lastChecked?: string
  error?: string
  workflowCount?: number
  n8nVersion?: string
}

interface N8NConnectionStatusProps {
  onConnectionRestored?: () => void
  showRetry?: boolean
}

export function N8NConnectionStatus({ onConnectionRestored, showRetry = true }: N8NConnectionStatusProps) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [testing, setTesting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkConnectionStatus()
  }, [])

  const checkConnectionStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/n8n/connection-status')
      
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
        
        // If connection is restored and callback provided, call it
        if (data.isConnected && onConnectionRestored) {
          onConnectionRestored()
        }
      } else {
        setStatus({
          isConfigured: false,
          isConnected: false,
          error: 'Unable to check connection status'
        })
      }
    } catch (error) {
      setStatus({
        isConfigured: false,
        isConnected: false,
        error: 'Network error while checking connection'
      })
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    
    try {
      const response = await fetch('/api/n8n/test-connection', {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        setStatus({
          isConfigured: true,
          isConnected: true,
          workflowCount: data.workflowCount,
          n8nVersion: data.version,
          lastChecked: new Date().toISOString()
        })
        
        if (onConnectionRestored) {
          onConnectionRestored()
        }
      } else {
        const error = await response.json()
        setStatus(prev => ({
          isConfigured: prev?.isConfigured || true,
          isConnected: false,
          error: error.message || 'Connection test failed'
        }))
      }
    } catch (error) {
      setStatus(prev => ({
        isConfigured: prev?.isConfigured || true,
        isConnected: false,
        error: 'Network error during connection test'
      }))
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Unable to Check Connection
            </h3>
            <p className="text-sm text-gray-600">
              There was an error checking your n8n connection status.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Connection is working - don't show anything
  if (status.isConfigured && status.isConnected) {
    return null
  }

  // Determine the appropriate message and actions
  const getStatusInfo = () => {
    if (!status.isConfigured) {
      return {
        icon: <LinkIcon className="h-12 w-12 text-amber-500 mx-auto mb-4" />,
        title: 'n8n Not Connected',
        message: 'Connect your n8n instance to start monitoring workflows.',
        suggestion: 'Set up your n8n URL and API key in settings.',
        actionText: 'Configure n8n',
        actionHref: '/admin/settings',
        actionIcon: <Cog6ToothIcon className="h-4 w-4" />,
        severity: 'warning' as const
      }
    } else {
      return {
        icon: <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />,
        title: 'n8n Connection Failed',
        message: 'Cannot connect to your n8n instance.',
        suggestion: 'Check your n8n URL and API key in settings.',
        actionText: 'Check Settings',
        actionHref: '/admin/settings',
        actionIcon: <Cog6ToothIcon className="h-4 w-4" />,
        severity: 'error' as const
      }
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <div className="flex items-center justify-center min-h-96">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          {statusInfo.icon}
          <CardTitle className={`text-xl ${
            statusInfo.severity === 'error' ? 'text-red-900' : 'text-amber-900'
          }`}>
            {statusInfo.title}
          </CardTitle>
          <CardDescription className="text-base">
            {statusInfo.message}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Suggestion */}
          <div className={`p-4 rounded-lg border ${
            statusInfo.severity === 'error' 
              ? 'bg-red-50 border-red-200' 
              : 'bg-amber-50 border-amber-200'
          }`}>
            <p className={`text-sm font-medium ${
              statusInfo.severity === 'error' ? 'text-red-800' : 'text-amber-800'
            }`}>
              💡 {statusInfo.suggestion}
            </p>
          </div>

          {/* Error details if available */}
          {status.error && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
              <strong>Error:</strong> {status.error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button className="flex-1">
              <Link href={statusInfo.actionHref}>
                {statusInfo.actionIcon}
                {statusInfo.actionText}
              </Link>
            </Button>
            
            {showRetry && status.isConfigured && (
              <Button
                onClick={testConnection}
                disabled={testing}
outline
                className="flex-1"
              >
                {testing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
                    Testing...
                  </>
                ) : (
                  <>
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Help text */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Need help? Check the{' '}
              <Link href="/docs/n8n-integration" className="text-indigo-600 hover:text-indigo-800 underline">
                n8n integration guide
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}