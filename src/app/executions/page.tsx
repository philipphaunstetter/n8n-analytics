'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/components/app-layout'
import { WithN8NConnection } from '@/components/with-n8n-connection'
import { apiClient } from '@/lib/api-client'
import { 
  ExecutionStatus,
  TimeRange,
  Execution 
} from '@/types'
import {
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import { DEMO_WORKFLOWS } from '@/lib/demo-data'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table'
import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import { showToast } from '@/components/toast'

const statusIcons = {
  'success': CheckCircleIcon,
  'error': XCircleIcon,
  'running': PlayIcon,
  'waiting': ClockIcon,
  'canceled': ExclamationTriangleIcon,
  'unknown': ClockIcon
}

const statusColors = {
  'success': 'green',
  'error': 'red', 
  'running': 'blue',
  'waiting': 'yellow',
  'canceled': 'zinc',
  'unknown': 'zinc'
} as const

function ExecutionsContent() {
  const [executions, setExecutions] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | 'all'>('all')
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [n8nUrl, setN8nUrl] = useState<string>('')
  const router = useRouter()

  useEffect(() => {
    fetchExecutions()
  }, [statusFilter, timeRange])

  useEffect(() => {
    // Fetch n8n URL on component mount
    const fetchN8nUrl = async () => {
      try {
        const response = await apiClient.get<{ n8nUrl: string }>('/config/n8n-url')
        setN8nUrl(response.n8nUrl)
      } catch (err) {
        console.error('Failed to fetch n8n URL:', err)
        // Fallback to default
        setN8nUrl('http://localhost:5678')
      }
    }
    fetchN8nUrl()
  }, [])

  const fetchExecutions = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      params.append('timeRange', timeRange)
      
      const response = await apiClient.get<{ data: { items: Execution[] } }>(`/executions?${params}`)
      setExecutions(response.data.items)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch executions:', err)
      setError('Failed to load executions')
    } finally {
      setLoading(false)
    }
  }

  const syncExecutions = async () => {
    try {
      setSyncing(true)
      const response = await apiClient.post('/sync/executions')
      // After successful sync, refresh the data
      await fetchExecutions()
      setError(null)
      
      showToast({
        type: 'success',
        title: 'Executions synced successfully',
        message: 'Latest execution data has been fetched from n8n'
      })
    } catch (err) {
      console.error('Failed to sync executions:', err)
      const errorMessage = 'Failed to sync executions. Please try again.'
      setError(errorMessage)
      
      showToast({
        type: 'error',
        title: 'Sync failed',
        message: errorMessage
      })
    } finally {
      setSyncing(false)
    }
  }

  const filteredExecutions = executions.filter(execution => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    // Try to get workflow name from metadata (n8n data) or demo workflows
    const workflowName = execution.metadata?.workflowName || 
                         DEMO_WORKFLOWS.find(w => w.id === execution.workflowId)?.name || 
                         ''
    return (
      execution.id.toLowerCase().includes(searchLower) ||
      execution.workflowId.toLowerCase().includes(searchLower) ||
      (typeof workflowName === 'string' && workflowName.toLowerCase().includes(searchLower)) ||
      execution.error?.message?.toLowerCase().includes(searchLower)
    )
  })

  const formatDuration = (duration?: number) => {
    if (!duration) return '-'
    if (duration < 1000) return `${duration}ms`
    return `${(duration / 1000).toFixed(1)}s`
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(date))
  }

  const openN8nExecution = (execution: Execution) => {
    if (!n8nUrl) {
      console.error('n8n URL not available')
      return
    }
    
    // Construct the execution URL: /workflow/{workflowId}/executions/{executionId}
    const executionUrl = `${n8nUrl}/workflow/${execution.providerWorkflowId}/executions/${execution.providerExecutionId}`
    
    // Open in new tab
    window.open(executionUrl, '_blank')
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">Error loading executions</h3>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button onClick={fetchExecutions} className="mt-4">
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executions</h1>
          <p className="mt-2 text-sm text-gray-600">
            Monitor and debug workflow execution history
          </p>
        </div>
        <div className="flex space-x-3">
          <Button 
            outline
            onClick={syncExecutions} 
            disabled={syncing || loading}
            className="flex items-center space-x-2"
          >
            <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync'}</span>
          </Button>
          <Button onClick={fetchExecutions} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <div className="relative">
            <Input
              id="search"
              type="text"
              placeholder="Search executions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <Select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value as ExecutionStatus | 'all')}
          >
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="running">Running</option>
            <option value="waiting">Waiting</option>
            <option value="canceled">Canceled</option>
          </Select>
        </div>

        <div>
          <label htmlFor="timeRange" className="block text-sm font-medium text-gray-700 mb-1">
            Time Range
          </label>
          <Select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
          >
            <option value="1h">Last hour</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </Select>
        </div>

        <div className="flex items-end">
          <Button outline className="flex items-center space-x-2">
            <FunnelIcon className="h-4 w-4" />
            <span>More Filters</span>
          </Button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="bg-white px-4 py-3 border border-gray-200 rounded-md">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {filteredExecutions.length} of {executions.length} executions
          </span>
          <span>
            {timeRange === '1h' && 'Last hour'} 
            {timeRange === '24h' && 'Last 24 hours'}
            {timeRange === '7d' && 'Last 7 days'}
            {timeRange === '30d' && 'Last 30 days'}
          </span>
        </div>
      </div>

      {/* Executions Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Status</TableHeader>
              <TableHeader>Execution ID</TableHeader>
              <TableHeader>Workflow</TableHeader>
              <TableHeader>Started</TableHeader>
              <TableHeader>Duration</TableHeader>
              <TableHeader>Mode</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              // Loading rows
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <div className="animate-pulse flex space-x-4 py-4">
                      <div className="rounded-full bg-gray-300 h-6 w-6"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : filteredExecutions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  {executions.length === 0 
                    ? 'No executions found for this time range'
                    : 'No executions match your search criteria'
                  }
                </TableCell>
              </TableRow>
            ) : (
              filteredExecutions.map((execution) => {
                const StatusIcon = statusIcons[execution.status]
                return (
                  <TableRow 
                    key={execution.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => openN8nExecution(execution)}
                  >
                    <TableCell>
                      <Badge color={statusColors[execution.status]} className="flex items-center space-x-1">
                        <StatusIcon className="h-3 w-3" />
                        <span className="capitalize">{execution.status}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {execution.providerExecutionId.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">
                          {(typeof execution.metadata?.workflowName === 'string' ? execution.metadata.workflowName : null) || 
                           DEMO_WORKFLOWS.find(w => w.id === execution.workflowId)?.name || 
                           execution.workflowId}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">
                          {execution.providerWorkflowId}
                        </span>
                        {execution.error && (
                          <span className="text-sm text-red-600 truncate max-w-xs">
                            {execution.error.message}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDate(execution.startedAt)}
                    </TableCell>
                    <TableCell>
                      {formatDuration(execution.duration)}
                    </TableCell>
                    <TableCell>
                      <Badge color="blue" className="capitalize">
                        {(execution.metadata as any)?.firstNode?.name || execution.mode}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button 
                        outline
                        className="text-sm px-2 py-1"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation()
                          openN8nExecution(execution)
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default function ExecutionsPage() {
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
        <ExecutionsContent />
      </WithN8NConnection>
    </AppLayout>
  )
}