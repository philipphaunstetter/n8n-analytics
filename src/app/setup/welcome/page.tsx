'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircleIcon, 
  DatabaseIcon,
  UserGroupIcon,
  CogIcon,
  LinkIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface SetupStatus {
  isComplete: boolean
  completedSteps: {
    database: boolean
    adminAccount: boolean
    basicConfiguration: boolean
    integrations: boolean
  }
  nextStep: string
  requiresSetup: boolean
}

const SETUP_STEPS = [
  {
    id: 'database',
    title: 'Database Setup',
    description: 'Configure your database connection (SQLite or Supabase)',
    icon: DatabaseIcon,
  },
  {
    id: 'adminAccount',
    title: 'Admin Account',
    description: 'Create your administrator account',
    icon: UserGroupIcon,
  },
  {
    id: 'basicConfiguration',
    title: 'Basic Configuration',
    description: 'Configure core application settings',
    icon: CogIcon,
  },
  {
    id: 'integrations',
    title: 'Integrations',
    description: 'Connect to n8n and other workflow platforms (optional)',
    icon: LinkIcon,
  },
]

export default function WelcomePage() {
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    loadSetupStatus()
  }, [])

  const loadSetupStatus = async () => {
    try {
      const response = await fetch('/api/setup/status')
      if (response.ok) {
        const status = await response.json()
        setSetupStatus(status)
      }
    } catch (error) {
      console.error('Failed to load setup status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = () => {
    if (setupStatus?.nextStep === 'complete') {
      router.push('/dashboard')
    } else {
      // Go to next incomplete step
      const nextStep = setupStatus?.nextStep || 'admin'
      router.push(`/setup/${nextStep}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading setup status...</p>
        </div>
      </div>
    )
  }

  const completedCount = setupStatus ? Object.values(setupStatus.completedSteps).filter(Boolean).length : 0
  const totalSteps = SETUP_STEPS.length
  const progressPercentage = Math.round((completedCount / totalSteps) * 100)

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Welcome to Elova
        </h1>
        <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
          Let's get your workflow observability platform up and running. 
          This setup wizard will guide you through the initial configuration.
        </p>
      </div>

      {/* Progress Overview */}
      {setupStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Setup Progress
              <Badge variant={setupStatus.isComplete ? "success" : "secondary"}>
                {progressPercentage}% Complete
              </Badge>
            </CardTitle>
            <CardDescription>
              {setupStatus.isComplete 
                ? "Your setup is complete! You can now use Elova." 
                : `${completedCount} of ${totalSteps} steps completed`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>

              {/* Steps List */}
              <div className="grid gap-4 sm:grid-cols-2">
                {SETUP_STEPS.map((step, index) => {
                  const isCompleted = setupStatus.completedSteps[step.id as keyof typeof setupStatus.completedSteps]
                  const Icon = step.icon
                  
                  return (
                    <div 
                      key={step.id}
                      className={`flex items-start space-x-3 p-3 rounded-lg transition-colors ${
                        isCompleted 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className={`flex-shrink-0 mt-0.5 ${
                        isCompleted ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {isCompleted ? (
                          <CheckCircleIcon className="h-5 w-5" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className={`text-sm font-medium ${
                          isCompleted ? 'text-green-900' : 'text-gray-900'
                        }`}>
                          {step.title}
                        </h4>
                        <p className={`text-sm ${
                          isCompleted ? 'text-green-700' : 'text-gray-600'
                        }`}>
                          {step.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requirements Check */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <InformationCircleIcon className="h-5 w-5 text-blue-600" />
            Before We Begin
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="flex items-start space-x-3">
              <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-gray-900">Container Running</h4>
                <p className="text-sm text-gray-600">Your Elova container is up and running</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-gray-900">Database Available</h4>
                <p className="text-sm text-gray-600">SQLite database is ready for configuration</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-gray-900">Optional: External Services</h4>
                <p className="text-sm text-gray-600">
                  Have your n8n API credentials ready if you want to connect during setup 
                  (you can also configure this later)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Important Notice */}
      {!setupStatus?.isComplete && (
        <Alert>
          <ExclamationTriangleIcon className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> Complete the setup to access all Elova features. 
            You can always modify these settings later through the admin panel.
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center">
        <Button 
          onClick={handleContinue}
          size="lg"
          className="flex items-center gap-2"
        >
          {setupStatus?.isComplete ? 'Go to Dashboard' : 'Start Setup'}
          <ArrowRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}