'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/components/app-layout'
import { 
  UserCircleIcon,
  KeyIcon,
  BellIcon,
  ShieldCheckIcon,
  EnvelopeIcon,
  CalendarIcon,
  CogIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { Badge } from '@/components/badge'
import { showToast } from '@/components/toast'

function ProfileContent() {
  const { user, signOut } = useAuth()
  const [loading, setLoading] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [editingPassword, setEditingPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: (user as { name?: string; email?: string }).name || (user as { name?: string; email?: string }).email?.split('@')[0] || '',
        email: (user as { name?: string; email?: string }).email || ''
      }))
    }
  }, [user])

  const handleProfileUpdate = async () => {
    try {
      setLoading(true)
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      showToast({
        type: 'success',
        title: 'Profile updated',
        message: 'Your profile information has been updated successfully'
      })
      setEditingProfile(false)
    } catch {
      showToast({
        type: 'error',
        title: 'Update failed',
        message: 'Failed to update profile. Please try again.'
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async () => {
    if (formData.newPassword !== formData.confirmPassword) {
      showToast({
        type: 'error',
        title: 'Password mismatch',
        message: 'New password and confirmation password do not match'
      })
      return
    }

    if (formData.newPassword.length < 8) {
      showToast({
        type: 'error',
        title: 'Password too short',
        message: 'Password must be at least 8 characters long'
      })
      return
    }

    try {
      setLoading(true)
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      showToast({
        type: 'success',
        title: 'Password updated',
        message: 'Your password has been updated successfully'
      })
      setEditingPassword(false)
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }))
    } catch {
      showToast({
        type: 'error',
        title: 'Password change failed',
        message: 'Failed to change password. Please verify your current password.'
      })
    } finally {
      setLoading(false)
    }
  }

  const userEmail = (user as { email?: string })?.email || 'user@example.com'
  const userName = formData.name || userEmail.split('@')[0]
  const joinDate = new Date('2024-01-15') // Mock join date

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your account information and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Profile Information */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <UserCircleIcon className="h-5 w-5 mr-2" />
                  Profile Information
                </h3>
                {!editingProfile && (
                  <Button 
                    outline
                    onClick={() => setEditingProfile(true)}
                  >
                    <PencilIcon className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>

              {editingProfile ? (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <Input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="mt-1"
                      placeholder="Your full name"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <Input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="mt-1"
                      placeholder="your.email@example.com"
                    />
                  </div>

                  <div className="flex space-x-3">
                    <Button 
                      onClick={handleProfileUpdate}
                      disabled={loading}
                    >
                      <CheckIcon className="h-4 w-4 mr-1" />
                      {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button 
                      outline
                      onClick={() => {
                        setEditingProfile(false)
                        setFormData(prev => ({
                          ...prev,
                          name: (user as { name?: string; email?: string }).name || (user as { name?: string; email?: string }).email?.split('@')[0] || '',
                          email: (user as { name?: string; email?: string }).email || ''
                        }))
                      }}
                    >
                      <XMarkIcon className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <p className="mt-1 text-sm text-gray-900">{userName}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-sm text-gray-900">{userEmail}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Password Change */}
          <div className="bg-white shadow sm:rounded-lg mt-8">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <KeyIcon className="h-5 w-5 mr-2" />
                  Password
                </h3>
                {!editingPassword && (
                  <Button 
                    outline
                    onClick={() => setEditingPassword(true)}
                  >
                    <PencilIcon className="h-4 w-4 mr-1" />
                    Change Password
                  </Button>
                )}
              </div>

              {editingPassword ? (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                      Current Password
                    </label>
                    <Input
                      type="password"
                      id="currentPassword"
                      value={formData.currentPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="mt-1"
                      placeholder="Enter current password"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                      New Password
                    </label>
                    <Input
                      type="password"
                      id="newPassword"
                      value={formData.newPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="mt-1"
                      placeholder="Enter new password (min 8 characters)"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                      Confirm New Password
                    </label>
                    <Input
                      type="password"
                      id="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="mt-1"
                      placeholder="Confirm new password"
                    />
                  </div>

                  <div className="flex space-x-3">
                    <Button 
                      onClick={handlePasswordChange}
                      disabled={loading || !formData.currentPassword || !formData.newPassword || !formData.confirmPassword}
                    >
                      <CheckIcon className="h-4 w-4 mr-1" />
                      {loading ? 'Updating...' : 'Update Password'}
                    </Button>
                    <Button 
                      outline
                      onClick={() => {
                        setEditingPassword(false)
                        setFormData(prev => ({
                          ...prev,
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: ''
                        }))
                      }}
                    >
                      <XMarkIcon className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  Change your account password to keep your account secure.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Account Summary */}
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Account Summary</h3>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Email</p>
                    <p className="text-sm text-gray-500">{userEmail}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <CalendarIcon className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Joined</p>
                    <p className="text-sm text-gray-500">{joinDate.toLocaleDateString()}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <ShieldCheckIcon className="h-5 w-5 text-green-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Account Status</p>
                    <Badge color="green">Active</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                <Button 
                  outline 
                  className="w-full justify-start"
                >
                  <BellIcon className="h-4 w-4 mr-2" />
                  Notification Settings
                </Button>
                
                <Button 
                  outline 
                  className="w-full justify-start"
                >
                  <CogIcon className="h-4 w-4 mr-2" />
                  App Settings
                </Button>
                
                <Button 
                  outline 
                  className="w-full justify-start"
                >
                  <ShieldCheckIcon className="h-4 w-4 mr-2" />
                  Privacy Settings
                </Button>
              </div>
            </div>
          </div>

          {/* Account Actions */}
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Account Actions</h3>
              
              <div className="space-y-3">
                <Button 
                  outline 
                  className="w-full justify-center text-red-600 border-red-300 hover:bg-red-50"
                  onClick={async () => {
                    if (confirm('Are you sure you want to sign out?')) {
                      await signOut()
                      window.location.href = '/'
                    }
                  }}
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <AppLayout>
      <ProfileContent />
    </AppLayout>
  )
}