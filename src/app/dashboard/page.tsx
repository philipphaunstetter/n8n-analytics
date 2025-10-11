'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/components/app-layout'
import { WithN8NConnection } from '@/components/with-n8n-connection'
import { apiClient } from '@/lib/api-client'
import { DashboardStats, TimeRange } from '@/types'
import { 
  PlayIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline'

function DashboardContent() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const response = await apiClient.get<{ data: DashboardStats }>(`/dashboard/stats?timeRange=${timeRange}`)
        setStats(response.data)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err)
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [timeRange])

  const statsDisplay = [
    { 
      name: 'Total Executions', 
      value: loading ? '...' : (stats?.totalExecutions ?? '0').toString(),
      icon: PlayIcon, 
      change: '',
      changeType: 'neutral' as const
    },
    { 
      name: 'Success Rate', 
      value: loading ? '...' : `${stats?.successRate ?? 0}%`,
      icon: CheckCircleIcon, 
      change: '',
      changeType: 'positive' as const
    },
    { 
      name: 'Failed Executions', 
      value: loading ? '...' : (stats?.failedExecutions ?? '0').toString(),
      icon: XCircleIcon, 
      change: '',
      changeType: 'negative' as const
    },
    { 
      name: 'Avg Response Time', 
      value: loading ? '...' : `${stats?.avgResponseTime ?? 0}ms`,
      icon: ClockIcon, 
      change: '',
      changeType: 'neutral' as const
    },
  ]

  if (error) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">Error loading dashboard</h3>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Overview of your workflow automation across all platforms
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {statsDisplay.map((item) => (
          <div key={item.name} className="bg-white px-4 py-5 sm:p-6 shadow rounded-lg overflow-hidden">
            <dt className="text-sm font-medium text-gray-500 truncate flex items-center">
              <item.icon className="h-5 w-5 mr-2 text-gray-400" />
              {item.name}
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{item.value}</dd>
          </div>
        ))}
      </div>

      {/* Setup Instructions */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Get Started</h3>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100">
                  <span className="text-sm font-medium text-indigo-600">1</span>
                </div>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-gray-900">Connect your first platform</h4>
                <p className="text-sm text-gray-500">
                  Add API credentials for n8n, Zapier, Make.com, or other automation platforms
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100">
                  <span className="text-sm font-medium text-gray-400">2</span>
                </div>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-gray-500">Configure monitoring</h4>
                <p className="text-sm text-gray-500">
                  Set up alerts and monitoring preferences for your workflows
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100">
                  <span className="text-sm font-medium text-gray-400">3</span>
                </div>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-gray-500">Start monitoring</h4>
                <p className="text-sm text-gray-500">
                  View execution history, debug failures, and optimize performance
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Connect Platform
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white px-4 py-5 sm:p-6 shadow rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Workflows</h3>
          <p className="text-sm text-gray-500 mb-4">
            View and manage your automation workflows
          </p>
          <button className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            View workflows →
          </button>
        </div>
        
        <div className="bg-white px-4 py-5 sm:p-6 shadow rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Executions</h3>
          <p className="text-sm text-gray-500 mb-4">
            Monitor execution history and debug issues
          </p>
          <button className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            View executions →
          </button>
        </div>
        
        <div className="bg-white px-4 py-5 sm:p-6 shadow rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Settings</h3>
          <p className="text-sm text-gray-500 mb-4">
            Configure platforms and monitoring preferences
          </p>
          <button className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            Go to settings →
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
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
      <WithN8NConnection>
        <DashboardContent />
      </WithN8NConnection>
    </AppLayout>
  )
}
