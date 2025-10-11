'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  UserIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

interface SetupData {
  adminName: string
  adminEmail: string
  adminPassword: string
  adminPasswordConfirm: string
}

export default function AdminSetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<SetupData>({
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminPasswordConfirm: ''
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

    // Validate passwords match
    if (formData.adminPassword !== formData.adminPasswordConfirm) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    // Validate password length
    if (formData.adminPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

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
            password: formData.adminPassword,
          }
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Setup failed')
      }

      const result = await response.json()
      
      // Redirect to dashboard after account creation
      router.push('/dashboard')
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
          Create Admin Account
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Create your administrator account to get started with Elova. You can configure integrations and settings after signing in.
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
            <div>
              <Label htmlFor="adminPassword">Password</Label>
              <Input
                id="adminPassword"
                type="password"
                value={formData.adminPassword}
                onChange={(e) => handleInputChange('adminPassword', e.target.value)}
                placeholder="Enter a secure password (min 6 characters)"
                required
                minLength={6}
              />
            </div>
            <div>
              <Label htmlFor="adminPasswordConfirm">Confirm Password</Label>
              <Input
                id="adminPasswordConfirm"
                type="password"
                value={formData.adminPasswordConfirm}
                onChange={(e) => handleInputChange('adminPasswordConfirm', e.target.value)}
                placeholder="Confirm your password"
                required
                minLength={6}
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={loading || !formData.adminName || !formData.adminEmail || !formData.adminPassword || !formData.adminPasswordConfirm}
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