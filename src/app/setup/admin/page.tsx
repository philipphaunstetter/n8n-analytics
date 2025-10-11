'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  UserIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline'

interface SetupData {
  adminEmail: string
  adminPassword: string
  adminPasswordConfirm: string
}

export default function AdminSetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState<SetupData>({
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
            name: 'Admin', // Default admin name
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        {/* Admin Account */}
        <Card>
          <CardHeader className="text-center pb-8">
            {/* Branding */}
            <div className="flex items-center justify-center space-x-2 mb-6">
              <UserIcon className="h-8 w-8 text-indigo-600" />
              <span className="text-2xl font-bold text-gray-900">Elova</span>
            </div>
            
            {/* Headline and Subheadline */}
            <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">
              Create Admin Account
            </CardTitle>
            <CardDescription className="text-base text-gray-600 mt-2">
              Create your administrator account to get started with Elova. You can configure integrations and settings after signing in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
              <div className="relative">
                <Input
                  id="adminPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.adminPassword}
                  onChange={(e) => handleInputChange('adminPassword', e.target.value)}
                  placeholder="Enter a secure password (min 6 characters)"
                  required
                  minLength={6}
                  className="pr-10"
                />
                <Button
                  type="button"
                  plain
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="adminPasswordConfirm">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="adminPasswordConfirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.adminPasswordConfirm}
                  onChange={(e) => handleInputChange('adminPasswordConfirm', e.target.value)}
                  placeholder="Confirm your password"
                  required
                  minLength={6}
                  className="pr-10"
                />
                <Button
                  type="button"
                  plain
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !formData.adminEmail || !formData.adminPassword || !formData.adminPasswordConfirm}
              className="w-full flex items-center justify-center gap-2"
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
          </CardContent>
        </Card>
      </form>
    </div>
  )
}