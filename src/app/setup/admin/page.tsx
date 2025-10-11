'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { 
  UserIcon,
  ClockIcon,
  BeakerIcon,
  LinkIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

interface SetupData {
  adminName: string
  adminEmail: string
  timezone: string
  demoMode: boolean
  n8nUrl: string
  n8nApiKey: string
  skipIntegrations: boolean
}

export default function AdminSetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<SetupData>({
    adminName: '',
    adminEmail: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    demoMode: false,
    n8nUrl: '',
    n8nApiKey: '',
    skipIntegrations: false
  })

  const handleInputChange = (field: keyof SetupData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Submit setup configuration
      const response = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminData: {
            name: formData.adminName,
            email: formData.adminEmail,
          },
          config: {
            timezone: formData.timezone,
            demoMode: formData.demoMode,
            n8nUrl: formData.n8nUrl,
            n8nApiKey: formData.n8nApiKey,
          },
          skipIntegrations: formData.skipIntegrations
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Setup failed')
      }

      const result = await response.json()
      
      // Redirect to setup complete page or dashboard
      router.push('/setup/complete')
    } catch (error) {
      console.error('Setup failed:', error)
      setError(error instanceof Error ? error.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Initial Setup
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Configure your Elova instance with basic settings and optional integrations.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Admin Account */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Admin Account
            </CardTitle>
            <CardDescription>
              Create your administrator account for accessing Elova.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="adminName">Full Name</Label>
              <Input
                id="adminName"
                type="text"
                value={formData.adminName}
                onChange={(e) => handleInputChange('adminName', e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>
            <div>
              <Label htmlFor="adminEmail">Email Address</Label>
              <Input
                id="adminEmail"
                type="email"
                value={formData.adminEmail}
                onChange={(e) => handleInputChange('adminEmail', e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Basic Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5" />
              Basic Configuration
            </CardTitle>
            <CardDescription>
              Configure basic application settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={formData.timezone}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Asia/Shanghai">Shanghai</option>
              </select>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <BeakerIcon className="h-4 w-4" />
                  Demo Mode
                </Label>
                <p className="text-sm text-gray-600">
                  Enable demo mode with sample data for testing
                </p>
              </div>
              <Switch
                checked={formData.demoMode}
                onCheckedChange={(checked) => handleInputChange('demoMode', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* n8n Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              n8n Integration (Optional)
            </CardTitle>
            <CardDescription>
              Connect to your n8n instance to monitor workflows. You can configure this later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="n8nUrl">n8n Instance URL</Label>
              <Input
                id="n8nUrl"
                type="url"
                value={formData.n8nUrl}
                onChange={(e) => handleInputChange('n8nUrl', e.target.value)}
                placeholder="https://your-n8n-instance.com"
              />
            </div>
            <div>
              <Label htmlFor="n8nApiKey">n8n API Key</Label>
              <Input
                id="n8nApiKey"
                type="password"
                value={formData.n8nApiKey}
                onChange={(e) => handleInputChange('n8nApiKey', e.target.value)}
                placeholder="Enter your n8n API key"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Skip Integration Setup</Label>
                <p className="text-sm text-gray-600">
                  Skip n8n integration and configure manually later
                </p>
              </div>
              <Switch
                checked={formData.skipIntegrations}
                onCheckedChange={(checked) => handleInputChange('skipIntegrations', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex justify-between">
          <Button
            type="button"
            outline
            onClick={() => router.push('/setup/welcome')}
          >
            Back
          </Button>
          
          <Button
            type="submit"
            disabled={loading || !formData.adminName || !formData.adminEmail}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Setting up...
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4" />
                Complete Setup
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}