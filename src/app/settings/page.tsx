'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { CogIcon } from '@heroicons/react/24/outline'

interface N8nConfig {
  url: string
  apiKey: string
}

export default function SettingsPage() {
  const [n8nConfig, setN8nConfig] = useState<N8nConfig>({ url: '', apiKey: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadN8nConfiguration()
  }, [])

  const loadN8nConfiguration = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/config')
      if (!response.ok) throw new Error('Failed to load configuration')
      
      const configData = await response.json()
      
      // Find n8n config items
      const n8nUrl = configData.find((item: any) => item.key === 'integrations.n8n.url')?.value || ''
      const n8nApiKey = configData.find((item: any) => item.key === 'integrations.n8n.api_key')?.value || ''
      
      setN8nConfig({ url: n8nUrl, apiKey: n8nApiKey })
      
      // Test connection if both are configured
      if (n8nUrl && n8nApiKey) {
        testConnection(false)
      }
    } catch (error) {
      console.error('Failed to load configuration:', error)
      setMessage('Failed to load configuration settings')
    } finally {
      setLoading(false)
    }
  }

  const saveConfiguration = async () => {
    try {
      setSaving(true)
      setMessage('')
      
      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          changes: {
            'integrations.n8n.url': n8nConfig.url,
            'integrations.n8n.api_key': n8nConfig.apiKey
          },
          changeReason: 'Updated n8n configuration via settings page'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to save configuration')
      }

      setMessage('Configuration saved successfully!')
      
      // Test the connection after saving
      if (n8nConfig.url && n8nConfig.apiKey) {
        testConnection(false)
      }
    } catch (error) {
      console.error('Failed to save configuration:', error)
      setMessage(error instanceof Error ? error.message : 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async (showUserMessage = true) => {
    if (!n8nConfig.url || !n8nConfig.apiKey) {
      setConnectionStatus('error')
      if (showUserMessage) {
        setMessage('Please enter both URL and API key before testing')
      }
      return
    }

    try {
      setTestingConnection(true)
      if (showUserMessage) {
        setMessage('')
      }

      const response = await fetch('/api/n8n/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: n8nConfig.url,
          apiKey: n8nConfig.apiKey
        })
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        setConnectionStatus('connected')
        if (showUserMessage) {
          setMessage(`Connected successfully! n8n version: ${result.version || 'unknown'}`)
        }
      } else {
        setConnectionStatus('error')
        if (showUserMessage) {
          setMessage(result.error || 'Failed to connect to n8n instance')
        }
      }
    } catch (error) {
      console.error('Failed to test connection:', error)
      setConnectionStatus('error')
      if (showUserMessage) {
        setMessage('Failed to test connection')
      }
    } finally {
      setTestingConnection(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <CogIcon className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-600" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <div className="flex items-center space-x-2">
              <CogIcon className="h-6 w-6 text-gray-600" />
              <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            </div>
            <p className="text-gray-600 text-sm mt-1">Configure your n8n integration</p>
          </div>
          
          <div className="px-6 py-6 space-y-6">
            {/* n8n Configuration */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">n8n Integration</h2>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="n8n-url" className="block text-sm font-medium text-gray-700 mb-1">
                    n8n Instance URL
                  </label>
                  <Input
                    id="n8n-url"
                    type="url"
                    value={n8nConfig.url}
                    onChange={(e) => setN8nConfig(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://your-n8n-instance.com"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the full URL of your n8n instance
                  </p>
                </div>
                
                <div>
                  <label htmlFor="n8n-api-key" className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <Input
                    id="n8n-api-key"
                    type="password"
                    value={n8nConfig.apiKey}
                    onChange={(e) => setN8nConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="Enter your n8n API key"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    You can find your API key in n8n under Settings → API Keys
                  </p>
                </div>
              </div>
            </div>

            {/* Connection Status */}
            {connectionStatus !== 'unknown' && (
              <div className={`p-4 rounded-md ${
                connectionStatus === 'connected' 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className={`text-sm font-medium ${
                    connectionStatus === 'connected' ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {connectionStatus === 'connected' ? 'Connected' : 'Connection Failed'}
                  </span>
                </div>
              </div>
            )}

            {/* Messages */}
            {message && (
              <div className={`p-4 rounded-md ${
                message.includes('success') || message.includes('Connected')
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                <p className="text-sm">{message}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-3 pt-4">
              <Button
                onClick={saveConfiguration}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
              
              <Button
                onClick={() => testConnection(true)}
                disabled={testingConnection || !n8nConfig.url || !n8nConfig.apiKey}
                outline
              >
                {testingConnection ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}